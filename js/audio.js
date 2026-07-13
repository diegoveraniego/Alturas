import { Soundfont } from 'https://cdn.jsdelivr.net/npm/smplr/dist/index.mjs';

export class AudioController {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.instrument = null;
        this.loaded = false;
    }

    async init(instrumentName = 'lead_2_sawtooth') {
        // Load instrument
        if (this.instrument) return;
        
        try {
            this.instrument = new Soundfont(this.context, {
                instrument: instrumentName
            });
            await this.instrument.load;
            console.log("Synthesizer loaded");
            this.loaded = true;
        } catch (e) {
            console.error("Failed to load instrument", e);
        }
    }

    playNote(midiNote, duration = 0.5) {
        if (!this.loaded) return;
        this.instrument.start({
            note: midiNote,
            velocity: 80,
            duration: duration
        });
    }

    stopNote(midiNote) {
        if (!this.loaded) return;
        // The smplr stop() function can take an object with a note to stop
        this.instrument.stop({ note: midiNote });
    }

    playSequence(notes, onNoteStart, onNoteEnd, delayBetweenNotes = 0.5) {
        if (!this.loaded) return;
        
        let timeOffset = this.context.currentTime + 0.1;
        notes.forEach((note) => {
            this.instrument.start({
                note: note,
                velocity: 80,
                duration: delayBetweenNotes * 0.9,
                time: timeOffset
            });
            
            if (onNoteStart) {
                const delayMs = (timeOffset - this.context.currentTime) * 1000;
                setTimeout(() => onNoteStart(note), delayMs);
            }
            if (onNoteEnd) {
                const endDelayMs = (timeOffset + delayBetweenNotes * 0.9 - this.context.currentTime) * 1000;
                setTimeout(() => onNoteEnd(note), endDelayMs);
            }
            
            timeOffset += delayBetweenNotes;
        });
        return timeOffset - this.context.currentTime; // total duration
    }
    
    playVoiceBeep(char) {
        if (!this.context || char === ' ') return;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'square';
        
        // Randomize pitch slightly based on char code for that Animal Crossing gibberish feel
        const baseFreq = 800;
        osc.frequency.value = baseFreq + (char.charCodeAt(0) % 20) * 30 + Math.random() * 100;
        
        osc.connect(gain);
        gain.connect(this.context.destination);
        
        gain.gain.setValueAtTime(0.015, this.context.currentTime); // keep it quiet
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.05);
        
        osc.start();
        osc.stop(this.context.currentTime + 0.05);
    }
}
