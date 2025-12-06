/*
 * ══════════════════════════════════════════════════════════════
 * DUEL SYSTEM
 * Math Quest Online - Real-time Multiplayer Battles
 *  - Infinite questions
 *  - Difficulty increases as rounds go up
 *  - 3 lives per player
 * ══════════════════════════════════════════════════════════════
 */

const Duel = {
    state: {
        roomId: null,
        isHost: false,
        opponentName: 'Opponent',
        opponentId: null,

        round: 0,               // number of questions asked
        playerScore: 0,
        opponentScore: 0,
        playerCorrect: 0,
        playerStreak: 0,
        playerBestStreak: 0,

        playerLives: 3,
        opponentLives: 3,

        currentQuestion: null,
        currentAnswer: null,
        answered: false,
        opponentAnswered: false,

        timer: null,
        timeLeft: 10,

        isBot: false,
        botDifficulty: 'medium',

        buffDoublePoints: false,
        buffShield: false
    },

    roomListener: null,

    /* ─────────────────────────────────────────────────────
       Lobby / Rooms
       ───────────────────────────────────────────────────── */

    showLobby: function() {
        Game.showScreen('screen-duel-lobby');
        this.loadActiveRooms();
    },

    loadActiveRooms: function() {
        if (!DB.isConnected()) {
            this.showFakeRooms();
            return;
        }

        DB.duelRooms()
            .orderByChild('status')
            .equalTo('waiting')
            .on('value', (snapshot) => {
                const rooms = [];
                snapshot.forEach((child) => {
                    const room = child.val();
                    if (room.hostId !== PLAYER_ID) {
                        rooms.push({
                            id: child.key,
                            ...room
                        });
                    }
                });
                this.renderRooms(rooms);
            });
    },

    showFakeRooms: function() {
        const rooms = [
            { id: 'fake1', hostName: 'MathWizard', createdAt: Date.now() - 30000 },
            { id: 'fake2', hostName: 'NumberNinja', createdAt: Date.now() - 60000 }
        ];
        this.renderRooms(rooms);
    },

    renderRooms: function(rooms) {
        const container = document.getElementById('roomsList');
        if (!container) return;

        if (rooms.length === 0) {
            container.innerHTML = '<p class="no-rooms">No active rooms. Create one!</p>';
            return;
        }

        container.innerHTML = rooms.map(room => `
            <div class="room-item">
                <div>
                    <strong>${room.hostName}</strong>
                    <span style="color: #888; font-size: 0.8rem;">
                        - ${Utils.formatDate(room.createdAt)}
                    </span>
                </div>
                <button class="btn-game btn-primary"
                        style="padding: 0.5rem 1rem; font-size: 0.85rem;"
                        onclick="Duel.joinExistingRoom('${room.id}')">
                    Join
                </button>
            </div>
        `).join('');
    },

    /* ─────────────────────────────────────────────────────
       Matchmaking
       ───────────────────────────────────────────────────── */

    findMatch: function() {
        Game.showScreen('screen-waiting');
        document.getElementById('waitingTitle').textContent = 'Finding Opponent...';
        document.getElementById('waitingSubtitle').textContent = 'Please wait while we match you';
        document.getElementById('roomCodeDisplay').style.display = 'none';

        if (!DB.isConnected()) {
            setTimeout(() => {
                Utils.notify('No players found. Playing vs Computer!', 'warning');
                this.playBot();
            }, 3000);
            return;
        }

        // Put this player in matchmaking queue
        const queueRef = DB.matchmaking().child(PLAYER_ID);
        queueRef.set({
            name: Game.state.playerName,
            grade: Game.state.grade || null,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        queueRef.onDisconnect().remove();

        DB.matchmaking().once('value', (snapshot) => {
            let opponent = null;

            snapshot.forEach((child) => {
                if (child.key !== PLAYER_ID) {
                    opponent = {
                        id: child.key,
                        ...child.val()
                    };
                    return true;
                }
            });

            if (opponent) {
                this.createMatchRoom(opponent);
            } else {
                this.waitForOpponent(queueRef);
            }
        });
    },

    waitForOpponent: function(queueRef) {
        const timeout = setTimeout(() => {
            queueRef.remove();
            Utils.notify('No players found. Playing vs Computer!', 'warning');
            this.playBot();
        }, 30000);

        DB.matchmaking().on('child_added', (snapshot) => {
            if (snapshot.key !== PLAYER_ID) {
                clearTimeout(timeout);
                DB.matchmaking().off('child_added');
                queueRef.remove();

                const opponent = {
                    id: snapshot.key,
                    ...snapshot.val()
                };

                this.createMatchRoom(opponent);
            }
        });
    },

    createMatchRoom: function(opponent) {
        const roomId = Utils.generateRoomCode();

        this.state.roomId = roomId;
        this.state.isHost = true;
        this.state.opponentName = opponent.name;
        this.state.opponentId = opponent.id;
        this.state.isBot = false;

        DB.duelRoom(roomId).set({
            hostId: PLAYER_ID,
            hostName: Game.state.playerName,
            guestId: opponent.id,
            guestName: opponent.name,
            status: 'playing',
            round: 0,
            hostScore: 0,
            guestScore: 0,
            hostLives: 3,
            guestLives: 3,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });

        DB.matchmaking().child(opponent.id).remove();

        this.listenToRoom(roomId);
        this.startDuel();
    },

    /* ─────────────────────────────────────────────────────
       Private rooms
       ───────────────────────────────────────────────────── */

    createPrivate: function() {
        const roomCode = Utils.generateRoomCode();

        Game.showScreen('screen-waiting');
        document.getElementById('waitingTitle').textContent = 'Waiting for Friend...';
        document.getElementById('waitingSubtitle').textContent = 'Share the code below';
        document.getElementById('roomCodeDisplay').style.display = 'block';
        document.getElementById('roomCode').textContent = roomCode;

        this.state.roomId = roomCode;
        this.state.isHost = true;
        this.state.isBot = false;

        if (!DB.isConnected()) {
            Utils.notify('Multiplayer requires Firebase. Playing vs Computer!', 'warning');
            setTimeout(() => this.playBot(), 2000);
            return;
        }

        DB.duelRoom(roomCode).set({
            hostId: PLAYER_ID,
            hostName: Game.state.playerName,
            status: 'waiting',
            private: true,
            hostLives: 3,
            guestLives: 3,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });

        DB.duelRoom(roomCode).onDisconnect().remove();

        DB.duelRoom(roomCode).on('value', (snapshot) => {
            const room = snapshot.val();
            if (room && room.guestId && room.status === 'ready') {
                this.state.opponentName = room.guestName;
                this.state.opponentId = room.guestId;

                DB.duelRoom(roomCode).update({ status: 'playing' });

                this.listenToRoom(roomCode);
                this.startDuel();
            }
        });
    },

    copyRoomCode: function() {
        const code = document.getElementById('roomCode').textContent;
        navigator.clipboard.writeText(code).then(() => {
            Utils.notify('Room code copied!', 'success');
        });
    },

    showJoinRoom: function() {
        Game.showScreen('screen-join-room');
        document.getElementById('joinRoomCode').value = '';
        document.getElementById('joinError').textContent = '';
    },

    joinRoom: function() {
        const code = document.getElementById('joinRoomCode').value.toUpperCase().trim();

        if (code.length !== 4) {
            document.getElementById('joinError').textContent = 'Please enter a 4-character code';
            return;
        }

        if (!DB.isConnected()) {
            document.getElementById('joinError').textContent = 'Multiplayer requires server connection';
            return;
        }

        DB.duelRoom(code).once('value', (snapshot) => {
            const room = snapshot.val();

            if (!room) {
                document.getElementById('joinError').textContent = 'Room not found';
                return;
            }

            if (room.status !== 'waiting') {
                document.getElementById('joinError').textContent = 'Room is no longer available';
                return;
            }

            this.state.roomId = code;
            this.state.isHost = false;
            this.state.opponentName = room.hostName;
            this.state.opponentId = room.hostId;
            this.state.isBot = false;

            DB.duelRoom(code).update({
                guestId: PLAYER_ID,
                guestName: Game.state.playerName,
                status: 'ready'
            });

            this.listenToRoom(code);

            Game.showScreen('screen-waiting');
            document.getElementById('waitingTitle').textContent = 'Joining Room...';
            document.getElementById('waitingSubtitle').textContent = `Playing against ${room.hostName}`;
            document.getElementById('roomCodeDisplay').style.display = 'none';
        });
    },

    joinExistingRoom: function(roomId) {
        if (!DB.isConnected()) {
            this.playBot();
            return;
        }

        DB.duelRoom(roomId).once('value', (snapshot) => {
            const room = snapshot.val();

            if (!room || room.status !== 'waiting') {
                Utils.notify('Room no longer available', 'error');
                return;
            }

            this.state.roomId = roomId;
            this.state.isHost = false;
            this.state.opponentName = room.hostName;
            this.state.opponentId = room.hostId;
            this.state.isBot = false;

            DB.duelRoom(roomId).update({
                guestId: PLAYER_ID,
                guestName: Game.state.playerName,
                status: 'playing'
            });

            this.listenToRoom(roomId);
            this.startDuel();
        });
    },

    /* ─────────────────────────────────────────────────────
       Realtime room listener
       ───────────────────────────────────────────────────── */

    listenToRoom: function(roomId) {
        if (this.roomListener) {
            this.roomListener.off();
        }

        this.roomListener = DB.duelRoom(roomId);

        this.roomListener.on('value', (snapshot) => {
            const room = snapshot.val();
            if (!room) return;

            // Sync scores & lives
            if (this.state.isHost) {
                this.state.opponentScore = room.guestScore || 0;
                this.state.playerLives = room.hostLives != null ? room.hostLives : this.state.playerLives;
                this.state.opponentLives = room.guestLives != null ? room.guestLives : this.state.opponentLives;
            } else {
                this.state.opponentScore = room.hostScore || 0;
                this.state.playerLives = room.guestLives != null ? room.guestLives : this.state.playerLives;
                this.state.opponentLives = room.hostLives != null ? room.hostLives : this.state.opponentLives;
            }

            this.updateDuelScores();
            this.updateLivesUI();

            // Opponent answered?
            const opponentAnswered = this.state.isHost ? room.guestAnswered : room.hostAnswered;
            if (opponentAnswered && !this.state.opponentAnswered) {
                this.state.opponentAnswered = true;
                document.getElementById('opponentStatus').innerHTML =
                    '<i class="fas fa-check"></i> Opponent answered!';
            }

            // New question from host
            if (room.round > this.state.round && room.currentQuestion) {
                this.state.round = room.round;
                this.state.currentQuestion = room.currentQuestion;
                this.state.currentAnswer = room.currentAnswer;
                this.showDuelQuestion();
            }

            // Game finished
            if (room.status === 'finished') {
                this.endDuel();
            }
        });
    },

    /* ─────────────────────────────────────────────────────
       Bot / offline play
       ───────────────────────────────────────────────────── */

    playBot: function() {
        this.state.isBot = true;
        this.state.opponentName = this.getBotName();
        this.state.roomId = null;

        this.startDuel();
    },

    getBotName: function() {
        const names = [
            'MathBot',
            'CalcBot',
            'NumberBot',
            'QuizBot',
            'BrainBot',
            'SmartBot',
            'QuickBot',
            'MathAI'
        ];
        return names[Math.floor(Math.random() * names.length)];
    },

    /* ─────────────────────────────────────────────────────
       Core duel flow
       ───────────────────────────────────────────────────── */

    startDuel: function() {
        this.state.round = 0;
        this.state.playerScore = 0;
        this.state.opponentScore = 0;
        this.state.playerCorrect = 0;
        this.state.playerStreak = 0;
        this.state.playerBestStreak = 0;
        this.state.playerLives = 3;
        this.state.opponentLives = 3;
        this.state.answered = false;
        this.state.opponentAnswered = false;
        this.state.buffDoublePoints = false;
        this.state.buffShield = false;

        document.getElementById('duelPlayerName').textContent = Game.state.playerName;
        document.getElementById('duelOpponentName').textContent = this.state.opponentName;

        if (typeof Shop !== 'undefined') {
            document.getElementById('inv_time_potion').textContent = Shop.getItemCount('time_potion');
            document.getElementById('inv_double_points').textContent = Shop.getItemCount('double_points');
            document.getElementById('inv_shield').textContent = Shop.getItemCount('shield');
        }

        this.updateLivesUI();
        Game.showScreen('screen-duel');

        if (DB.isConnected() && this.state.isHost && this.state.roomId) {
            DB.duelRoom(this.state.roomId).update({
                hostLives: 3,
                guestLives: 3,
                hostScore: 0,
                guestScore: 0,
                round: 0
            });
        }

        if (this.state.isHost || this.state.isBot || !DB.isConnected()) {
            this.nextRound();
        }
    },

    // Difficulty curve by round number
    _getDifficultyForRound: function(round) {
        if (round <= 5) return 'easy';
        if (round <= 15) return 'medium';
        if (round <= 30) return 'hard';
        return 'challenge';
    },

    nextRound: function() {
        this.state.round++;
        this.state.answered = false;
        this.state.opponentAnswered = false;

        if (this.state.playerLives <= 0 || this.state.opponentLives <= 0) {
            this.endDuel();
            return;
        }

        const difficulty = this._getDifficultyForRound(this.state.round);
        const question = Utils.generateQuestion(difficulty, Game.state.grade);
        this.state.currentQuestion = question;
        this.state.currentAnswer = question.answer;

        if (DB.isConnected() && this.state.isHost && this.state.roomId) {
            DB.duelRoom(this.state.roomId).update({
                round: this.state.round,
                currentQuestion: question,
                currentAnswer: question.answer,
                hostAnswered: false,
                guestAnswered: false
            });
        }

        this.showDuelQuestion();
    },

    showDuelQuestion: function() {
        Game.showScreen('screen-duel');

        this.state.answered = false;
        this.state.opponentAnswered = false;

        if (!this.state.currentQuestion) return;

        document.getElementById('duelRound').textContent = this.state.round;
        document.getElementById('duelQuestion').textContent = this.state.currentQuestion.text;
        document.getElementById('duelAnswer').value = '';
        document.getElementById('duelAnswer').focus();
        document.getElementById('duelFeedback').style.display = 'none';
        document.getElementById('duelFeedback').className = 'feedback';
        document.getElementById('opponentStatus').innerHTML =
            '<i class="fas fa-pencil-alt"></i> Opponent is answering...';

        this.updateDuelScores();
        this.updateLivesUI();
        this.startDuelTimer();

        if (this.state.isBot) {
            this.scheduleBotAnswer();
        }
    },

    startDuelTimer: function() {
        clearInterval(this.state.timer);
        this.state.timeLeft = 10;

        const timerEl = document.getElementById('duelTimeLeft');
        timerEl.textContent = this.state.timeLeft;
        timerEl.parentElement.classList.remove('danger');

        this.state.timer = setInterval(() => {
            this.state.timeLeft--;
            timerEl.textContent = this.state.timeLeft;

            if (this.state.timeLeft <= 3) {
                timerEl.parentElement.classList.add('danger');
            }

            if (this.state.timeLeft <= 0) {
                clearInterval(this.state.timer);
                if (!this.state.answered) {
                    this.submitAnswer(true);
                }
            }
        }, 1000);
    },

    scheduleBotAnswer: function() {
        const delay = 2000 + Math.random() * 4000;

        setTimeout(() => {
            if (this.state.playerLives <= 0 || this.state.opponentLives <= 0) return;
            if (this.state.opponentAnswered) return;

            const isCorrect = Math.random() < 0.7;

            if (isCorrect) {
                this.state.opponentScore += 20;
            } else {
                this.state.opponentLives--;
                this.updateLivesUI();
            }

            this.state.opponentAnswered = true;
            document.getElementById('opponentStatus').innerHTML =
                '<i class="fas fa-check"></i> Opponent answered!';
            this.updateDuelScores();

            if (this.state.playerLives <= 0 || this.state.opponentLives <= 0) {
                this.endDuel();
                return;
            }

            if (this.state.answered) {
                if (this.state.isHost || this.state.isBot || !DB.isConnected()) {
                    setTimeout(() => this.nextRound(), 1500);
                }
            }
        }, delay);
    },

    /* ─────────────────────────────────────────────────────
       Items from Shop
       ───────────────────────────────────────────────────── */

    useItem: function(id) {
        if (typeof Shop === 'undefined') return;

        if (!Shop.useItem(id)) {
            Utils.notify('You do not have this item.', 'warning');
            return;
        }

        document.getElementById('inv_time_potion').textContent = Shop.getItemCount('time_potion');
        document.getElementById('inv_double_points').textContent = Shop.getItemCount('double_points');
        document.getElementById('inv_shield').textContent = Shop.getItemCount('shield');

        if (id === 'time_potion') {
            this.state.timeLeft += 5;
            document.getElementById('duelTimeLeft').textContent = this.state.timeLeft;
            Utils.notify('+5 seconds added!', 'success');
        } else if (id === 'double_points') {
            this.state.buffDoublePoints = true;
            Utils.notify('Double points active for next correct answer!', 'success');
        } else if (id === 'shield') {
            this.state.buffShield = true;
            Utils.notify('Shield will protect you from losing a life once!', 'success');
        }
    },

    /* ─────────────────────────────────────────────────────
       Answer handling
       ───────────────────────────────────────────────────── */

    submitAnswer: function(timeout = false) {
        if (this.state.answered) return;

        clearInterval(this.state.timer);
        this.state.answered = true;

        const userAnswer = parseInt(document.getElementById('duelAnswer').value);
        const feedback = document.getElementById('duelFeedback');
        const isCorrect = !timeout && userAnswer === this.state.currentAnswer;

        if (isCorrect) {
            let gained = 20;
            if (this.state.buffDoublePoints) {
                gained += 20;
                this.state.buffDoublePoints = false;
            }
            this.state.playerScore += gained;
            this.state.playerCorrect++;
            this.state.playerStreak++;

            if (this.state.playerStreak > this.state.playerBestStreak) {
                this.state.playerBestStreak = this.state.playerStreak;
            }

            let msg = `✅ Correct! +${gained} pts`;
            if (this.state.playerStreak % 3 === 0) {
                this.state.playerScore += 5;
                msg += ' <span style="color: #ffbd2e;">🔥 +5 Bonus!</span>';
            }

            feedback.innerHTML = msg;
            feedback.className = 'feedback correct show';
        } else {
            // Wrong / timeout => life loss unless shield
            if (this.state.buffShield) {
                this.state.buffShield = false;
                feedback.innerHTML = `❌ Wrong, but your shield saved your life! Answer: ${this.state.currentAnswer}`;
            } else {
                this.state.playerLives--;
                this.state.playerStreak = 0;
                if (timeout) {
                    feedback.innerHTML = `⏱️ Time's up! You lost 1 life. Answer: ${this.state.currentAnswer}`;
                } else {
                    feedback.innerHTML = `❌ Wrong! You lost 1 life. Answer: ${this.state.currentAnswer}`;
                }
            }

            feedback.className = 'feedback wrong show';
        }

        feedback.style.display = 'block';
        this.updateDuelScores();
        this.updateLivesUI();

        if (DB.isConnected() && this.state.roomId) {
            const scoreKey = this.state.isHost ? 'hostScore' : 'guestScore';
            const livesKey = this.state.isHost ? 'hostLives' : 'guestLives';
            const answeredKey = this.state.isHost ? 'hostAnswered' : 'guestAnswered';

            DB.duelRoom(this.state.roomId).update({
                [scoreKey]: this.state.playerScore,
                [livesKey]: this.state.playerLives,
                [answeredKey]: true
            });
        }

        if ((!DB.isConnected() || this.state.isBot) &&
            (this.state.playerLives <= 0 || this.state.opponentLives <= 0)) {
            this.endDuel();
            return;
        }

        if (this.state.opponentAnswered || this.state.isBot) {
            if (this.state.playerLives <= 0 || this.state.opponentLives <= 0) {
                if (this.state.isHost || this.state.isBot || !DB.isConnected()) {
                    this.endDuel();
                }
            } else if (this.state.isHost || this.state.isBot || !DB.isConnected()) {
                setTimeout(() => this.nextRound(), 1500);
            }
        }
    },

    /* ─────────────────────────────────────────────────────
       UI helpers
       ───────────────────────────────────────────────────── */

    updateDuelScores: function() {
        document.getElementById('duelPlayerScore').textContent = this.state.playerScore;
        document.getElementById('duelOpponentScore').textContent = this.state.opponentScore;

        const playerScoreEl = document.getElementById('duelPlayerScore');
        const opponentScoreEl = document.getElementById('duelOpponentScore');

        if (this.state.playerScore > this.state.opponentScore) {
            playerScoreEl.style.color = '#00ff88';
            opponentScoreEl.style.color = '#ff5f56';
        } else if (this.state.playerScore < this.state.opponentScore) {
            playerScoreEl.style.color = '#ff5f56';
            opponentScoreEl.style.color = '#00ff88';
        } else {
            playerScoreEl.style.color = '#ffbd2e';
            opponentScoreEl.style.color = '#ffbd2e';
        }
    },

    updateLivesUI: function() {
        const pl = document.getElementById('duelPlayerLives');
        const ol = document.getElementById('duelOpponentLives');
        if (pl) pl.textContent = this.state.playerLives;
        if (ol) ol.textContent = this.state.opponentLives;
    },

    /* ─────────────────────────────────────────────────────
       End of duel / cleanup
       ───────────────────────────────────────────────────── */

    endDuel: function() {
        clearInterval(this.state.timer);

        if (DB.isConnected() && this.state.roomId && this.state.isHost) {
            DB.duelRoom(this.state.roomId).update({ status: 'finished' });
            setTimeout(() => {
                DB.duelRoom(this.state.roomId).remove();
            }, 5000);
        }

        if (this.roomListener) {
            this.roomListener.off();
            this.roomListener = null;
        }

        // Determine winner by lives first, then score
        let resultTitle;
        if (this.state.playerLives > 0 && this.state.opponentLives <= 0) {
            resultTitle = '🎉 Victory! (Opponent ran out of lives)';
            Game.state.duelsWon = (Game.state.duelsWon || 0) + 1;
        } else if (this.state.playerLives <= 0 && this.state.opponentLives > 0) {
            resultTitle = '😢 Defeat (You ran out of lives)';
        } else if (this.state.playerLives <= 0 && this.state.opponentLives <= 0) {
            if (this.state.playerScore > this.state.opponentScore) {
                resultTitle = '🎉 Victory! (Score tiebreak)';
                Game.state.duelsWon = (Game.state.duelsWon || 0) + 1;
            } else if (this.state.playerScore < this.state.opponentScore) {
                resultTitle = '😢 Defeat (Score tiebreak)';
            } else {
                resultTitle = '🤝 Draw! Both fell together';
            }
        } else {
            if (this.state.playerScore > this.state.opponentScore) {
                resultTitle = '🎉 Victory!';
                Game.state.duelsWon = (Game.state.duelsWon || 0) + 1;
            } else if (this.state.playerScore < this.state.opponentScore) {
                resultTitle = '😢 Defeat';
            } else {
                resultTitle = '🤝 Draw!';
            }
        }

        document.getElementById('duelResultTitle').textContent = resultTitle;
        document.getElementById('duelResultPlayerName').textContent = Game.state.playerName;
        document.getElementById('duelResultOpponentName').textContent = this.state.opponentName;
        document.getElementById('duelResultPlayerScore').textContent = this.state.playerScore;
        document.getElementById('duelResultOpponentScore').textContent = this.state.opponentScore;

        const playerScoreEl = document.getElementById('duelResultPlayerScore');
        const opponentScoreEl = document.getElementById('duelResultOpponentScore');

        if (this.state.playerLives > this.state.opponentLives ||
            (this.state.playerLives === this.state.opponentLives && this.state.playerScore > this.state.opponentScore)) {
            playerScoreEl.className = 'final-score winning';
            opponentScoreEl.className = 'final-score losing';
        } else if (this.state.playerLives < this.state.opponentLives ||
                   (this.state.playerLives === this.state.opponentLives && this.state.playerScore < this.state.opponentScore)) {
            playerScoreEl.className = 'final-score losing';
            opponentScoreEl.className = 'final-score winning';
        } else {
            playerScoreEl.className = 'final-score tied';
            opponentScoreEl.className = 'final-score tied';
        }

        const totalQuestions = Math.max(1, this.state.round);
        const accuracy = Math.round((this.state.playerCorrect / totalQuestions) * 100);
        document.getElementById('duelResultAccuracy').textContent = accuracy + '%';
        document.getElementById('duelResultStreak').textContent = this.state.playerBestStreak;

        // Award duel points
        let pointsEarned = 0;
        if (this.state.playerLives > this.state.opponentLives ||
            (this.state.playerLives === this.state.opponentLives && this.state.playerScore > this.state.opponentScore)) {
            pointsEarned = 50;
        } else if (this.state.playerLives < this.state.opponentLives ||
                   (this.state.playerLives === this.state.opponentLives && this.state.playerScore < this.state.opponentScore)) {
            pointsEarned = 10;
        } else {
            pointsEarned = 25;
        }
        if (typeof Game !== 'undefined' && Game.addPoints) {
            Game.addPoints(pointsEarned);
        }

        Game.saveStats();
        Game.showScreen('screen-duel-results');
    },

    rematch: function() {
        if (this.state.isBot) {
            this.playBot();
        } else {
            this.showLobby();
        }
    },

    cancelSearch: function() {
        clearInterval(this.state.timer);

        if (DB.isConnected()) {
            DB.matchmaking().child(PLAYER_ID).remove();

            if (this.state.roomId) {
                DB.duelRoom(this.state.roomId).remove();
            }
        }

        if (this.roomListener) {
            this.roomListener.off();
            this.roomListener = null;
        }

        Game.showScreen('screen-duel-lobby');
    }
};