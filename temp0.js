
        import { MidiController } from './js/midi.js';
        import { AudioController } from './js/audio.js';
        
        // POC: Escena Three.js (Montaña nevada y "notas" rotando)
        const container = document.getElementById('canvas-container');
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x2a1f0d, 0.04); // Bohemian dark yellow fog

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 15;
        camera.position.y = 5;

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
        
        // Low res for retro aesthetic
        const scaleFactor = 4;
        renderer.setSize(window.innerWidth / scaleFactor, window.innerHeight / scaleFactor, false);
        container.appendChild(renderer.domElement);

        // Iluminación
        const ambientLight = new THREE.AmbientLight(0xffcc88, 0.3); // Warm ambient light
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        scene.add(dirLight);

        // Edificio de Jazz (Reemplaza a la montaña)
        const geometry = new THREE.BoxGeometry(8, 20, 8);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, 
            flatShading: true,
            roughness: 0.9
        });
        const mountain = new THREE.Mesh(geometry, material); // Mantengo variable mountain para la animación
        mountain.position.y = 2;
        scene.add(mountain);
        
        // Ventanas iluminadas
        const winGeo = new THREE.PlaneGeometry(1, 1.5);
        const winMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        for(let w=0; w<30; w++) {
            const win = new THREE.Mesh(winGeo, winMat);
            
            // Random face (0: front, 1: back, 2: left, 3: right)
            const face = Math.floor(Math.random() * 4);
            const rx = (Math.random() - 0.5) * 6;
            const ry = (Math.random() - 0.5) * 16;
            
            if (face === 0) { win.position.set(rx, ry, 4.01); }
            else if (face === 1) { win.position.set(rx, ry, -4.01); win.rotation.y = Math.PI; }
            else if (face === 2) { win.position.set(4.01, ry, rx); win.rotation.y = Math.PI/2; }
            else if (face === 3) { win.position.set(-4.01, ry, rx); win.rotation.y = -Math.PI/2; }
            
            mountain.add(win);
        }

        // Gato Jazz (Cat) en la cima
        const catGroup = new THREE.Group();
        const catMat = new THREE.MeshStandardMaterial({ color: 0x000000 }); // Black cat
        const catBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.8), catMat);
        
        const catHead = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), catMat);
        catHead.position.set(0, 0.8, 0.2);
        
        const earL = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4), catMat);
        earL.position.set(-0.2, 0.4, 0);
        const earR = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4), catMat);
        earR.position.set(0.2, 0.4, 0);
        catHead.add(earL); catHead.add(earR);
        
        // Gafas de sol
        const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        glasses.position.set(0, 0, 0.31);
        catHead.add(glasses);
        
        // Trompeta/Saxofón de oro
        const sax = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.15, 0.8), new THREE.MeshStandardMaterial({ color: 0xffd700 }));
        sax.position.set(0, 0.4, 0.6);
        sax.rotation.x = Math.PI / 4;
        catBody.add(sax);
        
        catGroup.add(catBody);
        catGroup.add(catHead);
        catGroup.position.set(0, 10.5, 0);
        mountain.add(catGroup);

        // Character 3D Preview (Center Screen)
        const characters = [
            { id: 'synth', name: 'Sintetizador Guerrero', color: 0x00ffff },
            { id: 'rock', name: 'Rockero Eléctrico', color: 0xff4500 },
            { id: 'singer', name: 'Cantante Pop', color: 0xff69b4 },
            { id: 'jazz', name: 'Trompetista Jazz', color: 0xffd700 },
            { id: 'pianist', name: 'Pianista Elegante', color: 0xaaaaaa }
        ];
        let currentCharIndex = 0;
        let selectedChar = characters[0].id;
        
        const previewGroup = new THREE.Group();
        scene.add(previewGroup);
        // Place character right in front of camera (camera is at z=15, y=5).
        previewGroup.position.set(0, 4.5, 9); 
        
        const previewLight = new THREE.PointLight(0xffffff, 2.5, 15);
        previewLight.position.set(0, 6, 11);
        scene.add(previewLight);
        
        // --- 3D UI SYSTEM ---
        const uiGroup = new THREE.Group();
        scene.add(uiGroup);
        
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const interactiveObjects = [];
        
        function create3DButton(text, w, h, x, y, z, action, bgColor = '#8b5cf6') {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            // Background
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, 512, 128);
            
            // Border (low poly block)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 10;
            ctx.strokeRect(5, 5, 502, 118);
            
            // Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 50px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 256, 64);
            
            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter;
            
            const geo = new THREE.BoxGeometry(w, h, 0.4);
            const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            
            mesh.userData = { action: action, defaultScale: 1, isButton: true };
            uiGroup.add(mesh);
            interactiveObjects.push(mesh);
            return mesh;
        }
        
        function create3DLabel(text, w, h, x, y, z) {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            // Transparent background
            ctx.clearRect(0, 0, 512, 128);
            
            // Text shadow (Low poly effect)
            ctx.fillStyle = '#8b4513';
            ctx.font = 'bold 60px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 256 + 4, 64 + 4);
            
            // Text
            ctx.fillStyle = '#ffaa00';
            ctx.fillText(text, 256, 64);
            
            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter;
            
            const geo = new THREE.PlaneGeometry(w, h);
            const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            uiGroup.add(mesh);
            return { mesh, ctx, tex, canvas };
        }
        
        // Title Label
        const charLabel = create3DLabel('SINTETIZADOR', 4, 1, 0, 2.5, 9);
        
        // Buttons
        create3DButton('<', 1, 0.8, -2.5, 4.5, 9, () => {
            currentCharIndex = (currentCharIndex - 1 + characters.length) % characters.length;
            updateCharacterPreview();
        }, '#ffaa00');
        
        create3DButton('>', 1, 0.8, 2.5, 4.5, 9, () => {
            currentCharIndex = (currentCharIndex + 1) % characters.length;
            updateCharacterPreview();
        }, '#ffaa00');
        
        create3DButton('Nivel 1: Escalas', 3.5, 0.8, -1.9, 1.2, 9, () => {
            window.location.href = `zombie.html?mode=scales&char=${selectedChar}&t=${Date.now()}`;
        }, '#8b5cf6');
        
        create3DButton('Nivel 2: Acordes', 3.5, 0.8, 1.9, 1.2, 9, () => {
            window.location.href = `zombie.html?mode=chords&char=${selectedChar}&t=${Date.now()}`;
        }, '#10b981');
        
        const soundBtn = create3DButton('Sound: OFF', 3.5, 0.8, -1.9, 0.2, 9, async () => {
            if (!ambientSoundEnabled) {
                await audioMelody.init('muted_trumpet'); 
                await audio.init('acoustic_grand_piano'); 
                ambientSoundEnabled = true;
                
                // Update button texture
                const ctx = soundBtn.material.map.image.getContext('2d');
                ctx.fillStyle = '#3b82f6'; // Blue for ON
                ctx.fillRect(0, 0, 512, 128);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 10;
                ctx.strokeRect(5, 5, 502, 118);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 50px "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Sound: ON', 256, 64);
                soundBtn.material.map.needsUpdate = true;
                
                playCurrentChord();
            }
        }, '#444444');
        
        create3DButton('Editor de Mapa', 3.5, 0.8, 1.9, 0.2, 9, () => {
            window.location.href = `editor.html`;
        }, '#f59e0b');
        
        window.addEventListener('mousemove', (e) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
        
        window.addEventListener('click', (e) => {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(interactiveObjects, false);
            if (intersects.length > 0) {
                const btn = intersects[0].object;
                if (btn.userData.action) {
                    btn.userData.action();
                    
                    // Simple click animation
                    btn.scale.set(0.9, 0.9, 0.9);
                    setTimeout(() => btn.scale.set(1, 1, 1), 100);
                }
            }
        });
        // --- END 3D UI SYSTEM ---

        function updateCharacterPreview() {
            while(previewGroup.children.length > 0){ 
                previewGroup.remove(previewGroup.children[0]); 
            }
            
            // Update 3D Label text
            charLabel.ctx.clearRect(0, 0, 512, 128);
            charLabel.ctx.fillStyle = '#8b4513';
            charLabel.ctx.fillText(char.name.toUpperCase(), 256 + 4, 64 + 4);
            charLabel.ctx.fillStyle = '#ffaa00';
            charLabel.ctx.fillText(char.name.toUpperCase(), 256, 64);
            charLabel.tex.needsUpdate = true;
            
            const pGroup = new THREE.Group();
            
            const bodyGeo = new THREE.BoxGeometry(1, 1.5, 0.5);
            const bodyMat = new THREE.MeshStandardMaterial({ color: char.color, roughness: 0.5 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.75;
            pGroup.add(body);
            
            const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
            const headMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 1.8;
            pGroup.add(head);
            
            // Accessories
            if (char.id === 'synth') {
                const acc = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: 0xff00ff }));
                acc.position.set(0, 0.8, 0.5);
                acc.rotation.y = 0.2;
                pGroup.add(acc);
            } else if (char.id === 'rock') {
                const acc = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0xcc0000 }));
                acc.position.set(0, 0.8, 0.4);
                acc.rotation.z = Math.PI / 6;
                pGroup.add(acc);
            } else if (char.id === 'singer') {
                const acc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6), new THREE.MeshStandardMaterial({ color: 0x444444 }));
                acc.position.set(0, 1.4, 0.4);
                pGroup.add(acc);
            } else if (char.id === 'jazz') {
                const acc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.8), new THREE.MeshStandardMaterial({ color: 0xffd700 }));
                acc.position.set(0, 1.4, 0.6);
                acc.rotation.x = Math.PI / 2;
                pGroup.add(acc);
                const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111 }));
                hat.position.y = 2.2;
                pGroup.add(hat);
            } else if (char.id === 'pianist') {
                const acc = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff }));
                acc.position.set(0.2, 1.7, 0.4);
                pGroup.add(acc);
                const tie = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x000000 }));
                tie.position.set(0, 1.0, 0.26);
                pGroup.add(tie);
            }
            
            pGroup.position.y = -1.5; 
            previewGroup.add(pGroup);
        }
        updateCharacterPreview();

        // Palomas (Pigeons) negras volando
        const notes = [];
        for(let i=0; i<12; i++) {
            const pGroup = new THREE.Group();
            
            const pMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Black
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.6), pMat);
            
            const wingGeo = new THREE.BoxGeometry(0.5, 0.05, 0.3);
            const wingL = new THREE.Mesh(wingGeo, pMat);
            wingL.position.set(-0.3, 0, 0);
            
            const wingR = new THREE.Mesh(wingGeo, pMat);
            wingR.position.set(0.3, 0, 0);
            
            // Beak
            const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0xffaa00 }));
            beak.position.set(0, 0, 0.4);
            beak.rotation.x = Math.PI / 2;
            body.add(beak);
            
            pGroup.add(body);
            pGroup.add(wingL);
            pGroup.add(wingR);

            pGroup.userData = {
                radius: 5 + Math.random() * 6,
                speed: 0.01 + Math.random() * 0.02,
                angle: Math.random() * Math.PI * 2,
                yOffset: 3 + Math.random() * 8,
                wingL: wingL,
                wingR: wingR,
                flapSpeed: 0.5 + Math.random()
            };
            notes.push(pGroup);
            scene.add(pGroup);
        }

        // Sistema de Partículas (Nieve cayendo)
        const particlesGeo = new THREE.BufferGeometry();
        const particlesCount = 500;
        const posArray = new Float32Array(particlesCount * 3);
        for(let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 40; // x, y, z spread
        }
        particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particleMaterial = new THREE.PointsMaterial({ 
            size: 0.15, 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.8 
        });
        const particleMesh = new THREE.Points(particlesGeo, particleMaterial);
        scene.add(particleMesh);
        
        // Soundwaves
        const NOTE_COLORS = [0xff0000, 0xff4500, 0xffa500, 0xffd700, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0x4b0082, 0x800080, 0xff1493, 0xff69b4];
        const waves = [];
        let ambientSoundEnabled = false;
        const audio = new AudioController();       // Piano (Chords)
        const audioMelody = new AudioController(); // Trumpet (Melody)
        const midi = new MidiController();
        
        let currentKey = 0; // C=0
        let currentChordIndex = 0; // 0=II, 1=V, 2=I
        let notesPlayedInChord = 0;
        let isFirstChordPlayed = false;
        
        function getNextJazzNote() {
            const roots = [ (currentKey + 2) % 12, (currentKey + 7) % 12, currentKey ];
            const scales = [
                [0, 2, 3, 5, 7, 9, 10], // Dorian (II)
                [0, 2, 4, 5, 7, 9, 10], // Mixolydian (V)
                [0, 2, 4, 5, 7, 9, 11]  // Ionian (I)
            ];
            
            const root = roots[currentChordIndex];
            const scale = scales[currentChordIndex];
            const notePC = (root + scale[Math.floor(Math.random() * scale.length)]) % 12;
            const octave = 4 + Math.floor(Math.random() * 2);
            
            notesPlayedInChord++;
            if (notesPlayedInChord > 3) {
                notesPlayedInChord = 0;
                currentChordIndex++;
                if (currentChordIndex > 2) {
                    currentChordIndex = 0;
                    currentKey = (currentKey + 5) % 12; // Modulate down a 5th (circle of fourths)
                }
            }
            return notePC + (octave + 1) * 12;
        }

        function playCurrentChord() {
            const roots = [ (currentKey + 2) % 12, (currentKey + 7) % 12, currentKey ];
            const root = roots[currentChordIndex];
            
            // Usar voicings de 5 notas (tétrada + 9na) para que suene ultra jazzero
            let chordTones = [];
            if (currentChordIndex === 0) chordTones = [0, 3, 7, 10, 14]; // m9
            else if (currentChordIndex === 1) chordTones = [0, 4, 7, 10, 14]; // 9
            else chordTones = [0, 4, 7, 11, 14]; // maj9
            
            chordTones.forEach(interval => {
                const note = (root + interval) % 12 + 48 + (interval >= 12 ? 12 : 0); // Octave 3 (48) and Octave 4 for 9th
                audio.playNote(note, 0.8);
            });
        }

        setInterval(() => {
            if (ambientSoundEnabled && audioMelody.loaded && Math.random() < 0.6) {
                const oldChordIndex = currentChordIndex;
                const note = getNextJazzNote();
                const duration = Math.random() > 0.5 ? 0.15 : 0.3;
                
                audioMelody.playNote(note, duration);
                spawnWave(null, note);
                
                if (oldChordIndex !== currentChordIndex || !isFirstChordPlayed) {
                    playCurrentChord();
                    isFirstChordPlayed = true;
                }
            }
        }, 300);

        function spawnWave(color = null, note = null) {
            if (color === null && note !== null) {
                color = NOTE_COLORS[note % 12] || 0xffffff;
            } else if (!color) {
                const pc = Math.floor(Math.random() * 12);
                color = NOTE_COLORS[pc] || 0xffffff;
            }
            
            const points = [];
            for (let i = 0; i <= 32; i++) {
                const theta = (i / 32) * Math.PI * 2;
                points.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.8, linewidth: 2 });
            const wave = new THREE.LineLoop(geo, mat);
            
            wave.position.y = 1 + Math.random() * 6;
            wave.rotation.x = (Math.random() - 0.5) * 0.4;
            wave.rotation.z = (Math.random() - 0.5) * 0.4;
            wave.scale.set(0.1, 0.1, 0.1);
            
            scene.add(wave);
            waves.push({ mesh: wave, life: 60 });
        }

        // Animación principal
        function animate() {
            requestAnimationFrame(animate);
            mountain.rotation.y += 0.002;
            
            previewGroup.rotation.y += 0.01;
            
            // Hover effect on 3D buttons
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(interactiveObjects, false);
            interactiveObjects.forEach(obj => {
                obj.scale.set(1, 1, 1);
            });
            if (intersects.length > 0) {
                document.body.style.cursor = 'pointer';
                intersects[0].object.scale.set(1.05, 1.05, 1.05);
            } else {
                document.body.style.cursor = 'default';
            }
            
            // Cat bobbing to music
            catHead.rotation.x = Math.sin(Date.now() * 0.005) * 0.1;

            notes.forEach(p => {
                p.userData.angle += p.userData.speed;
                p.position.x = Math.cos(p.userData.angle) * p.userData.radius;
                p.position.z = Math.sin(p.userData.angle) * p.userData.radius;
                p.position.y = mountain.position.y + p.userData.yOffset + Math.sin(p.userData.angle * 4) * 0.5;
                p.rotation.y = -p.userData.angle; 
                
                // Wing flap
                const flap = Math.sin(Date.now() * 0.02 * p.userData.flapSpeed) * 0.8;
                p.userData.wingL.rotation.z = flap;
                p.userData.wingR.rotation.z = -flap;
            });
            
            // Caída de la nieve
            const positions = particleMesh.geometry.attributes.position.array;
            for(let i=1; i<particlesCount*3; i+=3) {
                positions[i] -= 0.05; // y velocity
                if(positions[i] < -10) {
                    positions[i] = 20; // reset to top
                }
            }
            particleMesh.geometry.attributes.position.needsUpdate = true;
            
            // Ondas de sonido
            if (Math.random() < 0.03) spawnWave();
            for (let i = waves.length - 1; i >= 0; i--) {
                const w = waves[i];
                w.life--;
                w.mesh.scale.x += 0.3;
                w.mesh.scale.z += 0.3;
                w.mesh.material.opacity = w.life / 60;
                if (w.life <= 0) {
                    scene.remove(w.mesh);
                    waves.splice(i, 1);
                }
            }

            renderer.render(scene, camera);
        }
        animate();

        // Responsive
        
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth / scaleFactor, window.innerHeight / scaleFactor, false);
        });

        // Easter Egg & Ambient Sounds
        const soundToggle = document.getElementById('ambient-sound-toggle');
        soundToggle.addEventListener('click', async () => {
            if (!audio.loaded) {
                soundToggle.textContent = 'Loading...';
                await Promise.all([
                    audio.init('acoustic_grand_piano'),
                    audioMelody.init('muted_trumpet')
                ]);
                ambientSoundEnabled = true;
                soundToggle.textContent = 'Sound: ON';
                soundToggle.style.borderColor = '#4ade80';
                
                midi.init();
                midi.onNoteOn((note) => {
                    const color = NOTE_COLORS[note % 12] || 0x00ffff;
                    spawnWave(color, note);
                });
                midi.onNoteOff((note) => {
                    if (ambientSoundEnabled) audio.stopNote(note);
                });
            } else {
                ambientSoundEnabled = !ambientSoundEnabled;
                soundToggle.textContent = ambientSoundEnabled ? 'Sound: ON' : 'Sound: OFF';
                soundToggle.style.borderColor = ambientSoundEnabled ? '#4ade80' : 'var(--border-color)';
            }
        });
        
    