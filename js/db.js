const DB_NAME = 'MinuetDB';
const DB_VERSION = 1;
const STORE_ATTEMPTS = 'attempts';

export class DBController {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Database error: ", event.target.errorCode);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create attempts table
                if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
                    const objectStore = db.createObjectStore(STORE_ATTEMPTS, { keyPath: "id", autoIncrement: true });
                    objectStore.createIndex("exercise_id", "exercise_id", { unique: false });
                    objectStore.createIndex("category", "category", { unique: false });
                }
            };
        });
    }

    async saveAttempt(attempt) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_ATTEMPTS], "readwrite");
            const store = transaction.objectStore(STORE_ATTEMPTS);
            
            const request = store.add({
                timestamp: Date.now(),
                ...attempt
            });

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getMasteryStats() {
        // Simple mastery derivation: count correct consecutive attempts in level C
        // For this MVP, we just count overall correct attempts for UI visualization
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_ATTEMPTS], "readonly");
            const store = transaction.objectStore(STORE_ATTEMPTS);
            const request = store.getAll();

            request.onsuccess = (event) => {
                const attempts = event.target.result;
                const stats = {};
                
                // Sort by timestamp
                attempts.sort((a, b) => a.timestamp - b.timestamp);

                for (const attempt of attempts) {
                    if (!stats[attempt.exercise_id]) {
                        stats[attempt.exercise_id] = { correctCount: 0, consecutiveC: 0 };
                    }
                    
                    if (attempt.correct) {
                        stats[attempt.exercise_id].correctCount++;
                        if (attempt.help_level === 'C') {
                            stats[attempt.exercise_id].consecutiveC++;
                        }
                    } else {
                        if (attempt.help_level === 'C') {
                            stats[attempt.exercise_id].consecutiveC = 0; // Reset streak
                        }
                    }
                }
                resolve(stats);
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }
}
