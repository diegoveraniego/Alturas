import { generateDefaultTown } from './town.js';

export class MapEditor {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.blocks = [];
        this.gridSize = 40; // 40x40 grid (-20 to 20)
        
        this.colors = [
            0x444444, // Gray (Default wall)
            0xff0000, // Red
            0x00ff00, // Green
            0x0000ff, // Blue
            0xffff00, // Yellow
            0x8b5cf6, // Purple
            0x00ffff, // Cyan
            0x8B4513, // Brown (Wood)
            0xffffff  // White
        ];
        this.selectedColor = this.colors[0];
        this.currentTool = 'wall'; // 'wall', 'half', 'erase'
        
        this.keys = { w: false, a: false, s: false, d: false };
        this.cameraSpeed = 0.5;
        
        this.initUI();
        this.init3D();
        this.loadMap();
        
        this.animate = this.animate.bind(this);
        this.animate();
    }
    
    initUI() {
        // Color Palette
        const palette = document.getElementById('color-palette');
        this.colors.forEach((colorHex, idx) => {
            const btn = document.createElement('div');
            btn.className = 'color-btn' + (idx === 0 ? ' active' : '');
            btn.style.backgroundColor = '#' + colorHex.toString(16).padStart(6, '0');
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedColor = colorHex;
            });
            palette.appendChild(btn);
        });
        
        // Tools
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
            });
        });
        
        // Actions
        document.getElementById('btn-save').addEventListener('click', () => this.saveMap());
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm("Are you sure you want to clear the entire map?")) {
                this.blocks.forEach(b => this.scene.remove(b.mesh));
                this.blocks = [];
            }
        });
        
        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.key.toLowerCase())) this.keys[e.key.toLowerCase()] = true;
        });
        window.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.key.toLowerCase())) this.keys[e.key.toLowerCase()] = false;
        });
    }
    
    init3D() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x333344); // Brighter background
        
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 25, 25);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);
        
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);
        
        // Grid Helper - Lighter colors to be visible
        const grid = new THREE.GridHelper(this.gridSize, this.gridSize, 0xaaaaaa, 0x555555);
        this.scene.add(grid);
        
        // Invisible plane for raycasting
        const planeGeo = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
        planeGeo.rotateX(-Math.PI / 2);
        this.raycastPlane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ visible: false }));
        this.scene.add(this.raycastPlane);
        
        // Raycaster
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Hover Box
        const rollGeo = new THREE.BoxGeometry(1, 1, 1);
        const rollMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
        this.hoverBox = new THREE.Mesh(rollGeo, rollMat);
        this.scene.add(this.hoverBox);
        
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('resize', this.onResize.bind(this));
    }
    
    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Intersect blocks or plane
        const objects = [...this.blocks.map(b => b.mesh), this.raycastPlane];
        const intersects = this.raycaster.intersectObjects(objects);
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            
            // Calculate grid position
            let target = intersect.point.clone();
            
            if (this.currentTool !== 'erase' && intersect.object !== this.raycastPlane) {
                // If placing on top of a block, offset by normal
                target.add(intersect.face.normal.clone().multiplyScalar(0.5));
            }
            
            const gx = Math.floor(target.x + 0.5);
            const gz = Math.floor(target.z + 0.5);
            
            // Clamp to grid
            const limit = this.gridSize / 2;
            if (gx >= -limit && gx < limit && gz >= -limit && gz < limit) {
                this.hoverBox.position.set(gx, (this.currentTool === 'half') ? 0.25 : 0.5, gz);
                this.hoverBox.scale.y = (this.currentTool === 'half') ? 0.5 : 1;
                this.hoverBox.visible = true;
            } else {
                this.hoverBox.visible = false;
            }
        } else {
            this.hoverBox.visible = false;
        }
    }
    
    onMouseDown(event) {
        // Prevent clicks on UI
        if (event.target.tagName === 'BUTTON' || event.target.closest('.panel')) return;
        if (!this.hoverBox.visible) return;
        
        const gx = this.hoverBox.position.x;
        const gz = this.hoverBox.position.z;
        const gy = this.hoverBox.position.y;
        
        // Find if a block already exists here
        const existingIdx = this.blocks.findIndex(b => Math.abs(b.mesh.position.x - gx) < 0.1 && Math.abs(b.mesh.position.z - gz) < 0.1 && Math.abs(b.mesh.position.y - gy) < 0.1);
        
        if (this.currentTool === 'erase') {
            // Find clicked block directly via raycast to be more precise
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.blocks.map(b => b.mesh));
            if (intersects.length > 0) {
                const clickedMesh = intersects[0].object;
                const idx = this.blocks.findIndex(b => b.mesh === clickedMesh);
                if (idx > -1) {
                    this.scene.remove(clickedMesh);
                    this.blocks.splice(idx, 1);
                }
            }
        } else {
            if (existingIdx === -1) {
                this.placeBlock(gx, gy, gz, this.selectedColor, this.currentTool === 'half');
            }
        }
    }
    
    placeBlock(x, y, z, color, isHalf) {
        const height = isHalf ? 0.5 : 1.0;
        const geo = new THREE.BoxGeometry(1, height, 1);
        const mat = new THREE.MeshStandardMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        
        this.scene.add(mesh);
        this.blocks.push({
            mesh: mesh,
            x: x,
            y: y,
            z: z,
            color: color,
            isHalf: isHalf
        });
    }
    
    saveMap() {
        const mapData = this.blocks.map(b => ({
            x: b.x,
            y: b.y,
            z: b.z,
            color: b.color,
            isHalf: b.isHalf
        }));
        localStorage.setItem('alturas_custom_map', JSON.stringify(mapData));
        alert("Mapa guardado exitosamente. Ahora puedes jugar en él en el modo historia.");
    }
    
    loadMap() {
        const saved = localStorage.getItem('alturas_custom_map');
        if (saved) {
            try {
                const mapData = JSON.parse(saved);
                mapData.forEach(b => {
                    this.placeBlock(b.x, b.y, b.z, b.color, b.isHalf);
                });
                return;
            } catch (e) {
                console.error("Error loading map", e);
            }
        }
        
        // If no saved map, load the Default Town!
        const blocks = generateDefaultTown();
        blocks.forEach(b => this.placeBlock(b.x, b.y, b.z, b.color, b.isHalf));
    }
    
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        
        // Camera movement
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        
        if (this.keys.w) this.camera.position.add(forward.clone().multiplyScalar(this.cameraSpeed));
        if (this.keys.s) this.camera.position.add(forward.clone().multiplyScalar(-this.cameraSpeed));
        if (this.keys.a) this.camera.position.add(right.clone().multiplyScalar(-this.cameraSpeed));
        if (this.keys.d) this.camera.position.add(right.clone().multiplyScalar(this.cameraSpeed));
        
        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.editor = new MapEditor();
});
