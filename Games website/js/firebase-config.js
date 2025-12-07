/*
 * ══════════════════════════════════════════════════════════════
 * FIREBASE CONFIGURATION
 * Math Quest Online - Real-time Multiplayer
 * ══════════════════════════════════════════════════════════════
 */

const firebaseConfig = {
    apiKey: "AIzaSyDJTJTaLOyWmE_4MRJzqh8fNAgstgYfGv0",
    authDomain: "mathquestonline-1b0de.firebaseapp.com",
    databaseURL: "https://mathquestonline-1b0de-default-rtdb.firebaseio.com",
    projectId: "mathquestonline-1b0de",
    storageBucket: "mathquestonline-1b0de.firebasestorage.app",
    messagingSenderId: "557556179648",
    appId: "1:557556179648:web:28137674e9617152224325"
};

let db = null;
let storage = null;
let isFirebaseConnected = false;

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    storage = firebase.storage();
    isFirebaseConnected = true;
    console.log('✅ Firebase connected successfully');
    hideLoadingOverlay();
} catch (error) {
    console.warn('⚠️ Firebase not configured or failed to initialize. Running in offline mode.', error);
    console.log('To enable multiplayer & avatars, check firebase-config.js');
    isFirebaseConnected = false;
    hideLoadingOverlay();
}

const DB = {
    leaderboard: () => db ? db.ref('leaderboard') : null,
    onlinePlayers: () => db ? db.ref('online') : null,
    duelRooms: () => db ? db.ref('duels') : null,
    matchmaking: () => db ? db.ref('matchmaking') : null,
    player: (id) => db ? db.ref(`players/${id}`) : null,
    duelRoom: (roomId) => db ? db.ref(`duels/${roomId}`) : null,
    accounts: () => db ? db.ref('accounts') : null,
    isConnected: () => isFirebaseConnected
};

const Storage = {
    avatars: () => storage ? storage.ref('avatars') : null
};

function generatePlayerId() {
    let id = localStorage.getItem('mathquest_player_id');
    if (!id) {
        id = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('mathquest_player_id', id);
    }
    return id;
}

const PLAYER_ID = generatePlayerId();

function setupOnlinePresence(playerName, grade) {
    if (!DB.isConnected()) return;
    
    const playerRef = DB.onlinePlayers().child(PLAYER_ID);
    
    playerRef.set({
        name: playerName,
        grade: grade || null,
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
        status: 'online'
    });
    
    playerRef.onDisconnect().remove();
    
    setInterval(() => {
        if (playerRef) {
            playerRef.update({
                lastActive: firebase.database.ServerValue.TIMESTAMP
            });
        }
    }, 30000);
}

function getOnlinePlayerCount(callback) {
    if (!DB.isConnected()) {
        callback(Math.floor(Math.random() * 50) + 10);
        return;
    }
    
    DB.onlinePlayers().on('value', (snapshot) => {
        const count = snapshot.numChildren();
        callback(count);
    });
}

function getOnlinePlayers(callback) {
    if (!DB.isConnected()) {
        callback([
            { name: 'MathWizard', status: 'playing', grade: 10 },
            { name: 'NumberNinja', status: 'online', grade: 9 },
            { name: 'CalcMaster', status: 'online', grade: 8 }
        ]);
        return;
    }
    
    DB.onlinePlayers()
        .orderByChild('joinedAt')
        .limitToLast(20)
        .on('value', (snapshot) => {
            const players = [];
            snapshot.forEach((child) => {
                if (child.key !== PLAYER_ID) {
                    players.push({
                        id: child.key,
                        ...child.val()
                    });
                }
            });
            callback(players.reverse());
        });
}
