const KEY_MAP = {
    // Lower Octave (C3 to E4)
    'z': 48, 's': 49, 'x': 50, 'd': 51, 'c': 52, 'v': 53, 'g': 54, 'b': 55, 'h': 56, 'n': 57, 'j': 58, 'm': 59,
    ',': 60, 'l': 61, '.': 62, ';': 63, '/': 64,
    // Upper Octave (C4 to G5)
    'q': 60, '2': 61, 'w': 62, '3': 63, 'e': 64, 'r': 65, '5': 66, 't': 67, '6': 68, 'y': 69, '7': 70, 'u': 71,
    'i': 72, '9': 73, 'o': 74, '0': 75, 'p': 76, '[': 77, '=': 78, ']': 79
};

export class MidiController {
    constructor() {
        this.midiAccess = null;
        this.inputs = [];
        this.noteOnCallback = null;
        this.noteOffCallback = null;
        this.activeKeys = new Set();
        this.activeMidiNotes = new Set();
    }

    async init() {
        this.setupKeyboard(); // Initialize computer keyboard support fallback
        
        if (navigator.requestMIDIAccess) {
            try {
                this.midiAccess = await navigator.requestMIDIAccess();
                this.updateInputs();
                
                this.midiAccess.onstatechange = (e) => {
                    this.updateInputs();
                    if (this.onStatusChange) {
                        this.onStatusChange(this.inputs.length > 0, this.inputs);
                    }
                };
                
                // Initial call if already connected
                if (this.onStatusChange) {
                    this.onStatusChange(this.inputs.length > 0, this.inputs);
                }
                
                return this.inputs.length > 0;
            } catch (err) {
                console.error('MIDI Access denied or not supported', err);
                return false;
            }
        } else {
            console.error('Web MIDI API is not supported in this browser.');
            return false;
        }
    }

    updateInputs() {
        this.inputs = Array.from(this.midiAccess.inputs.values());
        for (let input of this.inputs) {
            input.onmidimessage = this.handleMidiMessage.bind(this);
        }
    }

    handleMidiMessage(message) {
        const command = message.data[0] >> 4;
        const channel = message.data[0] & 0xf;
        const note = message.data[1];
        const velocity = (message.data.length > 2) ? message.data[2] : 0;

        // Note On
        if (command === 9 && velocity > 0) {
            this.activeMidiNotes.add(note);
            if (this.noteOnCallback) this.noteOnCallback(note, velocity);
        }
        // Note Off
        else if (command === 8 || (command === 9 && velocity === 0)) {
            this.activeMidiNotes.delete(note);
            if (this.noteOffCallback) this.noteOffCallback(note);
        }
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            // Support QWERTY as piano keys
            const key = e.key.toLowerCase();
            const note = KEY_MAP[key];
            if (note !== undefined) {
                this.activeKeys.add(key);
                this.activeMidiNotes.add(note);
                if (this.noteOnCallback) this.noteOnCallback(note, 80);
            }
        });
        
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            const note = KEY_MAP[key];
            if (note !== undefined) {
                this.activeKeys.delete(key);
                this.activeMidiNotes.delete(note);
                if (this.noteOffCallback) this.noteOffCallback(note);
            }
        });
    }

    onNoteOn(callback) {
        this.noteOnCallback = callback;
    }

    onNoteOff(callback) {
        this.noteOffCallback = callback;
    }
}
