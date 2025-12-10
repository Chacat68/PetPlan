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
        this.injectUI(); // 注入装备槽位到角色界面
        this.bindEvents(); // 绑定锻造按钮
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* 装备槽位样式 */
            .equipment-slots-container {
                display: flex;
                justify-content: center;
                gap: 15px;
                margin-bottom: 20px;
            }
            .equipment-slot {
                width: 60px;
                height: 60px;
                background: rgba(0, 0, 0, 0.4);
                border: 2px solid #555;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                position: relative;
                transition: all 0.2s;
            }
            .equipment-slot:hover {
                border-color: #ffd700;
                transform: scale(1.05);
            }
            .equipment-slot.empty::after {
                content: attr(data-placeholder);
                color: #aaa;
                font-size: 12px;
            }
            .equipment-icon {
                font-size: 24px;
            }
            .equipment-level {
                position: absolute;
                bottom: 2px;
                right: 2px;
                font-size: 10px;
                color: #fff;
                text-shadow: 1px 1px 0 #000;
            }
            
            /* 背包/锻造区域 */
            .equipment-panel {
                padding: 10px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 10px;
                margin-top: 10px;
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
            }
            .panel-tab.active {
                color: #ffd700;
                border-bottom: 2px solid #ffd700;
            }
            
            .equipment-inventory {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 5px;
                max-height: 200px;
                overflow-y: auto;
            }
            .inventory-item {
                aspect-ratio: 1;
                background: rgba(0,0,0,0.3);
                border: 1px solid #444;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                position: relative;
            }
            .inventory-item.legendary { border-color: #ff9800; box-shadow: 0 0 5px #ff9800; }
            .inventory-item.epic { border-color: #9c27b0; }
            .inventory-item.rare { border-color: #2196f3; }
            .inventory-item.uncommon { border-color: #4caf50; }
            
            .crafting-menu {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .craft-btn {
                padding: 10px;
                background: linear-gradient(to bottom, #4a6fa5, #34495e);
                border: 1px solid #7f8c8d;
                border-radius: 5px;
                color: white;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .craft-btn:active {
                transform: scale(0.98);
            }
            .craft-cost {
                font-size: 12px;
                color: #ddd;
            }
            
            /* 详情弹窗 */
            .item-tooltip {
                position: fixed;
                background: rgba(20, 20, 30, 0.95);
                border: 1px solid #666;
                padding: 15px;
                border-radius: 8px;
                z-index: 1000;
                width: 200px;
                pointer-events: none;
                display: none;
                color: #fff;
            }
            .item-tooltip h4 { margin: 0 0 10px 0; }
            .item-stats div { margin: 3px 0; font-size: 12px; }
            .item-Action-Menu {
                position: fixed;
                background: #333;
                border: 1px solid #666;
                padding: 5px;
                z-index: 1001;
                border-radius: 5px;
            }
            .item-Action-Menu button {
                display: block;
                width: 100%;
                padding: 5px 10px;
                margin: 2px 0;
                background: #444;
                color: white;
                border: none;
                cursor: pointer;
            }
            .item-Action-Menu button:hover { background: #555; }
        `;
        document.head.appendChild(style);
    }

    injectUI() {
        // 找到角色模态框的主体部分
        const modalBody = document.querySelector('.character-modal .modal-body');
        if (!modalBody) return;

        // 在最上面添加装备UI (插入到existing content之前)
        const container = document.createElement('div');
        container.className = 'equipment-container';
        container.innerHTML = `
            <div class="equipment-slots-container">
                <div class="equipment-slot empty" data-slot="weapon" data-placeholder="武器"></div>
                <div class="equipment-slot empty" data-slot="armor" data-placeholder="防具"></div>
                <div class="equipment-slot empty" data-slot="accessory" data-placeholder="饰品"></div>
            </div>
            
            <div class="equipment-panel">
                <div class="panel-tabs">
                    <div class="panel-tab active" data-tab="inventory">背包</div>
                    <div class="panel-tab" data-tab="craft">锻造</div>
                </div>
                
                <div class="panel-content" id="equipInventoryPanel">
                    <div class="equipment-inventory" id="equipmentInventory"></div>
                    <div style="margin-top:5px;text-align:center;font-size:12px;color:#888;">点击装备查看详情/穿戴</div>
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
            </div>
            <hr style="border-color:#444;margin:15px 0;">
        `;

        // 插入到最前面
        modalBody.insertBefore(container, modalBody.firstChild);

        // 初始化Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'item-tooltip';
        tooltip.id = 'itemTooltip';
        document.body.appendChild(tooltip);

        this.updateView();
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

                // 如果切换到背包，刷新一下
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

        // 槽位点击 (卸下)
        document.querySelectorAll('.equipment-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const type = slot.dataset.slot;
                const item = this.equipmentSystem.equipmentSlots[type];
                if (item) {
                    this.showItemActionMenu(item, e.clientX, e.clientY, true);
                }
            });
        });
    }

    updateView() {
        // 1. 更新槽位显示
        const slots = this.equipmentSystem.equipmentSlots;
        for (const [type, item] of Object.entries(slots)) {
            const el = document.querySelector(`.equipment-slot[data-slot="${type}"]`);
            if (!el) continue;

            if (item) {
                el.classList.remove('empty');
                el.style.borderColor = this.equipmentSystem.rarityConfig[item.rarity].color;
                el.innerHTML = `
                    <div class="equipment-icon">${item.type === 'weapon' ? '⚔️' : item.type === 'armor' ? '🛡️' : '💍'}</div>
                    <div class="equipment-level">Lv.${item.level}</div>
                `;
            } else {
                el.classList.add('empty');
                el.style.borderColor = '#555';
                el.innerHTML = '';
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
        }
    }

    showItemActionMenu(item, x, y, isEquipped) {
        // 移除旧菜单
        const oldMenu = document.querySelector('.item-Action-Menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'item-Action-Menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // 简单的详情描述
        let statsDesc = '';
        for (const [key, val] of Object.entries(item.stats)) {
            statsDesc += `${key}: ${val}\n`;
        }

        menu.innerHTML = `
            <div style="color:${this.equipmentSystem.rarityConfig[item.rarity].color};font-weight:bold;margin-bottom:5px;">${item.name}</div>
            <div style="font-size:12px;color:#ddd;margin-bottom:8px;white-space:pre-wrap;">${statsDesc}</div>
            ${isEquipped ?
                `<button id="actionUnequip">卸下</button>` :
                `<button id="actionEquip">装备</button>`
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
            // 触发玩家属性更新（需要刷新UI）
            // 这是一个hack，应该发布事件，但这里直接调用全局UI刷新可能更简单，或者让PlayerSystem自己监听
            // 为简单起见，这里假设玩家打开了属性面板，我们可能需要触发一些更新
        } else {
            this.showNotification(res.message, '#f44336');
        }
    }

    showNotification(msg, color) {
        // 复用现有的UI系统通知或创建简单的
        const div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.top = '20%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.background = 'rgba(0,0,0,0.8)';
        div.style.color = color;
        div.style.padding = '10px 20px';
        div.style.borderRadius = '5px';
        div.style.zIndex = '2000';
        div.innerText = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2000);
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
