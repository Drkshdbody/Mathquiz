/*
 * ══════════════════════════════════════════════════════════════
 * AUTH & ACCOUNT MANAGEMENT
 * ══════════════════════════════════════════════════════════════
 */

const Auth = {
    currentUser: null,

    showScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (screen === 'signup') {
            document.getElementById('screen-signup').classList.add('active');
        } else if (screen === 'signin') {
            document.getElementById('screen-signin').classList.add('active');
        } else {
            document.getElementById('screen-welcome').classList.add('active');
        }
    },

    // NOTE: This is NOT secure hashing; for real apps use proper auth.
    hashPassword(pw) {
        return btoa(pw);
    },

    signup() {
        const usernameRaw = document.getElementById('signupUsername').value.trim();
        const password = document.getElementById('signupPassword').value;
        const password2 = document.getElementById('signupPassword2').value;
        const gradeVal = document.getElementById('signupGrade').value;
        const avatarUrl = document.getElementById('signupAvatar').value.trim();
        const errorEl = document.getElementById('signupError');

        errorEl.textContent = '';

        if (!usernameRaw || usernameRaw.length < 3) {
            errorEl.textContent = 'Username must be at least 3 characters.';
            return;
        }
        const username = usernameRaw.replace(/\s+/g, '');
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            errorEl.textContent = 'Username can only contain letters, numbers, and _.';
            return;
        }

        if (!password || password.length < 4) {
            errorEl.textContent = 'Password must be at least 4 characters.';
            return;
        }
        if (password !== password2) {
            errorEl.textContent = 'Passwords do not match.';
            return;
        }

        const grade = parseInt(gradeVal, 10);
        if (![8, 9, 10].includes(grade)) {
            errorEl.textContent = 'Please select your grade.';
            return;
        }

        if (!DB.isConnected()) {
            errorEl.textContent = 'Server connection required to create account.';
            return;
        }

        const key = username.toLowerCase();
        DB.accounts().child(key).once('value', (snap) => {
            if (snap.exists()) {
                errorEl.textContent = 'That username is already taken.';
                return;
            }

            const account = {
                username,
                password: this.hashPassword(password),
                grade,
                avatarUrl: avatarUrl || '',
                points: 0,
                createdAt: Date.now(),
                stats: {
                    highScore: 0,
                    gamesPlayed: 0,
                    duelsWon: 0,
                    allTimeStreak: 0
                }
            };

            DB.accounts().child(key).set(account, (err) => {
                if (err) {
                    errorEl.textContent = 'Failed to create account. Try again.';
                    return;
                }

                this.currentUser = account;
                Utils.saveLocal('mathquest_account_username', key);

                Game.setAccount(account);
                Utils.notify('Account created! Logged in as ' + username, 'success');
                Game.showScreen('screen-menu');
            });
        });
    },

    signin() {
        const usernameRaw = document.getElementById('signinUsername').value.trim();
        const password = document.getElementById('signinPassword').value;
        const errorEl = document.getElementById('signinError');
        errorEl.textContent = '';

        if (!usernameRaw || !password) {
            errorEl.textContent = 'Enter username and password.';
            return;
        }

        if (!DB.isConnected()) {
            errorEl.textContent = 'Server connection required to sign in.';
            return;
        }

        const key = usernameRaw.replace(/\s+/g, '').toLowerCase();
        DB.accounts().child(key).once('value', (snap) => {
            if (!snap.exists()) {
                errorEl.textContent = 'Account not found.';
                return;
            }
            const account = snap.val();
            if (account.password !== this.hashPassword(password)) {
                errorEl.textContent = 'Incorrect password.';
                return;
            }

            this.currentUser = account;
            Utils.saveLocal('mathquest_account_username', key);
            Game.setAccount(account);
            Utils.notify('Welcome back, ' + account.username + '!', 'success');
            Game.showScreen('screen-menu');
        });
    },

    autoLogin() {
        const key = Utils.loadLocal('mathquest_account_username', null);
        if (!key || !DB.isConnected()) return;

        DB.accounts().child(key).once('value', (snap) => {
            if (!snap.exists()) return;
            const account = snap.val();
            this.currentUser = account;
            Game.setAccount(account);
            Utils.notify('Logged in as ' + account.username, 'info');
            Game.showScreen('screen-menu');
        });
    }
};