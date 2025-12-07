/*
 * ══════════════════════════════════════════════════════════════
 * UTILITY FUNCTIONS
 * Math Quest Online
 * ══════════════════════════════════════════════════════════════
 */

const Utils = {
    saveLocal(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('saveLocal failed', e);
        }
    },

    loadLocal(key, defaultValue = null) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return defaultValue;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('loadLocal failed', e);
            return defaultValue;
        }
    },

    notify(message, type = 'info', timeout = 3000) {
        const container = document.getElementById('notifications');
        if (!container) {
            console.log(`[${type}] ${message}`);
            return;
        }

        const el = document.createElement('div');
        el.className = `notification ${type}`;
        el.innerHTML = message;
        container.appendChild(el);

        setTimeout(() => {
            el.classList.add('hide');
            setTimeout(() => el.remove(), 300);
        }, timeout);
    },

    playSound(type) {
        const sounds = {
            correct: 'sounds/correct.mp3',
            wrong: 'sounds/wrong.mp3',
            win: 'sounds/win.mp3'
        };
        const src = sounds[type];
        if (!src) return;

        try {
            const audio = new Audio(src);
            audio.play().catch(() => {});
        } catch (e) {}
    },

    vibrate(pattern) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    },

    generateQuestion(difficulty, grade) {
        let max, ops;
        const g = parseInt(grade, 10) || 8;

        if (g === 8) {
            switch (difficulty) {
                case 'easy':
                    max = 20; ops = ['+', '-']; break;
                case 'medium':
                    max = 40; ops = ['+', '-']; break;
                case 'hard':
                    max = 60; ops = ['+', '-', '×']; break;
                case 'challenge':
                    max = 80; ops = ['+', '-', '×']; break;
                default:
                    max = 40; ops = ['+', '-'];
            }
        } else if (g === 9) {
            switch (difficulty) {
                case 'easy':
                    max = 25; ops = ['+', '-']; break;
                case 'medium':
                    max = 60; ops = ['+', '-', '×']; break;
                case 'hard':
                    max = 90; ops = ['+', '-', '×', '÷']; break;
                case 'challenge':
                    max = 120; ops = ['+', '-', '×', '÷']; break;
                default:
                    max = 60; ops = ['+', '-', '×'];
            }
        } else {
            switch (difficulty) {
                case 'easy':
                    max = 30; ops = ['+', '-']; break;
                case 'medium':
                    max = 80; ops = ['+', '-', '×', '÷']; break;
                case 'hard':
                    max = 140; ops = ['+', '-', '×', '÷']; break;
                case 'challenge':
                    max = 200; ops = ['+', '-', '×', '÷']; break;
                default:
                    max = 80; ops = ['+', '-', '×', '÷'];
            }
        }

        const op = ops[Math.floor(Math.random() * ops.length)];
        let a, b, answer, text;

        if (op === '+') {
            a = this.randInt(1, max);
            b = this.randInt(1, max);
            answer = a + b;
            text = `${a} + ${b} = ?`;
        } else if (op === '-') {
            a = this.randInt(1, max);
            b = this.randInt(1, a);
            answer = a - b;
            text = `${a} - ${b} = ?`;
        } else if (op === '×') {
            a = this.randInt(2, Math.floor(max / 2));
            b = this.randInt(2, Math.floor(max / 2));
            answer = a * b;
            text = `${a} × ${b} = ?`;
        } else { // ÷
            const divisor = this.randInt(2, 12);
            const quotient = this.randInt(1, Math.floor(max / divisor));
            a = divisor * quotient;
            b = divisor;
            answer = quotient;
            text = `${a} ÷ ${b} = ?`;
        }

        return { text, answer };
    },

    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    getPoints(difficulty) {
        switch (difficulty) {
            case 'easy': return 10;
            case 'medium': return 20;
            case 'hard': return 30;
            case 'challenge': return 50;
            default: return 20;
        }
    },

    getGrade(accuracy) {
        let grade, cssClass;

        if (accuracy >= 90) {
            grade = 'A+'; cssClass = 'grade-a';
        } else if (accuracy >= 80) {
            grade = 'A'; cssClass = 'grade-a';
        } else if (accuracy >= 70) {
            grade = 'B'; cssClass = 'grade-b';
        } else if (accuracy >= 60) {
            grade = 'C'; cssClass = 'grade-c';
        } else if (accuracy >= 40) {
            grade = 'D'; cssClass = 'grade-d';
        } else {
            grade = 'F'; cssClass = 'grade-f';
        }

        return { grade, class: cssClass };
    },

    formatNumber(num) {
        if (num === undefined || num === null) return '0';
        return Number(num).toLocaleString('en-US');
    },

    formatDate(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        return d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    generateRoomCode() {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    createConfetti() {
        const container = document.getElementById('confetti');
        if (!container) return;

        container.innerHTML = '';
        const pieces = 80;

        for (let i = 0; i < pieces; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.backgroundColor = ['#ff5f56', '#ffbd2e', '#00ff88'][Math.floor(Math.random() * 3)];
            piece.style.animationDelay = (Math.random() * 3) + 's';
            container.appendChild(piece);
        }

        setTimeout(() => {
            container.innerHTML = '';
        }, 4000);
    }
};
