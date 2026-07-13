import { MidiController } from './midi.js';
import { AudioController } from './audio.js';
import { PianoSVG } from './piano.js';
import { DBController } from './db.js';
import { TheoryEngine } from './theory.js';

class App {
    constructor() {
        this.midi = new MidiController();
        this.audio = new AudioController();
        this.piano = new PianoSVG('piano-wrapper', 48, 3); // C3 to B5
        this.db = new DBController();
        this.theory = new TheoryEngine();
        
        this.currentExercise = null;
        this.playedNotes = [];
        this.isListening = false;
        
        this.elements = {
            midiStatus: document.getElementById('midi-status'),
            categorySelect: document.getElementById('category-select'),
            exerciseSelect: document.getElementById('exercise-select'),
            btnPlayRef: document.getElementById('btn-play-ref'),
            feedbackText: document.getElementById('feedback-text'),
            progressList: document.getElementById('progress-list'),
            exerciseName: document.getElementById('current-exercise-name'),
            exerciseStructure: document.getElementById('exercise-structure')
        };
        
        this.init();
    }
    
    async init() {
        // Init Subsystems
        await this.db.init();
        await this.audio.init();
        
        this.midi.onStatusChange = (connected, inputs) => {
            if (connected && inputs && inputs.length > 0) {
                const names = inputs.map(i => i.name).join(', ');
                this.elements.midiStatus.textContent = `MIDI: ${names}`;
                this.elements.midiStatus.className = 'connected';
            } else {
                this.elements.midiStatus.textContent = 'MIDI: Disconnected';
                this.elements.midiStatus.className = '';
            }
        };
        await this.midi.init();
        
        this.setupEventListeners();
        this.loadExercises('major');
        this.updateProgressView();
    }
    
    setupEventListeners() {
        this.elements.categorySelect.addEventListener('change', (e) => {
            this.loadExercises(e.target.value);
        });
        
        this.elements.exerciseSelect.addEventListener('change', (e) => {
            this.startExercise(e.target.value);
        });
        
        this.elements.btnPlayRef.addEventListener('click', () => {
            this.playReference();
        });
        
        this.midi.onNoteOn((note, velocity) => {
            this.audio.playNote(note); // Reproducir sonido
            if (this.isListening) {
                this.piano.setKeyState(note, 'active');
                this.handleNotePlayed(note);
            }
        });
        
        this.midi.onNoteOff((note) => {
            this.audio.stopNote(note); // Detener sonido
            // Only clear visual state if it's currently active (not correct/wrong)
            if (this.isListening) {
                const keyRect = this.piano.keys[note];
                if (keyRect && keyRect.classList.contains('active')) {
                    this.piano.setKeyState(note, null);
                }
            }
        });
    }
    
    loadExercises(categoryId) {
        const exercises = this.theory.getExercises(categoryId);
        this.elements.exerciseSelect.innerHTML = '<option value="">-- Select Exercise --</option>';
        
        exercises.forEach(ex => {
            const option = document.createElement('option');
            option.value = ex.id;
            option.textContent = ex.name;
            // attach full exercise data to the option
            option.dataset.exercise = JSON.stringify(ex);
            this.elements.exerciseSelect.appendChild(option);
        });
    }
    
    startExercise(exerciseId) {
        if (!exerciseId) {
            this.currentExercise = null;
            this.isListening = false;
            this.elements.exerciseName.textContent = 'Select an exercise';
            this.elements.exerciseStructure.classList.remove('visible');
            return;
        }
        
        const option = this.elements.exerciseSelect.querySelector(`option[value="${exerciseId}"]`);
        const baseExercise = JSON.parse(option.dataset.exercise);
        
        // Randomize direction (Ascending first or Descending first)
        const isAscendingFirst = Math.random() > 0.5;
        const asc = [...baseExercise.notes_expected_asc];
        const desc = [...asc].reverse();
        
        let expectedNotes = [];
        if (isAscendingFirst) {
            expectedNotes = [...asc, ...desc.slice(1)];
        } else {
            expectedNotes = [...desc, ...asc.slice(1)];
        }
        
        this.currentExercise = {
            ...baseExercise,
            isAscendingFirst,
            notes_expected: expectedNotes
        };
        
        this.playedNotes = [];
        this.piano.clearAllStates();
        
        const dirText = isAscendingFirst ? '(Ascending then Descending)' : '(Descending then Ascending)';
        this.elements.exerciseName.textContent = `${this.currentExercise.name} ${dirText}`;
        this.elements.exerciseStructure.textContent = this.currentExercise.structure;
        this.elements.exerciseStructure.classList.add('visible');
        
        this.elements.feedbackText.textContent = `Play the reference or start playing.`;
        
        this.isListening = true;
    }
    
    playReference() {
        if (!this.currentExercise) return;
        this.audio.playSequence(
            this.currentExercise.notes_expected,
            (note) => this.piano.setKeyState(note, 'active'),
            (note) => {
                const keyRect = this.piano.keys[note];
                if (keyRect && keyRect.classList.contains('active')) {
                    this.piano.setKeyState(note, null);
                }
            }
        );
    }
    
    async handleNotePlayed(note) {
        this.playedNotes.push(note);
        const currentIndex = this.playedNotes.length - 1;
        const expectedNotes = this.currentExercise.notes_expected;
        
        const expectedPc = expectedNotes[currentIndex] % 12;
        const playedPc = note % 12;
        
        if (expectedPc === playedPc) {
            // Correct note in the sequence
            this.piano.setKeyState(note, 'correct');
            
            // Check if the whole sequence is complete
            if (this.playedNotes.length === expectedNotes.length) {
                this.isListening = false;
                this.elements.feedbackText.textContent = 'Perfect! Sequence complete.';
                await this.saveAttempt(true);
                this.scheduleReset();
            } else {
                this.elements.feedbackText.textContent = `Correct! ${expectedNotes.length - this.playedNotes.length} notes left.`;
            }
        } else {
            // Wrong note
            this.piano.setKeyState(note, 'wrong');
            this.isListening = false;
            this.elements.feedbackText.textContent = `Wrong note. Expected pitch class ${expectedPc}, played ${playedPc}.`;
            await this.saveAttempt(false);
            this.scheduleReset();
        }
    }
    
    async saveAttempt(isCorrect) {
        const attempt = {
            category: this.currentExercise.categoryId,
            exercise_id: this.currentExercise.id,
            help_level: 'B', 
            notes_expected: this.currentExercise.notes_expected,
            notes_played: this.playedNotes,
            order_matters: this.currentExercise.order_matters,
            correct: isCorrect
        };
        await this.db.saveAttempt(attempt);
        await this.updateProgressView();
    }
    
    scheduleReset() {
        setTimeout(() => {
            this.playedNotes = [];
            this.piano.clearAllStates();
            this.elements.feedbackText.textContent = `Ready for another attempt at ${this.currentExercise.name}.`;
            this.isListening = true;
        }, 1500);
    }
    
    async updateProgressView() {
        const stats = await this.db.getMasteryStats();
        this.elements.progressList.innerHTML = '';
        
        for (const [exId, data] of Object.entries(stats)) {
            const li = document.createElement('li');
            li.innerHTML = `<span>${exId}</span> <span>✅ ${data.correctCount}</span>`;
            this.elements.progressList.appendChild(li);
        }
    }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
