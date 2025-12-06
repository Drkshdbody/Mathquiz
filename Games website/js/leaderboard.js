/*
 * ══════════════════════════════════════════════════════════════
 * LEADERBOARD SYSTEM
 * Math Quest Online - Grade & Overall Ladders
 * ══════════════════════════════════════════════════════════════
 */

const Leaderboard = {
    currentTab: 'all',
    ladder: 'grade', // 'grade' or 'overall'
    
    cache: {
        all: [],
        daily: [],
        weekly: []
    },
    
    init: function() {
        this.loadFromFirebase();
        this.loadLocalScores();
    },
    
    loadFromFirebase: function() {
        if (!DB.isConnected()) {
            this.loadFakeData();
            return;
        }
        
        DB.leaderboard().orderByChild('score').limitToLast(200).on('value', (snapshot) => {
            const scores = [];
            snapshot.forEach((child) => {
                scores.push({
                    id: child.key,
                    ...child.val()
                });
            });
            this.cache.all = scores.reverse();
            this.updateSidebar();
        });
    },
    
    loadFakeData: function() {
        const now = Date.now();
        this.cache.all = [
            { name: 'MathWizard',    score: 520, grade: 10, mode: 'overall', timestamp: now - 3600000 },
            { name: 'NumberNinja',   score: 485, grade: 9,  mode: 'overall', timestamp: now - 7200000 },
            { name: 'CalcMaster',    score: 460, grade: 8,  mode: 'grade',   timestamp: now - 10800000 },
            { name: 'BrainStorm',    score: 445, grade: 9,  mode: 'grade',   timestamp: now - 14400000 },
            { name: 'QuickMath',     score: 430, grade: 10, mode: 'overall', timestamp: now - 18000000 },
            { name: 'ProblemSolver', score: 415, grade: 8,  mode: 'grade',   timestamp: now - 21600000 },
            { name: 'MathGenius',    score: 400, grade: 9,  mode: 'overall', timestamp: now - 25200000 },
            { name: 'NumCruncher',   score: 385, grade: 8,  mode: 'grade',   timestamp: now - 28800000 },
            { name: 'EquationKing',  score: 370, grade: 10, mode: 'grade',   timestamp: now - 32400000 },
            { name: 'AlgebraAce',    score: 355, grade: 9,  mode: 'overall', timestamp: now - 36000000 }
        ];
        
        this.cache.daily = this.cache.all.slice(0, 5);
        this.cache.weekly = this.cache.all.slice(0, 7);
        
        this.updateSidebar();
    },
    
    loadLocalScores: function() {
        const localScores = Utils.loadLocal('mathquest_scores', []);
        localScores.forEach(score => {
            if (!this.cache.all.find(s => s.id === score.id)) {
                this.cache.all.push(score);
            }
        });
        this.cache.all.sort((a, b) => b.score - a.score);
    },
    
    submitScore: function(playerName, score, stats) {
        const mode = stats.mode === 'overall' ? 'overall' : 'grade';

        const entry = {
            name: playerName,
            score: score,
            correct: stats.correct,
            accuracy: stats.accuracy,
            streak: stats.bestStreak,
            difficulty: stats.difficulty,
            grade: stats.grade || (Game.state && Game.state.grade) || null,
            mode: mode,
            timestamp: Date.now()
        };
        
        if (DB.isConnected()) {
            const scoreRef = DB.leaderboard().push();
            entry.id = scoreRef.key;
            scoreRef.set(entry);
        } else {
            entry.id = 'local_' + Date.now();
        }
        
        const localScores = Utils.loadLocal('mathquest_scores', []);
        localScores.push(entry);
        localScores.sort((a, b) => b.score - a.score);
        Utils.saveLocal('mathquest_scores', localScores.slice(0, 50));
        
        this.cache.all.push(entry);
        this.cache.all.sort((a, b) => b.score - a.score);
        
        return this.getPlayerRank(playerName, mode);
    },
    
    // ladder: 'grade' or 'overall'
    getPlayerRank: function(playerName, ladder = 'grade') {
        let data = this.cache.all.slice();

        if (ladder === 'grade') {
            if (!Game.state || !Game.state.grade) return null;
            const g = Game.state.grade;
            data = data.filter(s => s.mode === 'grade' && s.grade === g);
        } else if (ladder === 'overall') {
            data = data.filter(s => s.mode === 'overall');
        }

        if (data.length === 0) return null;

        data.sort((a, b) => b.score - a.score);

        const index = data.findIndex(s => s.name === playerName);
        return index !== -1 ? index + 1 : null;
    },
    
    show: function() {
        Game.showScreen('screen-leaderboard');
        this.render();
    },

    setLadder: function(ladder, btnEl) {
        this.ladder = ladder === 'overall' ? 'overall' : 'grade';
        document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
        this.render();
    },
    
    switchTab: function(tab, btnEl) {
        this.currentTab = tab;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (btnEl) btnEl.classList.add('active');
        
        this.render();
    },
    
    render: function() {
        const container = document.getElementById('leaderboardList');
        if (!container) return;
        
        let data = this.cache.all.slice();
        const now = Date.now();

        if (this.ladder === 'grade') {
            if (Game.state && Game.state.grade) {
                const g = Game.state.grade;
                data = data.filter(s => s.mode === 'grade' && s.grade === g);
            } else {
                data = data.filter(s => s.mode === 'grade');
            }
        } else if (this.ladder === 'overall') {
            data = data.filter(s => s.mode === 'overall');
        }

        if (this.currentTab === 'daily') {
            data = data.filter(s => now - s.timestamp < 86400000);
        } else if (this.currentTab === 'weekly') {
            data = data.filter(s => now - s.timestamp < 604800000);
        }

        if (data.length === 0) {
            container.innerHTML = '<p class="no-rooms">No scores yet. Be the first!</p>';
            return;
        }

        data.sort((a, b) => b.score - a.score);
        
        const playerName = Game.state.playerName;
        
        container.innerHTML = data.slice(0, 50).map((entry, index) => {
            const rank = index + 1;
            const isYou = entry.name === playerName;
            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'normal';
            const isTop3 = rank <= 3;
            
            return `
                <div class="leaderboard-item ${isYou ? 'you' : ''} ${isTop3 ? 'top3' : ''}">
                    <div class="rank ${rankClass}">${rank}</div>
                    <div class="player-info-lb">
                        <div class="player-name-lb">
                            ${entry.name} ${isYou ? '(You)' : ''}
                            <button class="btn-profile-mini" onclick="Profile.view('${entry.name}')">
                                <i class="fas fa-id-card"></i>
                            </button>
                            ${entry.grade ? `<span style="font-size:0.75rem;color:#aaa;"> (G${entry.grade})</span>` : ''}
                            ${entry.mode === 'overall' ? `<span style="font-size:0.7rem;color:#4cf;"> [Overall]</span>` : ''}
                        </div>
                        <div class="player-date">${Utils.formatDate(entry.timestamp)}</div>
                    </div>
                    <div class="player-score-lb">${Utils.formatNumber(entry.score)}</div>
                </div>
            `;
        }).join('');
    },
    
    updateSidebar: function() {
        const container = document.getElementById('sidebarLeaderboard');
        if (!container) return;
        
        let data = this.cache.all.slice();

        if (Game.state && Game.state.grade) {
            const g = Game.state.grade;
            data = data.filter(e => e.mode === 'grade' && e.grade === g);
        } else {
            data = data.filter(e => e.mode === 'grade');
        }

        data.sort((a, b) => b.score - a.score);
        data = data.slice(0, 5);

        const playerName = Game.state.playerName;
        
        if (data.length === 0) {
            container.innerHTML = '<p class="no-players">No scores yet</p>';
            return;
        }
        
        container.innerHTML = data.map((entry, index) => {
            const rank = index + 1;
            const isYou = entry.name === playerName;
            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'normal';
            
            return `
                <div class="leaderboard-item ${isYou ? 'you' : ''}">
                    <div class="rank ${rankClass}">${rank}</div>
                    <div class="player-info-lb">
                        <div class="player-name-lb">${entry.name}</div>
                    </div>
                    <div class="player-score-lb">${entry.score}</div>
                </div>
            `;
        }).join('');
    },
    
    updateOnlinePlayers: function(players) {
        const container = document.getElementById('onlinePlayersList');
        if (!container) return;
        
        if (players.length === 0) {
            container.innerHTML = '<p class="no-players">No other players online</p>';
            return;
        }
        
        container.innerHTML = players.slice(0, 10).map(player => `
            <div class="online-player">
                <span class="status-dot"></span>
                <span>${player.name}${player.grade ? ' (G' + player.grade + ')' : ''}</span>
            </div>
        `).join('');
    }
};