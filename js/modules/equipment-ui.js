/**
 * 装备UI系统
 * 负责展示装备界面、背包、锻造功能
 */
import { getEquipmentSystemInstance } from './equipment-system.js';

class EquipmentUI {
    constructor(equipmentSystem, resourceSystem) {
        this.equipmentSystem = equipmentSystem;
        this.resourceSystem = resourceSystem;
        this.init();
    }

    init() {
        this.injectStyles();
        this.injectInventoryUI(); // 只注入背包和锻造面板
        this.bindEvents();
        this.updateView();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .equipment-panel {
                padding: 10px;
                background: rgba(0, 0, 0, 0.4);
                border-radius: 10px;
                margin: 10px 0;
                border: 1px solid #444;
            }
            .panel-tabs {
                display: flex;
                border-bottom: 1px solid #444;
                margin-bottom: 10px;
            }
            .panel-tab {
                flex: 1;
                padding: 8px;
                text-align: center;
                cursor: pointer;
                color: #aaa;
                font-size: 14px;
                font-weight: bold;
            }
            .panel-tab.active {
                color: #ffd700;
                border-bottom: 2px solid #ffd700;
                background: linear-gradient(to top, rgba(255, 215, 0, 0.1), transparent);
            }
            
            .equipment-inventory {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 8px;
                max-height: 180px;
                overflow-y: auto;
                padding: 5px;
            }
            .inventory-item {
                aspect-ratio: 1;
                background: rgba(0,0,0,0.5);
                border: 2px solid #444;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                position: relative;
                transition: transform 0.1s;
                font-size: 20px;
            }
            .inventory-item:hover { transform: scale(1.05); }
            .inventory-item.legendary { border-color: #ff9800; box-shadow: 0 0 5px #ff9800; }
            .inventory-item.epic { border-color: #9c27b0; box-shadow: 0 0 4px #9c27b0; }
            .inventory-item.rare { border-color: #2196f3; box-shadow: 0 0 3px #2196f3; }
            .inventory-item.uncommon { border-color: #4caf50; }
            
            .crafting-menu {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .craft-btn {
                padding: 12px;
                background: linear-gradient(135deg, #2c3e50, #34495e);
                border: 1px solid #5d6d7e;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: all 0.2s;
            }
            .craft-btn:hover {
                background: linear-gradient(135deg, #34495e, #2c3e50);
                border-color: #ffd700;
            }
            .craft-btn:active {
                transform: scale(0.98);
            }
            .craft-cost {
                font-family: monospace;
                font-size: 12px;
                color: #f1c40f;
            }
            
            /* Action Menu */
            .item-Action-Menu {
                position: fixed;
                background: rgba(30, 30, 40, 0.95);
                border: 1px solid #666;
                padding: 10px;
                z-index: 2000;
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                min-width: 150px;
                backdrop-filter: blur(5px);
            }
            .item-Action-Menu button {
                display: block;
                width: 100%;
                padding: 8px;
                margin: 4px 0;
                background: rgba(255,255,255,0.1);
                color: white;
                border: 1px solid transparent;
                border-radius: 4px;
                cursor: pointer;
                text-align: left;
            }
            .item-Action-Menu button:hover { 
                background: rgba(255,255,255,0.2); 
                border-color: #ffd700;
            }
        `;
        document.head.appendChild(style);
    }

    injectInventoryUI() {
        // 找到角色管理界面的内容区域
        const contentArea = document.getElementById('character-tab-content');
        if (!contentArea) return;

        // 创建背包面板
        const panel = document.createElement('div');
        panel.className = 'equipment-panel';
        panel.innerHTML = `
            <div class="panel-tabs">
                <div class="panel-tab active" data-tab="inventory">装备背包</div>
                <div class="panel-tab" data-tab="craft">铁匠铺</div>
            </div>
            
            <div class="panel-content" id="equipInventoryPanel">
                <div class="equipment-inventory" id="equipmentInventory"></div>
                <div style="margin-top:8px;text-align:center;font-size:12px;color:#888;">点击装备进行操作</div>
            </div>
            
            <div class="panel-content" id="equipCraftPanel" style="display:none;">
                <div class="crafting-menu">
                    <button class="craft-btn" data-type="weapon">
                        <span>⚔️ 打造武器</span>
                        <span class="craft-cost">💰1000 💎50</span>
                    </button>
                    <button class="craft-btn" data-type="armor">
                        <span>🛡️ 打造防具</span>
                        <span class="craft-cost">💰1000 💎50</span>
                    </button>
                    <button class="craft-btn" data-type="accessory">
                        <span>💍 打造饰品</span>
                        <span class="craft-cost">💰1000 💎50</span>
                    </button>
                </div>
            </div>
        `;

        // 插入到角色卡片下方，按钮上方
        const actions = contentArea.querySelector('.character-actions');
        if (actions) {
            contentArea.insertBefore(panel, actions);
        } else {
            contentArea.appendChild(panel);
        }
    }

    bindEvents() {
        // Tab切换
        const tabs = document.querySelectorAll('.panel-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const type = tab.dataset.tab;
                document.getElementById('equipInventoryPanel').style.display = type === 'inventory' ? 'block' : 'none';
                document.getElementById('equipCraftPanel').style.display = type === 'craft' ? 'block' : 'none';

                if (type === 'inventory') this.updateView();
            });
        });

        // 锻造按钮
        document.querySelectorAll('.craft-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const result = this.equipmentSystem.craftItem(type);

                if (result.success) {
                    this.showNotification(`打造成功: ${result.item.name}`, '#4caf50');
                    this.updateView();
                } else {
                    this.showNotification(result.message, '#f44336');
                }
            });
        });

        // 绑定现有的装备槽位点击事件
        // 映射 HTML class 到系统内部 type
        const slotMap = {
            '.weapon-slot': 'weapon',
            '.armor-slot': 'armor',
            '.ring-slot': 'accessory'
        };

        for (const [selector, type] of Object.entries(slotMap)) {
            const slot = document.querySelector(selector);
            if (slot) {
                // 保存原始HTML以便复原（如果是空槽）
                if (!slot.dataset.originalHtml) {
                    slot.dataset.originalHtml = slot.innerHTML;
                }

                slot.addEventListener('click', (e) => {
                    const item = this.equipmentSystem.equipmentSlots[type];
                    if (item) {
                        this.showItemActionMenu(item, e.clientX, e.clientY, true);
                    } else {
                        // 如果点击空槽位，提示去背包穿戴或自动跳转背包Tab
                        this.showNotification('请在下方背包中选择装备穿戴', '#ffd700');
                        document.querySelector('.panel-tab[data-tab="inventory"]').click();
                    }
                });
            }
        }
    }

    updateView() {
        // 1. 更新槽位显示
        const slotMap = {
            'weapon': '.weapon-slot',
            'armor': '.armor-slot',
            'accessory': '.ring-slot'
        };

        for (const [type, selector] of Object.entries(slotMap)) {
            const el = document.querySelector(selector);
            if (!el) continue;

            const item = this.equipmentSystem.equipmentSlots[type];
            if (item) {
                const color = this.equipmentSystem.rarityConfig[item.rarity].color;
                el.style.borderColor = color;
                el.style.boxShadow = `0 0 10px ${color}`;
                el.innerHTML = `
                    <div style="font-size:24px">${item.type === 'weapon' ? '⚔️' : item.type === 'armor' ? '🛡️' : '💍'}</div>
                `;
            } else {
                // 恢复默认样式
                el.style.borderColor = '';
                el.style.boxShadow = '';
                if (el.dataset.originalHtml) {
                    el.innerHTML = el.dataset.originalHtml;
                }
            }
        }

        // 2. 更新背包显示
        const invContainer = document.getElementById('equipmentInventory');
        if (invContainer) {
            invContainer.innerHTML = '';
            this.equipmentSystem.inventory.forEach(item => {
                const el = document.createElement('div');
                el.className = `inventory-item ${item.rarity}`;
                el.style.borderColor = this.equipmentSystem.rarityConfig[item.rarity].color;
                el.innerHTML = item.type === 'weapon' ? '⚔️' : item.type === 'armor' ? '🛡️' : '💍';

                el.addEventListener('click', (e) => {
                    this.showItemActionMenu(item, e.clientX, e.clientY, false);
                });

                invContainer.appendChild(el);
            });

            if (this.equipmentSystem.inventory.length === 0) {
                invContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#666;padding:20px;">背包是空的，去铁匠铺打造一些装备吧！</div>';
            }
        }
    }

    showItemActionMenu(item, x, y, isEquipped) {
        // 移除旧菜单
        const oldMenu = document.querySelector('.item-Action-Menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'item-Action-Menu';

        // 确保菜单不会超出屏幕
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        let left = x + 10;
        let top = y + 10;

        if (left + 150 > screenWidth) left = x - 160;
        if (top + 200 > screenHeight) top = y - 200;

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        // 属性描述
        let statsDesc = '';
        const statNames = {
            attack: '攻击', defense: '防御', hp: '生命',
            critRate: '暴击率', critDamage: '暴击伤害', attackSpeed: '攻速'
        };

        for (const [key, val] of Object.entries(item.stats)) {
            let displayVal = val;
            if (key === 'critRate' || key === 'critDamage') displayVal += '%'; // 假设单位
            if (key === 'attackSpeed') displayVal += '/s';
            statsDesc += `${statNames[key] || key}: +${displayVal}\n`;
        }

        menu.innerHTML = `
            <div style="color:${this.equipmentSystem.rarityConfig[item.rarity].color};font-weight:bold;margin-bottom:5px;border-bottom:1px solid #555;padding-bottom:5px;">${item.name}</div>
            <div style="font-size:12px;color:#aaa;margin-bottom:8px;">[${this.equipmentSystem.rarityConfig[item.rarity].name}]</div>
            <div style="font-size:12px;color:#fff;margin-bottom:12px;line-height:1.4;">${statsDesc}</div>
            ${isEquipped ?
                `<button id="actionUnequip">⬇️ 卸下</button>` :
                `<button id="actionEquip">⬆️ 装备</button>`
            }
            <button id="actionClose">关闭</button>
        `;

        document.body.appendChild(menu);

        // 绑定按钮
        const unequipBtn = menu.querySelector('#actionUnequip');
        if (unequipBtn) {
            unequipBtn.addEventListener('click', () => {
                const res = this.equipmentSystem.unequipItem(item.type);
                this.handleActionResult(res);
                menu.remove();
            });
        }

        const equipBtn = menu.querySelector('#actionEquip');
        if (equipBtn) {
            equipBtn.addEventListener('click', () => {
                const res = this.equipmentSystem.equipItem(item.id);
                this.handleActionResult(res);
                menu.remove();
            });
        }

        menu.querySelector('#actionClose').addEventListener('click', () => menu.remove());

        // 点击外部关闭
        setTimeout(() => {
            document.addEventListener('click', function close(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', close);
                }
            }, { once: true });
        }, 100);
    }

    handleActionResult(res) {
        if (res.success) {
            this.showNotification(res.message, '#4caf50');
            this.updateView();

            // 刷新玩家属性显示（如果面板开着）
            if (this.resourceSystem) {
                // 触发一个全局UI更新（如果有的话），或者重新计算战力
                // 这里我们假设PlayerSystem会自动在下次update loop中使用新属性
                // 但为了UI即时反馈，最好能触发 PlayerSystem.updateUpgradeItems()
                if (window.game && window.game.playerSystem) {
                    window.game.playerSystem.updateUpgradeItems();
                }
            }
        } else {
            this.showNotification(res.message, '#f44336');
        }
    }

    showNotification(msg, color) {
        const div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.top = '10%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, 0)';
        div.style.background = 'rgba(0,0,0,0.85)';
        div.style.color = color;
        div.style.padding = '12px 24px';
        div.style.borderRadius = '30px';
        div.style.zIndex = '3000';
        div.style.fontWeight = 'bold';
        div.style.border = `1px solid ${color}`;
        div.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
        div.innerText = msg;
        document.body.appendChild(div);

        // 动画
        div.animate([
            { opacity: 0, transform: 'translate(-50%, -20px)' },
            { opacity: 1, transform: 'translate(-50%, 0)' }
        ], { duration: 200, fill: 'forwards' });

        setTimeout(() => {
            div.animate([
                { opacity: 1 },
                { opacity: 0 }
            ], { duration: 200, fill: 'forwards' }).onfinish = () => div.remove();
        }, 2000);
    }
}

let equipmentUIInstance = null;
export function getEquipmentUIInstance(equipmentSystem, resourceSystem) {
    if (!equipmentUIInstance) {
        equipmentUIInstance = new EquipmentUI(equipmentSystem, resourceSystem);
    }
    return equipmentUIInstance;
}

export default EquipmentUI;
