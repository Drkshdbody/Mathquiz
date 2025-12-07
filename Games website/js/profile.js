/*
 * ══════════════════════════════════════════════════════════════
 * PROFILE VIEW / EDIT (with image upload)
 * ══════════════════════════════════════════════════════════════
 */

const Profile = {
    viewingSelf: true,

    _fillProfile(account, isSelf) {
        this.viewingSelf = isSelf;

        document.getElementById('profileUsername').textContent = account.username;
        document.getElementById('profileGrade').textContent = account.grade;
        document.getElementById('profilePoints').textContent = account.points || 0;

        const stats = account.stats || {};
        document.getElementById('profileHighScore').textContent = stats.highScore || 0;
        document.getElementById('profileDuelsWon').textContent = stats.duelsWon || 0;
        document.getElementById('profileBestStreak').textContent = stats.allTimeStreak || 0;
        document.getElementById('profileGamesPlayed').textContent = stats.gamesPlayed || 0;

        document.getElementById('profileAvatarImg').src = account.avatarUrl || 'default-avatar.png';

        const editControls = document.getElementById('profileEditControls');
        if (editControls) {
            editControls.style.display = isSelf ? 'block' : 'none';
        }

        const fileInput = document.getElementById('profileAvatarFile');
        if (fileInput) fileInput.value = '';
        const statusEl = document.getElementById('profileUploadStatus');
        if (statusEl) statusEl.textContent = '';
    },

    showMyProfile() {
        if (!Game.state.playerName) {
            Utils.notify('Please sign in first.', 'warning');
            return;
        }
        const username = Game.state.playerName;
        const key = username.toLowerCase();

        if (!DB.isConnected()) {
            this._fillProfile({
                username,
                grade: Game.state.grade,
                points: Game.state.points,
                avatarUrl: Game.state.avatarUrl,
                stats: {
                    highScore: Game.state.highScore,
                    duelsWon: Game.state.duelsWon,
                    allTimeStreak: Game.state.allTimeStreak,
                    gamesPlayed: Game.state.gamesPlayed
                }
            }, true);
            Game.showScreen('screen-profile');
            return;
        }

        DB.accounts().child(key).once('value', (snap) => {
            if (!snap.exists()) {
                Utils.notify('Account not found on server.', 'error');
                return;
            }
            this._fillProfile(snap.val(), true);
            Game.showScreen('screen-profile');
        });
    },

    view(username) {
        const key = username.toLowerCase();

        if (!DB.isConnected()) {
            Utils.notify('Need server connection to view profiles.', 'warning');
            return;
        }

        DB.accounts().child(key).once('value', (snap) => {
            if (!snap.exists()) {
                Utils.notify('Profile not found.', 'error');
                return;
            }
            const account = snap.val();
            const isSelf = (Game.state.playerName && account.username === Game.state.playerName);
            this._fillProfile(account, isSelf);
            Game.showScreen('screen-profile');
        });
    },

    previewAvatar() {
        const fileInput = document.getElementById('profileAvatarFile');
        const file = fileInput && fileInput.files ? fileInput.files[0] : null;
        const statusEl = document.getElementById('profileUploadStatus');

        if (!file) {
            if (statusEl) statusEl.textContent = '';
            return;
        }

        if (!file.type.startsWith('image/')) {
            if (statusEl) statusEl.textContent = 'Please select an image file.';
            fileInput.value = '';
            return;
        }

        if (file.size > 1.5 * 1024 * 1024) {
            if (statusEl) statusEl.textContent = 'File is too large. Please choose an image under ~1.5MB.';
            fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('profileAvatarImg').src = e.target.result;
        };
        reader.readAsDataURL(file);

        if (statusEl) statusEl.textContent = 'Ready to upload...';
    },

    uploadAvatar() {
        const fileInput = document.getElementById('profileAvatarFile');
        const file = fileInput && fileInput.files ? fileInput.files[0] : null;
        const statusEl = document.getElementById('profileUploadStatus');

        if (!file) {
            if (statusEl) statusEl.textContent = 'Please choose an image first.';
            return;
        }

        if (!DB.isConnected() || !Storage.avatars()) {
            if (statusEl) statusEl.textContent = 'Server/storage not available. Cannot upload.';
            return;
        }

        if (!Game.state.playerName) {
            if (statusEl) statusEl.textContent = 'You must be signed in to upload an avatar.';
            return;
        }

        if (!file.type.startsWith('image/')) {
            if (statusEl) statusEl.textContent = 'Please select an image file.';
            return;
        }

        const key = Game.state.playerName.toLowerCase();
        const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
        const fileName = `${key}_${Date.now()}.${ext}`;
        const avatarRef = Storage.avatars().child(fileName);

        statusEl.textContent = 'Uploading...';

        avatarRef.put(file).then(snapshot => {
            return snapshot.ref.getDownloadURL();
        }).then(url => {
            Game.state.avatarUrl = url;

            if (DB.isConnected()) {
                DB.accounts().child(key).child('avatarUrl').set(url);
            }

            document.getElementById('profileAvatarImg').src = url;
            statusEl.textContent = 'Avatar updated!';
            Utils.notify('Avatar uploaded successfully!', 'success');
        }).catch(err => {
            console.error('Avatar upload error', err);
            statusEl.textContent = 'Upload failed. Please try again.';
        });
    }
};
