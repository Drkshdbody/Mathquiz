/*
 * ══════════════════════════════════════════════════════════════
 * MAIN GAME LOGIC
 * Math Quest Online
 * Created by: Steven Jay (Deafcanthearya)
 * ══════════════════════════════════════════════════════════════
 */

const Game = {
    state: {
        playerName: '',
        grade: null,
        soloMode: 'grade',   // 'grade' ladder or 'overall' ladder
        difficulty: 'medium',
        currentQuestion: 0,
        totalQuestions: 10,
        score: 0,
        streak: 0,
        bestStreak: 0,
        correct: 0,
        wrong: 0,
        currentAnswer: 0,
        timer: null,
        timeLeft: 10,

        avatarUrl: '',
        points: 0,

        gamesPlayed: 0,
        highScore: 0,
        totalCorrect: 0,
        totalQuestionsAnswered: 0,
        allTimeStreak: 0,
        duelsWon: 0,
        allScores: []
    },
    
    init: function() {
        this.loadStats();
        Leaderboard.init();
        
        getOnlinePlayerCount((count) => {
            document.getElementById('onlineCount').textContent = count;
        });
        
        getOnlinePlayers((players) => {
            Leaderboard.updateOnlinePlayers(players);
        });

        this.showScreen('screen-welcome');

        if (typeof Auth !== 'undefined') {
            Auth.autoLogin();
        }
    },

    setAccount: function(account) {
        this.state.playerName = account.username;
        this.state.grade = account.grade;
        this.state.avatarUrl = account.avatarUrl || '';
        this.state.points = account.points || 0;

        document.getElementById('welcomeName').textContent = account.username;

        const rank = Leaderboard.getPlayerRank(account.username, 'grade');
        document.getElementById('playerRank').textContent = rank ? `#${rank}` : '#--';

        setupOnlinePresence(account.username, account.grade);
    },

    addPoints: function(amount) {
        this.state.points = (this.state.points || 0) + amount;
        if (amount > 0) {
            Utils.notify(`+${amount} points added!`, 'success');
        } else if (amount < 0) {
            Utils.notify(`${-amount} points spent.`, 'info');
        }

        if (DB.isConnected() && this.state.playerName) {
            const key = this.state.playerName.toLowerCase();
            DB.accounts().child(key).child('points').set(this.state.points);
        }
    },

    chooseSoloMode: function(mode) {
        if (mode !== 'grade' && mode !== 'overall') mode = 'grade';
        this.state.soloMode = mode;
        this.showScreen('screen-mode');
    },
    
    showScreen: function(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) screen.classList.add('active');
    },
    
    selectDifficulty: function(difficulty) {
        this.state.difficulty = difficulty;
        this.state.currentQuestion = 0;
        this.state.score = 0;
        this.state.streak = 0;
        this.state.bestStreak = 0;
        this.state.correct = 0;
        this.state.wrong = 0;
        
        document.getElementById('currentDifficulty').textContent = 
            difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        document.getElementById('currentScore').textContent = '0';
        document.getElementById('currentStreak').textContent = '0 🔥';
        document.getElementById('progressFill').style.width = '0%';
        
        document.getElementById('timerDisplay').style.display = 
            difficulty === 'challenge' ? 'block' : 'none';
        
        this.showScreen('screen-playing');
        this.nextQuestion();
    },
    
    nextQuestion: function() {
        this.state.currentQuestion++;
        
        if (this.state.currentQuestion > this.state.totalQuestions) {
            this.endGame();
            return;
        }
        
        const question = Utils.generateQuestion(this.state.difficulty, this.state.grade);
        this.state.currentAnswer = question.answer;
        
        document.getElementById('questionNum').textContent = this.state.currentQuestion;
        document.getElementById('currentQuestion').textContent = 
            `${this.state.currentQuestion}/${this.state.totalQuestions}`;
        document.getElementById('questionText').textContent = question.text;
        document.getElementById('answerInput').value = '';
        document.getElementById('answerInput').focus();
        
        const feedback = document.getElementById('feedback');
        feedback.style.display = 'none';
        feedback.className = 'feedback';
        
        const progress = ((this.state.currentQuestion - 1) / this.state.totalQuestions) * 100;
        document.getElementById('progressFill').style.width = progress + '%';
        
        if (this.state.difficulty === 'challenge') {
            this.startTimer();
        }
    },
    
    startTimer: function() {
        clearInterval(this.state.timer);
        this.state.timeLeft = 10;
        
        const timerEl = document.getElementById('timerValue');
        const timerDisplay = document.getElementById('timerDisplay');
        timerEl.textContent = this.state.timeLeft;
        timerDisplay.classList.remove('danger');
        
        this.state.timer = setInterval(() => {
            this.state.timeLeft--;
            timerEl.textContent = this.state.timeLeft;
            
            if (this.state.timeLeft <= 3) {
                timerDisplay.classList.add('danger');
            }
            
            if (this.state.timeLeft <= 0) {
                clearInterval(this.state.timer);
                this.submitAnswer(true);
            }
        }, 1000);
    },
    
    submitAnswer: function(timeout = false) {
        clearInterval(this.state.timer);
        
        const userAnswer = parseInt(document.getElementById('answerInput').value);
        const feedback = document.getElementById('feedback');
        const points = Utils.getPoints(this.state.difficulty);
        
        const isCorrect = !timeout && userAnswer === this.state.currentAnswer;
        
        if (isCorrect) {
            this.state.correct++;
            this.state.streak++;
            this.state.score += points;
            
            let bonusMsg = '';
            if (this.state.streak % 3 === 0) {
                this.state.score += 5;
                bonusMsg = ' <span style="color: #ffbd2e;">🔥 Streak Bonus +5!</span>';
            }
            
            if (this.state.streak > this.state.bestStreak) {
                this.state.bestStreak = this.state.streak;
            }
            
            feedback.innerHTML = `✅ Correct! +${points} pts${bonusMsg}`;
            feedback.className = 'feedback correct show';
            
            Utils.playSound('correct');
            Utils.vibrate(50);
        } else {
            this.state.wrong++;
            this.state.streak = 0;
            
            if (timeout) {
                feedback.innerHTML = `⏱️ Time's up! Answer: ${this.state.currentAnswer}`;
            } else {
                feedback.innerHTML = `❌ Wrong! Answer: ${this.state.currentAnswer}`;
            }
            feedback.className = 'feedback wrong show';
            
            Utils.playSound('wrong');
            Utils.vibrate([50, 50, 50]);
        }
        
        feedback.style.display = 'block';
        
        document.getElementById('currentScore').textContent = this.state.score;
        document.getElementById('currentStreak').textContent = this.state.streak + ' 🔥';
        
        setTimeout(() => {
            this.nextQuestion();
        }, 1500);
    },
    
    endGame: function() {
        clearInterval(this.state.timer);
        document.getElementById('timerDisplay').style.display = 'none';
        
        const accuracy = Math.round((this.state.correct / this.state.totalQuestions) * 100);
        const gradeInfo = Utils.getGrade(accuracy);
        
        const isNewHighScore = this.state.score > this.state.highScore;
        
        if (isNewHighScore) {
            this.state.highScore = this.state.score;
        }
        
        if (this.state.bestStreak > this.state.allTimeStreak) {
            this.state.allTimeStreak = this.state.bestStreak;
        }
        
        this.state.gamesPlayed++;
        this.state.totalCorrect += this.state.correct;
        this.state.totalQuestionsAnswered += this.state.totalQuestions;
        this.state.allScores.push(this.state.score);
        
        const earnedPoints = Math.max(5, Math.floor(this.state.score / 10));
        this.addPoints(earnedPoints);

        this.saveStats();
        
        const ladder = this.state.soloMode === 'overall' ? 'overall' : 'grade';

        const oldRank = Leaderboard.getPlayerRank(this.state.playerName, ladder);
        const newRank = Leaderboard.submitScore(this.state.playerName, this.state.score, {
            correct: this.state.correct,
            accuracy: accuracy,
            bestStreak: this.state.bestStreak,
            difficulty: this.state.difficulty,
            grade: this.state.grade,
            mode: ladder
        });
        
        document.getElementById('finalScore').textContent = Utils.formatNumber(this.state.score);
        document.getElementById('finalGrade').textContent = gradeInfo.grade;
        document.getElementById('finalGrade').className = 'grade ' + gradeInfo.class;
        document.getElementById('resultCorrect').textContent = `${this.state.correct}/${this.state.totalQuestions}`;
        document.getElementById('resultAccuracy').textContent = accuracy + '%';
        document.getElementById('resultStreak').textContent = this.state.bestStreak;
        
        const highScoreBadge = document.getElementById('newHighScore');
        if (isNewHighScore && this.state.gamesPlayed > 1) {
            highScoreBadge.classList.add('show');
            Utils.createConfetti();
        } else {
            highScoreBadge.classList.remove('show');
        }
        
        const rankChange = document.getElementById('rankChange');
        const ladderLabel = ladder === 'grade' ? 'your grade ladder' : 'overall ladder';

        if (newRank && oldRank && newRank < oldRank) {
            rankChange.innerHTML = `<i class="fas fa-arrow-up"></i> Moved up to #${newRank} in ${ladderLabel}!`;
            rankChange.className = 'rank-change up';
        } else if (newRank) {
            rankChange.innerHTML = `<i class="fas fa-medal"></i> Rank in ${ladderLabel}: #${newRank}`;
            rankChange.className = 'rank-change';
        } else {
            rankChange.innerHTML = '';
        }
        
        this.showScreen('screen-gameover');
        Utils.playSound('win');
    },
    
    showStats: function() {
        this.showScreen('screen-stats');
        
        const avgScore = this.state.allScores.length > 0 
            ? Math.round(this.state.allScores.reduce((a, b) => a + b, 0) / this.state.allScores.length)
            : 0;
        
        const avgAccuracy = this.state.totalQuestionsAnswered > 0
            ? Math.round((this.state.totalCorrect / this.state.totalQuestionsAnswered) * 100)
            : 0;
        
        document.getElementById('statGames').textContent = this.state.gamesPlayed;
        document.getElementById('statHighScore').textContent = Utils.formatNumber(this.state.highScore);
        document.getElementById('statAvgScore').textContent = Utils.formatNumber(avgScore);
        document.getElementById('statTotalCorrect').textContent = Utils.formatNumber(this.state.totalCorrect);
        document.getElementById('statAvgAccuracy').textContent = avgAccuracy + '%';
        document.getElementById('statBestStreak').textContent = this.state.allTimeStreak;
        document.getElementById('statDuelsWon').textContent = this.state.duelsWon || 0;
        
        const overallRank = Leaderboard.getPlayerRank(this.state.playerName, 'overall');
        document.getElementById('statGlobalRank').textContent = overallRank ? `#${overallRank}` : '#--';

        const gradeRank = Leaderboard.getPlayerRank(this.state.playerName, 'grade');
        document.getElementById('statGradeRank').textContent = gradeRank ? `#${gradeRank}` : '#--';
    },
    
    shareScore: function() {
        const text = `🎮 I scored ${this.state.score} points in Math Quest!\n` +
                     `Grade: ${this.state.grade}\n` +
                     `Mode: ${this.state.soloMode === 'overall' ? 'Overall Ladder' : 'Grade Ladder'}\n` +
                     `✅ ${this.state.correct}/10 correct (${Math.round((this.state.correct / 10) * 100)}%)\n` +
                     `🔥 Best streak: ${this.state.bestStreak}\n` +
                     `Play now and beat my score!`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Math Quest Score',
                text: text
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text).then(() => {
                Utils.notify('Score copied to clipboard!', 'success');
            });
        }
    },
    
    saveStats: function() {
        const stats = {
            playerName: this.state.playerName,
            grade: this.state.grade,
            gamesPlayed: this.state.gamesPlayed,
            highScore: this.state.highScore,
            totalCorrect: this.state.totalCorrect,
            totalQuestionsAnswered: this.state.totalQuestionsAnswered,
            allTimeStreak: this.state.allTimeStreak,
            duelsWon: this.state.duelsWon,
            allScores: this.state.allScores.slice(-100)
        };
        
        Utils.saveLocal('mathquest_stats', stats);

        if (DB.isConnected() && this.state.playerName) {
            const key = this.state.playerName.toLowerCase();
            DB.accounts().child(key).child('stats').update({
                highScore: this.state.highScore,
                gamesPlayed: this.state.gamesPlayed,
                duelsWon: this.state.duelsWon,
                allTimeStreak: this.state.allTimeStreak
            });
        }
    },
    
    loadStats: function() {
        const stats = Utils.loadLocal('mathquest_stats', {});
        
        this.state.gamesPlayed = stats.gamesPlayed || 0;
        this.state.highScore = stats.highScore || 0;
        this.state.totalCorrect = stats.totalCorrect || 0;
        this.state.totalQuestionsAnswered = stats.totalQuestionsAnswered || 0;
        this.state.allTimeStreak = stats.allTimeStreak || 0;
        this.state.duelsWon = stats.duelsWon || 0;
        this.state.allScores = stats.allScores || [];
        
        if (stats.playerName) {
            this.state.playerName = stats.playerName;
        }
        if (stats.grade) {
            this.state.grade = stats.grade;
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    Game.init();
});

function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('show-mobile');
}