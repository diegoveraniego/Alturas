const NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const CATEGORIES = {
    major: {
        id: 'major',
        name: 'Major Scales',
        order_matters: true,
        types: [
            { id: 'major', name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11, 12] }
        ]
    },
    minor: {
        id: 'minor',
        name: 'Minor Scales',
        order_matters: true,
        types: [
            { id: 'natural', name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10, 12] },
            { id: 'harmonic', name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11, 12] },
            { id: 'melodic', name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11, 12] }
        ]
    },
    diminished: {
        id: 'diminished',
        name: 'Diminished Scales',
        order_matters: true,
        types: [
            { id: 'wh', name: 'Whole-Half Diminished', intervals: [0, 2, 3, 5, 6, 8, 9, 11, 12] },
            { id: 'hw', name: 'Half-Whole Diminished', intervals: [0, 1, 3, 4, 6, 7, 9, 10, 12] }
        ]
    },
    modes: {
        id: 'modes',
        name: 'Modes (Major Scale)',
        order_matters: true,
        types: [
            { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10, 12] },
            { id: 'phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10, 12] },
            { id: 'lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11, 12] },
            { id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10, 12] },
            { id: 'locrian', name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10, 12] }
        ]
    }
};

export class TheoryEngine {
    constructor() {}

    getExercises(categoryId) {
        const cat = CATEGORIES[categoryId];
        if (!cat) return [];

        const exercises = [];
        
        for (const type of cat.types) {
            for (let i = 0; i < 12; i++) {
                const rootNoteName = NOTES[i];
                const rootMidi = 60 + i; // Start from C4 (60)
                
                const expectedNotes = type.intervals.map(interval => rootMidi + interval);
                
                exercises.push({
                    id: `${categoryId}-${type.id}-${rootNoteName}`,
                    categoryId: cat.id,
                    name: `${rootNoteName} ${type.name}`,
                    notes_expected_asc: expectedNotes,
                    order_matters: cat.order_matters,
                    structure: this.calculateStructure(type.intervals)
                });
            }
        }
        return exercises;
    }

    calculateStructure(intervals) {
        const steps = [];
        for (let i = 1; i < intervals.length; i++) {
            const diff = intervals[i] - intervals[i - 1];
            if (diff === 1) steps.push('S');
            else if (diff === 2) steps.push('T');
            else if (diff === 3) steps.push('TS');
            else steps.push(diff.toString());
        }
        return steps.join(' - ');
    }
    
    getChords() {
        const chords = [];
        
        // Major Triads (0, 4, 7)
        for (let i = 0; i < 12; i++) {
            chords.push({
                id: `maj_triad_${i}`,
                name: `${NOTES[i]} Major Triad`,
                categoryId: 'chords_major',
                base_pc: i,
                notes_expected: [
                    60 + i,
                    60 + i + 4,
                    60 + i + 7
                ]
            });
        }
        
        // Minor Triads (0, 3, 7)
        for (let i = 0; i < 12; i++) {
            chords.push({
                id: `min_triad_${i}`,
                name: `${NOTES[i]} Minor Triad`,
                categoryId: 'chords_minor',
                base_pc: i,
                notes_expected: [
                    60 + i,
                    60 + i + 3,
                    60 + i + 7
                ]
            });
        }
        return chords;
    }
    
    getTetrads() {
        const chords = [];
        
        // Major 7 (0, 4, 7, 11)
        for (let i = 0; i < 12; i++) {
            chords.push({ id: `maj7_${i}`, name: `${NOTES[i]} Maj7`, categoryId: 'chords_maj7', base_pc: i, notes_expected: [60+i, 60+i+4, 60+i+7, 60+i+11] });
        }
        
        // Minor 7 (0, 3, 7, 10)
        for (let i = 0; i < 12; i++) {
            chords.push({ id: `min7_${i}`, name: `${NOTES[i]} Min7`, categoryId: 'chords_min7', base_pc: i, notes_expected: [60+i, 60+i+3, 60+i+7, 60+i+10] });
        }
        
        // Dominant 7 (0, 4, 7, 10)
        for (let i = 0; i < 12; i++) {
            chords.push({ id: `dom7_${i}`, name: `${NOTES[i]} Dom7`, categoryId: 'chords_dom7', base_pc: i, notes_expected: [60+i, 60+i+4, 60+i+7, 60+i+10] });
        }
        
        return chords;
    }
    
    validateAttempt(playedNotes, expectedNotes, orderMatters = true) {
        if (orderMatters) {
            let correct = true;
            let feedback = '';
            
            if (playedNotes.length !== expectedNotes.length) {
                correct = false;
                feedback = `Expected ${expectedNotes.length} notes, but you played ${playedNotes.length}.`;
            } else {
                for (let i = 0; i < expectedNotes.length; i++) {
                    const expectedPc = expectedNotes[i] % 12;
                    const playedPc = playedNotes[i] % 12;
                    
                    if (expectedPc !== playedPc) {
                        correct = false;
                        feedback = `Note ${i+1} was wrong. Expected pitch class ${expectedPc}, played ${playedPc}.`;
                        break;
                    }
                }
                if (correct) {
                    feedback = 'Perfect! Sequence matches exactly.';
                }
            }
            return { correct, feedback };
        } else {
            const expectedSet = new Set(expectedNotes.map(n => n % 12));
            const playedSet = new Set(playedNotes.map(n => n % 12));
            
            const missing = [...expectedSet].filter(x => !playedSet.has(x));
            const extra = [...playedSet].filter(x => !expectedSet.has(x));
            
            if (missing.length === 0 && extra.length === 0) {
                return { correct: true, feedback: 'Correct notes!' };
            } else {
                return { 
                    correct: false, 
                    feedback: `Missing: [${missing.join(',')}] Extra: [${extra.join(',')}]`
                };
            }
        }
    }
}
