export class PianoSVG {
    constructor(containerId, startNote = 48, numOctaves = 3) {
        this.container = document.getElementById(containerId);
        this.startNote = startNote; // Default 48 = C3
        this.endNote = startNote + (numOctaves * 12) - 1; // Default 83 = B5
        
        this.whiteKeyWidth = 40;
        this.whiteKeyHeight = 150;
        this.blackKeyWidth = 24;
        this.blackKeyHeight = 90;
        
        this.svg = null;
        this.keys = {};
        
        this.render();
    }

    isBlackKey(midiNote) {
        const pc = midiNote % 12;
        return [1, 3, 6, 8, 10].includes(pc);
    }

    render() {
        let whiteKeyCount = 0;
        const whiteKeys = [];
        const blackKeys = [];

        // Pre-calculate positions
        for (let note = this.startNote; note <= this.endNote; note++) {
            if (!this.isBlackKey(note)) {
                whiteKeys.push({ note, x: whiteKeyCount * this.whiteKeyWidth });
                whiteKeyCount++;
            }
        }

        const totalWidth = whiteKeyCount * this.whiteKeyWidth;
        
        // Build black keys
        let currentWhiteIdx = 0;
        for (let note = this.startNote; note <= this.endNote; note++) {
            if (this.isBlackKey(note)) {
                // The black key is placed between currentWhiteIdx - 1 and currentWhiteIdx
                const x = (currentWhiteIdx * this.whiteKeyWidth) - (this.blackKeyWidth / 2);
                blackKeys.push({ note, x });
            } else {
                currentWhiteIdx++;
            }
        }

        // Generate SVG string
        const svgNS = "http://www.w3.org/2000/svg";
        this.svg = document.createElementNS(svgNS, "svg");
        this.svg.setAttribute("class", "piano");
        this.svg.setAttribute("width", totalWidth);
        this.svg.setAttribute("height", this.whiteKeyHeight);
        this.svg.setAttribute("viewBox", `0 0 ${totalWidth} ${this.whiteKeyHeight}`);

        // Draw white keys first
        for (const wk of whiteKeys) {
            const rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("class", "key key-white");
            rect.setAttribute("x", wk.x);
            rect.setAttribute("y", 0);
            rect.setAttribute("width", this.whiteKeyWidth);
            rect.setAttribute("height", this.whiteKeyHeight);
            rect.setAttribute("rx", 4);
            rect.setAttribute("id", `key-${wk.note}`);
            this.svg.appendChild(rect);
            this.keys[wk.note] = rect;
        }

        // Draw black keys on top
        for (const bk of blackKeys) {
            const rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("class", "key key-black");
            rect.setAttribute("x", bk.x);
            rect.setAttribute("y", 0);
            rect.setAttribute("width", this.blackKeyWidth);
            rect.setAttribute("height", this.blackKeyHeight);
            rect.setAttribute("rx", 3);
            rect.setAttribute("id", `key-${bk.note}`);
            this.svg.appendChild(rect);
            this.keys[bk.note] = rect;
        }

        this.container.innerHTML = '';
        this.container.appendChild(this.svg);
    }

    setKeyState(note, stateClass) {
        const key = this.keys[note];
        if (key) {
            // Remove previous state classes
            key.classList.remove('active', 'correct', 'wrong');
            if (stateClass) {
                key.classList.add(stateClass);
            }
        }
    }

    clearAllStates() {
        for (const note in this.keys) {
            this.keys[note].classList.remove('active', 'correct', 'wrong');
        }
    }
}
