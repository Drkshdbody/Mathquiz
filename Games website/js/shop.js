/*
 * ══════════════════════════════════════════════════════════════
 * POINTS SHOP & INVENTORY
 * ══════════════════════════════════════════════════════════════
 */

const Shop = {
    items: [
        {
            id: 'time_potion',
            name: 'Time Potion',
            desc: '+5s on current duel question',
            cost: 30,
            icon: '⏱️'
        },
        {
            id: 'double_points',
            name: 'Double Points Scroll',
            desc: 'Next correct answer gives +20 bonus',
            cost: 40,
            icon: '📜'
        },
        {
            id: 'shield',
            name: 'Streak Shield',
            desc: 'Ignore streak reset on next wrong answer',
            cost: 35,
            icon: '🛡️'
        }
    ],

    getInventory() {
        const inv = Utils.loadLocal('mathquest_inventory', {});
        return inv || {};
    },

    saveInventory(inv) {
        Utils.saveLocal('mathquest_inventory', inv);
    },

    show() {
        Game.showScreen('screen-shop');
        document.getElementById('shopPoints').textContent = Game.state.points || 0;

        const inv = this.getInventory();
        const container = document.getElementById('shopItems');
        container.innerHTML = this.items.map(item => {
            const owned = inv[item.id] || 0;
            return `
                <div class="shop-item">
                    <div class="shop-icon">${item.icon}</div>
                    <div class="shop-info">
                        <h3>${item.name}</h3>
                        <p>${item.desc}</p>
                        <p class="shop-cost">${item.cost} pts</p>
                        <p class="shop-owned">Owned: <span>${owned}</span></p>
                    </div>
                    <button class="btn-game btn-primary" onclick="Shop.buy('${item.id}')">
                        Buy
                    </button>
                </div>
            `;
        }).join('');
    },

    buy(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        const points = Game.state.points || 0;
        if (points < item.cost) {
            Utils.notify('Not enough points!', 'warning');
            return;
        }

        const inv = this.getInventory();
        inv[itemId] = (inv[itemId] || 0) + 1;
        this.saveInventory(inv);

        Game.addPoints(-item.cost);

        Utils.notify(`Bought ${item.name}!`, 'success');
        this.show();
    },

    getItemCount(id) {
        const inv = this.getInventory();
        return inv[id] || 0;
    },

    useItem(id) {
        const inv = this.getInventory();
        if (!inv[id] || inv[id] <= 0) return false;
        inv[id]--;
        this.saveInventory(inv);
        return true;
    }
};