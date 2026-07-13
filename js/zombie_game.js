import { TheoryEngine } from './theory.js';
import { MidiController } from './midi.js';
import { AudioController } from './audio.js';
import { generateDefaultTown } from './town.js';

export class ZombieGame {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.labelsContainer = document.getElementById('labels-container');
        
        const params = new URLSearchParams(window.location.search);
        this.mode = params.get('mode') || 'scales'; 
        this.characterId = params.get('char') || 'synth';
        this.playerClass = this.characterId; // For future multiplayer synergy
        
        this.theory = new TheoryEngine();
        this.midi = new MidiController();
        this.audio = new AudioController();
        
        if (this.mode === 'chords') {
            this.level = 1;
            this.exercises = this.theory.getChords();
        } else {
            this.level = 1;
            this.exercises = [
                ...this.theory.getExercises('major'),
                ...this.theory.getExercises('minor')
            ];
        }
        
        this.zombies = [];
        this.lasers = [];
        this.walls = [];
        this.activeZombie = null;
        
        this.hp = 100;
        this.score = 0;
        this.streak = 0;
        this.power = 0;
        this.zombiesKilled = 0;
        this.killsToWin = 20;
        this.gameOver = false;
        this.playerParticles = [];
        
        this.playerVelocityY = 0;
        this.isGrounded = true;
        this.runCycle = 0;
        this.lastFootstepTime = 0;
        this.footstepInterval = 250; // ms between footsteps
        
        this.elements = {
            hpFill: document.getElementById('health-fill'),
            score: document.getElementById('score-display'),
            streak: document.getElementById('streak-display'),
            powerFill: document.getElementById('power-fill'),
            midi: document.getElementById('midi-status'),
            overMsg: document.getElementById('game-over-msg'),
            dialogueBox: document.getElementById('dialogue-box')
        };
        
        this.lastSpawnTime = 0;
        this.spawnInterval = 3000;
        
        this.keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, Shift: false, ' ': false };
        
        this.init();
    }
    
    async init() {
        this.scene = new THREE.Scene();
        // Bohemian dark yellow/brown background
        this.scene.background = new THREE.Color(0x2a1f10);
        this.scene.fog = new THREE.Fog(0x2a1f10, 10, 60);
        
        const gridHelper = new THREE.GridHelper(50, 50, 0x443322, 0x221100);
        this.scene.add(gridHelper);
        
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 25, 15);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.scaleFactor = 1.5; // Less pixelation
        this.renderer.setSize(window.innerWidth / this.scaleFactor, window.innerHeight / this.scaleFactor, false);
        this.container.appendChild(this.renderer.domElement);
        
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7)); // Brighter ambient
        const dirLight = new THREE.DirectionalLight(0xffddaa, 1.0); // Warm light
        dirLight.position.set(10, 30, 10);
        this.scene.add(dirLight);
        
        this.createPlayer();
        this.createLevel();
        
        // Start animation immediately so screen isn't black while loading
        this.animate(performance.now());
        
        window.addEventListener('resize', this.onResize.bind(this));
        
        let soundfont = 'lead_2_sawtooth';
        switch (this.characterId) {
            case 'rock': soundfont = 'overdriven_guitar'; break;
            case 'singer': soundfont = 'choir_aahs'; break;
            case 'jazz': soundfont = 'muted_trumpet'; break;
            case 'pianist': soundfont = 'acoustic_grand_piano'; break;
        }
        await this.audio.init(soundfont);
        
        this.midi.onStatusChange = (connected, inputs) => {
            if (connected && inputs && inputs.length > 0) {
                const names = inputs.map(i => i.name).join(', ');
                this.elements.midi.textContent = `MIDI: ${names}`;
                this.elements.midi.style.background = '#166534';
            } else {
                this.elements.midi.textContent = 'MIDI: Disconnected';
                this.elements.midi.style.background = '#333';
            }
        };
        await this.midi.init();
        
        this.setupMidiEvents();
        this.setupInputEvents();
        
        if (this.mode === 'chords') {
            setTimeout(() => this.showDialogue("Nivel 2: Acordes. ¡Sobrevive a las tríadas!"), 1500);
        } else {
            setTimeout(() => this.showDialogue("Nivel 1: Escalas. ¡Toca la nota faltante!"), 1500);
        }
    }
    
    async showDialogue(text) {
        if (this.isSpeaking) return;
        this.isSpeaking = true;
        this.elements.dialogueBox.style.opacity = 1;
        this.elements.dialogueBox.textContent = '';
        
        for (let i = 0; i < text.length; i++) {
            this.elements.dialogueBox.textContent += text[i];
            this.audio.playVoiceBeep(text[i]);
            await new Promise(r => setTimeout(r, 45)); // typing speed
        }
        
        await new Promise(r => setTimeout(r, 3000)); // display time
        this.elements.dialogueBox.style.opacity = 0;
        this.isSpeaking = false;
    }
    
    createPlayer() {
        this.playerGroup = new THREE.Group();
        this.playerBody = new THREE.Group();
        
        // Character colors based on selection
        const charColors = {
            synth: 0x00ffff,
            rock: 0xff4500,
            singer: 0xff69b4,
            jazz: 0xffd700,
            pianist: 0xaaaaaa
        };
        const bodyColor = charColors[this.characterId] || 0x00ffff;
        
        // Body
        const bodyGeo = new THREE.BoxGeometry(1, 1.5, 0.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.75;
        this.playerBody.add(body);
        
        // Head
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa, flatShading: true });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.8;
        this.playerBody.add(head);
        
        // Character-specific accessories (matching home screen)
        if (this.characterId === 'synth') {
            const acc = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: 0xff00ff, flatShading: true }));
            acc.position.set(0, 0.8, 0.5);
            acc.rotation.y = 0.2;
            this.playerBody.add(acc);
        } else if (this.characterId === 'rock') {
            const acc = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0xcc0000, flatShading: true }));
            acc.position.set(0, 0.8, 0.4);
            acc.rotation.z = Math.PI / 6;
            this.playerBody.add(acc);
        } else if (this.characterId === 'singer') {
            const acc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6), new THREE.MeshStandardMaterial({ color: 0x444444, flatShading: true }));
            acc.position.set(0, 1.4, 0.4);
            this.playerBody.add(acc);
        } else if (this.characterId === 'jazz') {
            const acc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.8), new THREE.MeshStandardMaterial({ color: 0xffd700, flatShading: true }));
            acc.position.set(0, 1.4, 0.6);
            acc.rotation.x = Math.PI / 2;
            this.playerBody.add(acc);
            const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0x111111, flatShading: true }));
            hat.position.y = 2.2;
            this.playerBody.add(hat);
        } else if (this.characterId === 'pianist') {
            const acc = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
            acc.position.set(0.2, 1.7, 0.4);
            this.playerBody.add(acc);
            const tie = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x000000, flatShading: true }));
            tie.position.set(0, 1.0, 0.26);
            this.playerBody.add(tie);
        }
        
        this.playerGroup.add(this.playerBody);
        this.scene.add(this.playerGroup);
    }
    
    createLevel() {
        const addWall = (x, z, w, d, isHalf, colorHex = 0x444444, isBorder = false) => {
            const h = isHalf ? 0.9 : (isBorder ? 5 : 3 + Math.random() * 4);
            const geo = new THREE.BoxGeometry(w, h, d);
            const mat = new THREE.MeshStandardMaterial({ color: colorHex, flatShading: true, roughness: 0.85 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, h/2, z);
            this.scene.add(mesh);
            this.walls.push({ mesh, x, z, w, d, isHalf, isBorder, minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
            
            // Add lit windows to buildings (not borders or half-walls)
            if (!isHalf && !isBorder && h > 2) {
                const winGeo = new THREE.PlaneGeometry(0.6, 0.8);
                const winColors = [0xffcc00, 0xff8800, 0xffee66];
                const numWindows = Math.floor(h * 1.5);
                for (let ww = 0; ww < numWindows; ww++) {
                    if (Math.random() < 0.4) continue; // some windows dark
                    const winMat = new THREE.MeshBasicMaterial({ color: winColors[Math.floor(Math.random() * winColors.length)] });
                    const win = new THREE.Mesh(winGeo, winMat);
                    const face = Math.floor(Math.random() * 4);
                    const rx = (Math.random() - 0.5) * (w * 0.7);
                    const ry = (Math.random() - 0.3) * (h * 0.8);
                    if (face === 0) { win.position.set(rx, ry, d/2 + 0.01); }
                    else if (face === 1) { win.position.set(rx, ry, -d/2 - 0.01); win.rotation.y = Math.PI; }
                    else if (face === 2) { win.position.set(w/2 + 0.01, ry, rx); win.rotation.y = Math.PI/2; }
                    else { win.position.set(-w/2 - 0.01, ry, rx); win.rotation.y = -Math.PI/2; }
                    mesh.add(win);
                }
            }
        };
        
        // === CITY MAP ===
        
        // Floor - cobblestone-like dark surface
        const floorGeo = new THREE.PlaneGeometry(60, 60);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.95 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);
        
        // Street markings (thin yellow lines on ground)
        const lineGeo = new THREE.PlaneGeometry(0.15, 50);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x554400 });
        for (let lx of [-7, 7]) {
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(lx, 0.01, 0);
            this.scene.add(line);
        }
        const lineGeo2 = new THREE.PlaneGeometry(50, 0.15);
        for (let lz of [-7, 7]) {
            const line = new THREE.Mesh(lineGeo2, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.01, lz);
            this.scene.add(line);
        }
        
        // --- Border walls (city edges) ---
        addWall(0, -27, 60, 2, false, 0x222222, true);
        addWall(0, 27, 60, 2, false, 0x222222, true);
        addWall(-27, 0, 2, 60, false, 0x222222, true);
        addWall(27, 0, 2, 60, false, 0x222222, true);
        
        // --- NW Block (buildings cluster) ---
        addWall(-18, -18, 6, 5, false, 0x6b3a2a);
        addWall(-12, -16, 3, 4, false, 0x7c4a35);
        addWall(-20, -12, 4, 3, false, 0x5c3020);
        
        // --- NE Block ---
        addWall(18, -18, 5, 6, false, 0x3a5a6b);
        addWall(13, -15, 4, 3, false, 0x2a4a5b);
        addWall(20, -12, 3, 4, false, 0x4a6a7b);
        
        // --- SW Block ---
        addWall(-18, 18, 5, 5, false, 0x3a6b4a);
        addWall(-13, 15, 3, 4, false, 0x2a5b3a);
        addWall(-20, 12, 4, 3, false, 0x4a7b5a);
        
        // --- SE Block ---
        addWall(18, 18, 6, 5, false, 0x6b5a2a);
        addWall(13, 16, 4, 3, false, 0x7b6a3a);
        addWall(20, 12, 3, 4, false, 0x8b7a4a);
        
        // --- Central buildings (around the plaza) ---
        addWall(-4, -12, 3, 3, false, 0x8b5cf6); // purple
        addWall(4, -12, 3, 3, false, 0x3b82f6);  // blue
        addWall(-4, 12, 3, 3, false, 0x10b981);  // green
        addWall(4, 12, 3, 3, false, 0xf59e0b);   // amber
        
        // --- Long walls / alleys ---
        addWall(-8, 0, 1.5, 10, false, 0x555555);
        addWall(8, 0, 1.5, 10, false, 0x555555);
        
        // --- Half-walls (stumble traps) ---
        addWall(0, -5, 6, 1, true, 0x887744);
        addWall(0, 5, 6, 1, true, 0x887744);
        addWall(-15, 0, 1, 6, true, 0x887744);
        addWall(15, 0, 1, 6, true, 0x887744);
        
        // --- Scattered small obstacles ---
        addWall(-10, -5, 2, 2, false, 0x664422);
        addWall(10, 5, 2, 2, false, 0x664422);
        addWall(-3, 20, 2, 2, false, 0x553311);
        addWall(3, -20, 2, 2, false, 0x553311);
        
        // --- Lamp posts (thin tall cylinders) ---
        const lampGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 6);
        const lampMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const lampLightGeo = new THREE.SphereGeometry(0.3, 6, 6);
        const lampLightMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
        const lampPositions = [
            [-7, -7], [7, -7], [-7, 7], [7, 7],
            [-7, 0], [7, 0], [0, -7], [0, 7],
            [-18, 0], [18, 0], [0, -18], [0, 18]
        ];
        for (const [lx, lz] of lampPositions) {
            const pole = new THREE.Mesh(lampGeo, lampMat);
            pole.position.set(lx, 2, lz);
            this.scene.add(pole);
            const bulb = new THREE.Mesh(lampLightGeo, lampLightMat);
            bulb.position.set(lx, 4.2, lz);
            this.scene.add(bulb);
            // Actual point light (warm, short range)
            const pl = new THREE.PointLight(0xffaa44, 0.8, 12);
            pl.position.set(lx, 4, lz);
            this.scene.add(pl);
        }
    }
    
    setupInputEvents() {
        window.addEventListener('keydown', (e) => {
            const k = e.key === ' ' ? ' ' : (e.key.length === 1 ? e.key.toLowerCase() : e.key);
            if (this.keys.hasOwnProperty(k)) this.keys[k] = true;
            
            // Jump on Shift
            if (e.key === 'Shift' && this.isGrounded && !this.gameOver) {
                this.playerVelocityY = 0.6; // jump force
                this.isGrounded = false;
            }
            
            // Trigger Power on Space
            if (k === ' ' && this.power >= 100 && !this.gameOver) {
                this.triggerPower();
            }
        });
        window.addEventListener('keyup', (e) => {
            const k = e.key === ' ' ? ' ' : (e.key.length === 1 ? e.key.toLowerCase() : e.key);
            if (this.keys.hasOwnProperty(k)) this.keys[k] = false;
        });
    }
    
    spawnZombie() {
        if (this.gameOver) return;
        
        const ex = this.exercises[Math.floor(Math.random() * this.exercises.length)];
        const isFromTop = Math.random() > 0.5;
        
        const zGroup = new THREE.Group();
        
        const zGeo = new THREE.BoxGeometry(1, 1.1, 1);
        const zMat = new THREE.MeshStandardMaterial({ color: 0x33ff33 });
        const body = new THREE.Mesh(zGeo, zMat);
        body.position.y = 0.55;
        
        const legGeo = new THREE.BoxGeometry(0.3, 0.5, 0.3);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x1c8c1c });
        const legL = new THREE.Mesh(legGeo, legMat);
        legL.position.set(-0.25, 0.25, 0);
        const legR = new THREE.Mesh(legGeo, legMat);
        legR.position.set(0.25, 0.25, 0);
        
        zGroup.add(body);
        zGroup.add(legL);
        zGroup.add(legR);
        
        zGroup.position.set((Math.random() - 0.5) * 15, 0, isFromTop ? -25 : 25);
        this.scene.add(zGroup);
        
        let expected = [...(ex.notes_expected || ex.notes_expected_asc)];
        if (this.mode === 'scales' && !isFromTop) {
            expected.reverse();
        }
        
        const label = document.createElement('div');
        label.className = 'zombie-label';
        const subLabel = this.mode === 'scales' ? (isFromTop ? 'Ascending' : 'Descending') : 'Simultaneous';
        label.innerHTML = `${ex.name}<br><span class="direction">${subLabel}</span>`;
        this.labelsContainer.appendChild(label);
        
        this.zombies.push({
            mesh: zGroup,
            material: zMat,
            label: label,
            expected: expected,
            progress: 0,
            stumbleFrames: 0,
            legL: legL,
            legR: legR,
            runCycle: Math.random() * 10,
            speed: 0.015 + Math.random() * 0.015
        });
    }
    
    setupMidiEvents() {
        this.midi.onNoteOn((note) => {
            if (this.gameOver) return;
            this.audio.playNote(note);
            this.handleCombat(note);
        });
        
        this.midi.onNoteOff((note) => {
            if (this.gameOver) return;
            this.audio.stopNote(note);
        });
    }
    
    handleCombat(note) {
        if (this.mode === 'chords') {
            const activePcs = new Set([...this.midi.activeMidiNotes].map(n => n % 12));
            
            let hitZombie = null;
            for (const z of this.zombies) {
                const req = z.expected.map(n => n % 12);
                let allMatch = true;
                for (const r of req) {
                    if (!activePcs.has(r)) allMatch = false;
                }
                if (allMatch) {
                    hitZombie = z;
                    break;
                }
            }
            if (hitZombie) {
                this.streak++;
                this.power = Math.min(100, this.power + 5);
                this.updateHUD();
                
                this.playerGroup.lookAt(hitZombie.mesh.position);
                const rootPc = hitZombie.expected[0] % 12;
                this.fireLaser(hitZombie.mesh.position, rootPc);
                this.spawnLightning(hitZombie.mesh.position, rootPc);
                this.killZombie(hitZombie);
                this.score += 200 + (this.streak * 20);
                this.zombiesKilled++;
                this.updateHUD();
                
                if (this.mode === 'chords' && this.level === 1 && this.zombiesKilled >= 10) {
                    this.level = 2;
                    this.exercises = [...this.exercises, ...this.theory.getTetrads()];
                    this.showDialogue("¡NIVEL 2! Ahora vienen los acordes de Séptima (Tétradas). ¡Prepárate!");
                }
                
                if (this.zombiesKilled >= this.killsToWin) {
                    this.winGame();
                }
            }
        } else {
            // Scales mode logic
            const pc = note % 12;
            if (this.activeZombie) {
                this.tryHitZombie(this.activeZombie, pc);
                return;
            }
            
            let closest = null;
            let minDist = Infinity;
            
            for (const z of this.zombies) {
                if (z.progress === 0 && z.expected[0] % 12 === pc) {
                    const dist = z.mesh.position.distanceTo(this.playerGroup.position);
                    if (dist < minDist) {
                        minDist = dist;
                        closest = z;
                    }
                }
            }
            if (closest) {
                this.activeZombie = closest;
                this.tryHitZombie(closest, pc);
            }
        }
    }
    
    tryHitZombie(zombie, pc) {
        const targetPc = zombie.expected[zombie.progress] % 12;
        
        if (targetPc === pc) {
            zombie.progress++;
            this.streak++;
            this.power = Math.min(100, this.power + 5);
            this.updateHUD();
            
            this.playerGroup.lookAt(zombie.mesh.position);
            this.fireLaser(zombie.mesh.position, targetPc); // Laser color matches the played note
            
            zombie.material.color.setHex(0xffffff);
            setTimeout(() => zombie.material.color.setHex(0x33ff33), 100);
            
            if (zombie.progress >= zombie.expected.length) {
                const rootPc = zombie.expected[0] % 12;
                this.spawnLightning(zombie.mesh.position, rootPc); // Explosion matches the scale's root note
                this.killZombie(zombie);
                this.activeZombie = null;
                this.score += 100 + (this.streak * 10);
                this.zombiesKilled++;
                this.updateHUD();
                
                if (this.mode === 'chords' && this.level === 1 && this.zombiesKilled >= 10) {
                    this.level = 2;
                    this.exercises = [...this.exercises, ...this.theory.getTetrads()];
                    this.showDialogue("¡NIVEL 2! Ahora vienen los acordes de Séptima (Tétradas). ¡Prepárate!");
                }
                
                if (this.zombiesKilled >= this.killsToWin) {
                    this.winGame();
                }
            }
        } else {
            zombie.progress = 0;
            this.activeZombie = null;
            this.streak = 0;
            this.updateHUD();
            
            zombie.material.color.setHex(0xff0000);
            setTimeout(() => zombie.material.color.setHex(0x33ff33), 300);
        }
    }
    
    updateHUD() {
        this.elements.score.textContent = `Score: ${this.score} | Kills: ${this.zombiesKilled}/${this.killsToWin}`;
        this.elements.streak.textContent = `Streak: ${this.streak}`;
        this.elements.powerFill.style.width = `${this.power}%`;
        
        if (this.power >= 100) {
            this.elements.powerFill.style.background = '#fff';
            this.elements.powerFill.style.boxShadow = '0 0 10px #00ffff';
        } else {
            this.elements.powerFill.style.background = '#00ffff';
            this.elements.powerFill.style.boxShadow = 'none';
        }
    }
    
    triggerPower() {
        this.power = 0;
        this.updateHUD();
        
        document.body.style.background = '#fff';
        setTimeout(() => document.body.style.background = '#050505', 100);
        
        const allZombies = [...this.zombies];
        for (const z of allZombies) {
            this.score += 50;
            const rootPc = z.expected[0] % 12;
            this.fireLaser(z.mesh.position, rootPc);
            this.spawnLightning(z.mesh.position, rootPc);
            this.killZombie(z);
            this.zombiesKilled++;
        }
        
        this.activeZombie = null;
        this.updateHUD();
        
        if (this.zombiesKilled >= this.killsToWin) {
            this.winGame();
        }
    }
    
    getColorForPc(pc) {
        const NOTE_COLORS = [0xff0000, 0xff4500, 0xffa500, 0xffd700, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0x4b0082, 0x800080, 0xff1493, 0xff69b4];
        return NOTE_COLORS[pc % 12] || 0x00ffff;
    }
    
    fireLaser(targetPos, pc = 0) {
        const color = this.getColorForPc(pc);
        const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
        const points = [
            this.playerGroup.position.clone().add(new THREE.Vector3(0, 1, 0)),
            targetPos.clone().add(new THREE.Vector3(0, 1, 0))
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        this.lasers.push({ mesh: line, life: 10 });
    }
    
    spawnLightning(pos, pc = 0) {
        const color = this.getColorForPc(pc);
        for(let j=0; j<3; j++) {
            const points = [];
            let curr = pos.clone();
            points.push(curr.clone());
            for(let i=0; i<4; i++) {
                curr.x += (Math.random()-0.5)*4;
                curr.y += (Math.random()-0.5)*4;
                curr.z += (Math.random()-0.5)*4;
                points.push(curr.clone());
            }
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 1 });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
            this.lasers.push({ mesh: line, life: 20 });
        }
    }
    
    killZombie(zombie) {
        this.playZombieDeathSFX();
        this.scene.remove(zombie.mesh);
        zombie.label.remove();
        this.zombies = this.zombies.filter(z => z !== zombie);
    }
    
    // --- Procedural SFX ---
    
    playFootstepSFX() {
        const now = performance.now();
        if (now - this.lastFootstepTime < this.footstepInterval) return;
        this.lastFootstepTime = now;
        
        const ctx = this.audio.context;
        if (!ctx) return;
        
        const bufferSize = ctx.sampleRate * 0.06; // 60ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            // Filtered noise burst that decays
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.3;
        }
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400 + Math.random() * 200;
        
        const gain = ctx.createGain();
        gain.gain.value = 0.08;
        
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();
    }
    
    playZombieDeathSFX() {
        const ctx = this.audio.context;
        if (!ctx) return;
        
        // Descending pitch squeal + noise burst
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.12, ctx.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
        
        // Noise burst layer
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const nGain = ctx.createGain();
        nGain.gain.value = 0.06;
        const nFilter = ctx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.value = 300;
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(ctx.destination);
        noise.start();
    }
    
    winGame() {
        if (!this.gameOver) {
            this.gameOver = true;
            this.elements.overMsg.textContent = 'YOU SURVIVED!';
            this.elements.overMsg.style.color = '#4ade80';
            this.elements.overMsg.style.textShadow = '0 0 20px #4ade80';
            this.elements.overMsg.style.opacity = 1;
        }
    }
    
    takeDamage() {
        this.hp -= 15;
        this.elements.hpFill.style.width = `${Math.max(0, this.hp)}%`;
        
        document.body.style.background = '#300';
        setTimeout(() => document.body.style.background = '#050505', 200);
        
        if (this.hp <= 0 && !this.gameOver) {
            this.gameOver = true;
            this.elements.overMsg.style.opacity = 1;
        }
    }
    
    updateLabels() {
        const tempV = new THREE.Vector3();
        for (const z of this.zombies) {
            tempV.copy(z.mesh.position);
            tempV.y += 1.5;
            tempV.project(this.camera);
            
            const x = (tempV.x *  .5 + .5) * window.innerWidth;
            const y = (tempV.y * -.5 + .5) * window.innerHeight;
            
            z.label.style.left = `${x}px`;
            z.label.style.top = `${y}px`;
            
            if (z.progress > 0) {
                z.label.style.borderColor = '#00ffff';
            } else {
                z.label.style.borderColor = '#ff4444';
            }
            
            // Hide label if zombie is stumbling (fallen over)
            z.label.style.display = z.stumbleFrames > 0 ? 'none' : 'block';
        }
    }
    
    animate(time) {
        requestAnimationFrame(this.animate.bind(this));
        
        if (!this.gameOver) {
            // Player Movement (Arrow Keys)
            let dx = 0; let dz = 0;
            const pSpeed = 0.15;
            if (this.keys.ArrowUp) dz -= pSpeed;
            if (this.keys.ArrowDown) dz += pSpeed;
            if (this.keys.ArrowLeft) dx -= pSpeed;
            if (this.keys.ArrowRight) dx += pSpeed;
            
            // Jump Physics
            if (!this.isGrounded) {
                this.playerVelocityY -= 0.03; // gravity
                this.playerGroup.position.y += this.playerVelocityY;
                if (this.playerGroup.position.y <= 0) {
                    this.playerGroup.position.y = 0;
                    this.isGrounded = true;
                    this.playerVelocityY = 0;
                }
            }
            
            // Run animation
            if (dx !== 0 || dz !== 0) {
                this.runCycle += 0.2;
                this.playerBody.position.y = Math.abs(Math.sin(this.runCycle)) * 0.3;
                this.playerBody.rotation.z = Math.sin(this.runCycle * 0.5) * 0.1;
                // Face movement direction
                this.playerGroup.rotation.y = Math.atan2(dx, dz);
            } else {
                this.playerBody.position.y = 0;
                this.playerBody.rotation.z = 0;
            }
            
            // AABB Collision for Player vs Walls
            let newX = this.playerGroup.position.x + dx;
            let newZ = this.playerGroup.position.z + dz;
            const pSize = 1;
            
            for (const w of this.walls) {
                // If jump is high enough, pass over half walls
                if (w.isHalf && this.playerGroup.position.y > 0.8) continue;
                
                if (newX + pSize/2 > w.minX && newX - pSize/2 < w.maxX &&
                    newZ + pSize/2 > w.minZ && newZ - pSize/2 < w.maxZ) {
                    
                    if (this.playerGroup.position.x + pSize/2 <= w.minX || this.playerGroup.position.x - pSize/2 >= w.maxX) dx = 0;
                    if (this.playerGroup.position.z + pSize/2 <= w.minZ || this.playerGroup.position.z - pSize/2 >= w.maxZ) dz = 0;
                    newX = this.playerGroup.position.x + dx;
                    newZ = this.playerGroup.position.z + dz;
                }
            }
            
            this.playerGroup.position.x = Math.max(-23, Math.min(23, newX));
            this.playerGroup.position.z = Math.max(-23, Math.min(23, newZ));
            
            // Spawning
            if (time - this.lastSpawnTime > this.spawnInterval) {
                this.spawnZombie();
                this.lastSpawnTime = time;
                this.spawnInterval = Math.max(1000, this.spawnInterval - 50);
            }
            
            // Move zombies
            for (let i = this.zombies.length - 1; i >= 0; i--) {
                const z = this.zombies[i];
                
                if (z.stumbleFrames > 0) {
                    z.stumbleFrames--;
                    if (z.stumbleFrames === 0) {
                        z.mesh.rotation.x = 0;
                        z.mesh.position.y = 0;
                    }
                    continue; 
                }
                
                // Animate zombie legs
                z.runCycle += 0.2;
                z.legL.rotation.x = Math.sin(z.runCycle) * 0.5;
                z.legR.rotation.x = Math.cos(z.runCycle) * 0.5;
                
                let dir = new THREE.Vector3().subVectors(this.playerGroup.position, z.mesh.position);
                dir.y = 0;
                const distToPlayer = dir.length();
                dir.normalize();
                
                const speed = (this.activeZombie === z) ? z.speed * 0.1 : z.speed;
                let zDx = dir.x * speed;
                let zDz = dir.z * speed;
                
                let hitHalfWall = false;
                const size = 1;
                
                // Try full movement first
                let newZx = z.mesh.position.x + zDx;
                let newZz = z.mesh.position.z + zDz;
                let blockedX = false;
                let blockedZ = false;
                
                for (const w of this.walls) {
                    if (w.isBorder) {
                        // Border walls: hard block, no bypass
                        if (newZx + size/2 > w.minX && newZx - size/2 < w.maxX &&
                            newZz + size/2 > w.minZ && newZz - size/2 < w.maxZ) {
                            if (z.mesh.position.x + size/2 <= w.minX || z.mesh.position.x - size/2 >= w.maxX) { zDx = 0; blockedX = true; }
                            if (z.mesh.position.z + size/2 <= w.minZ || z.mesh.position.z - size/2 >= w.maxZ) { zDz = 0; blockedZ = true; }
                            newZx = z.mesh.position.x + zDx;
                            newZz = z.mesh.position.z + zDz;
                        }
                        continue;
                    }
                    
                    if (newZx + size/2 > w.minX && newZx - size/2 < w.maxX &&
                        newZz + size/2 > w.minZ && newZz - size/2 < w.maxZ) {
                        
                        if (w.isHalf) {
                            hitHalfWall = true;
                        } else {
                            // Slide along wall: zero only the blocked axis
                            if (z.mesh.position.x + size/2 <= w.minX || z.mesh.position.x - size/2 >= w.maxX) { zDx = 0; blockedX = true; }
                            if (z.mesh.position.z + size/2 <= w.minZ || z.mesh.position.z - size/2 >= w.maxZ) { zDz = 0; blockedZ = true; }
                            newZx = z.mesh.position.x + zDx;
                            newZz = z.mesh.position.z + zDz;
                        }
                    }
                }
                
                // If zombie got totally stuck (both axes blocked), nudge perpendicular to escape
                if (blockedX && blockedZ) {
                    const perp = new THREE.Vector3(-dir.z, 0, dir.x); // perpendicular
                    // Pick direction that moves zombie further from walls it's stuck on
                    if (!z.dodgeDir) z.dodgeDir = Math.random() > 0.5 ? 1 : -1;
                    zDx = perp.x * speed * z.dodgeDir;
                    zDz = perp.z * speed * z.dodgeDir;
                    newZx = z.mesh.position.x + zDx;
                    newZz = z.mesh.position.z + zDz;
                    z.stuckFrames = (z.stuckFrames || 0) + 1;
                    // Flip dodge direction if stuck too long
                    if (z.stuckFrames > 60) { z.dodgeDir *= -1; z.stuckFrames = 0; }
                } else {
                    z.stuckFrames = 0;
                    z.dodgeDir = null;
                }
                
                if (hitHalfWall) {
                    z.stumbleFrames = 120;
                    z.mesh.rotation.x = Math.PI / 2;
                    z.mesh.position.y = 0.2;
                } else {
                    z.mesh.position.x = newZx;
                    z.mesh.position.z = newZz;
                    
                    if (zDx !== 0 || zDz !== 0) {
                        const targetLook = new THREE.Vector3(newZx + zDx, z.mesh.position.y, newZz + zDz);
                        z.mesh.lookAt(targetLook);
                    }
                }
                
                if (distToPlayer < 1.5 && z.stumbleFrames === 0) {
                    this.takeDamage();
                    this.killZombie(z);
                    if (this.activeZombie === z) this.activeZombie = null;
                }
            }
            
            // Lasers & Lightning fade
            for (let i = this.lasers.length - 1; i >= 0; i--) {
                const l = this.lasers[i];
                l.life--;
                l.mesh.material.opacity = l.life / 20;
                if (l.life <= 0) {
                    this.scene.remove(l.mesh);
                    this.lasers.splice(i, 1);
                }
            }
        }
        
        this.updateLabels();
        
        // Camera follows player smoothly
        this.camera.position.x += (this.playerGroup.position.x - this.camera.position.x) * 0.1;
        this.camera.position.z += (this.playerGroup.position.z + 15 - this.camera.position.z) * 0.1;
        
        this.updatePlayerParticles();
        this.renderer.render(this.scene, this.camera);
    }
    
    updatePlayerParticles() {
        if (Math.random() < 0.2) {
            let pColor = 0x00ffff;
            if (this.characterId === 'rock') pColor = 0xff4500; 
            else if (this.characterId === 'singer') pColor = 0xff69b4; 
            else if (this.characterId === 'jazz') pColor = 0xffd700; 
            else if (this.characterId === 'pianist') pColor = 0xaaaaaa;
            
            const size = (this.characterId === 'pianist') ? 0.15 : 0.2;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.8 });
            const p = new THREE.Mesh(geo, mat);
            
            p.position.copy(this.playerGroup.position);
            p.position.y += 1 + Math.random();
            p.position.x += (Math.random() - 0.5) * 1.5;
            p.position.z += (Math.random() - 0.5) * 1.5;
            
            if (this.characterId === 'pianist') {
                const globalPos = new THREE.Vector3();
                this.playerGroup.getWorldPosition(globalPos);
                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerGroup.quaternion);
                p.position.copy(globalPos).add(forward.multiplyScalar(0.6));
                p.position.y += 1.3;
                p.position.x += 0.3; // slightly to the right for the cigarette
            }
            
            this.scene.add(p);
            this.playerParticles.push({ mesh: p, life: 60, maxLife: 60 });
        }
        
        for (let i = this.playerParticles.length - 1; i >= 0; i--) {
            const p = this.playerParticles[i];
            p.life--;
            p.mesh.position.y += 0.05;
            if (this.characterId === 'pianist') p.mesh.position.x += (Math.random() - 0.5) * 0.05;
            p.mesh.material.opacity = p.life / p.maxLife;
            p.mesh.rotation.x += 0.1;
            p.mesh.rotation.y += 0.1;
            
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.playerParticles.splice(i, 1);
            }
        }
    }
    
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth / this.scaleFactor, window.innerHeight / this.scaleFactor, false);
    }
}
