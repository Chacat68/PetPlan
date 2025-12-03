/**
 * 宠物UI管理模块
 * 负责宠物图鉴、背包、编队、养成等界面
 */

import { getPetSystemInstance } from './pet-system.js';

class PetUI {
    constructor(petSystem, resourceSystem) {
        this.petSystem = petSystem;
        this.resourceSystem = resourceSystem;
        
        this.currentView = 'team'; // team, collection, bag
        this.selectedPet = null;
        
        this.init();
    }
    
    /**
     * 初始化UI
     */
    init() {
        this.injectPetUI();
        this.bindEvents();
        console.log('宠物UI初始化完成');
    }
    
    /**
     * 注入宠物UI到角色管理界面
     */
    injectPetUI() {
        const container = document.getElementById('pet-tab-content');
        if (!container) return;

        container.innerHTML = `
            <div class="pet-ui-container">
                <div class="pet-tabs">
                    <button class="pet-tab active" data-view="team">编队</button>
                    <button class="pet-tab" data-view="bag">背包</button>
                    <button class="pet-tab" data-view="collection">图鉴</button>
                </div>
                
                <div class="pet-content">
                    <!-- 编队视图 -->
                    <div class="pet-view" id="petViewTeam">
                        <div class="pet-formation">
                            <div class="formation-section">
                                <h3>前排</h3>
                                <div class="formation-slots" id="frontSlots">
                                    <div class="pet-slot-container" data-position="front" data-index="0">
                                        <div class="pet-slot empty">+</div>
                                    </div>
                                    <div class="pet-slot-container" data-position="front" data-index="1">
                                        <div class="pet-slot empty">+</div>
                                    </div>
                                    <div class="pet-slot-container" data-position="front" data-index="2">
                                        <div class="pet-slot empty">+</div>
                                    </div>
                                </div>
                            </div>
                            <div class="formation-section">
                                <h3>后排</h3>
                                <div class="formation-slots" id="backSlots">
                                    <div class="pet-slot-container" data-position="back" data-index="0">
                                        <div class="pet-slot empty">+</div>
                                    </div>
                                    <div class="pet-slot-container" data-position="back" data-index="1">
                                        <div class="pet-slot empty">+</div>
                                    </div>
                                    <div class="pet-slot-container" data-position="back" data-index="2">
                                        <div class="pet-slot empty">+</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="team-stats">
                            <h3>队伍加成</h3>
                            <div class="stat-item">
                                <span class="stat-label">⚔️ 攻击力:</span>
                                <span class="stat-value" id="teamAttack">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">🛡️ 防御力:</span>
                                <span class="stat-value" id="teamDefense">0</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 背包视图 -->
                    <div class="pet-view hidden" id="petViewBag">
                        <div class="pet-bag-list" id="petBagList">
                            <!-- 动态生成宠物列表 -->
                        </div>
                    </div>
                    
                    <!-- 图鉴视图 -->
                    <div class="pet-view hidden" id="petViewCollection">
                        <div class="pet-collection-list" id="petCollectionList">
                            <!-- 动态生成图鉴列表 -->
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 宠物详情弹窗 -->
            <div class="pet-detail-modal hidden" id="petDetailModal">
                <div class="pet-detail-content">
                    <button class="pet-detail-close">×</button>
                    <div class="pet-detail-info" id="petDetailInfo">
                        <!-- 动态生成宠物详情 -->
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 标签切换
        const tabs = document.querySelectorAll('.pet-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchView(tab.dataset.view);
            });
        });
        
        // 点击外部关闭详情弹窗
        const detailModal = document.getElementById('petDetailModal');
        if (detailModal) {
            detailModal.addEventListener('click', (e) => {
                if (e.target === detailModal) {
                    this.closeDetailModal();
                }
            });
        }
        
        // 关闭详情弹窗按钮
        const closeDetailBtn = document.querySelector('.pet-detail-close');
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', () => {
                this.closeDetailModal();
            });
        }
        
        // 编队槽位点击事件
        const slots = document.querySelectorAll('.pet-slot-container');
        slots.forEach(slot => {
            slot.addEventListener('click', () => {
                const position = slot.dataset.position;
                const index = parseInt(slot.dataset.index);
                this.handleSlotClick(position, index);
            });
        });
    }
    
    /**
     * 切换视图
     */
    switchView(view) {
        this.currentView = view;
        
        // 更新标签样式
        document.querySelectorAll('.pet-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });
        
        // 显示对应视图
        document.querySelectorAll('.pet-view').forEach(viewEl => {
            viewEl.classList.add('hidden');
        });
        
        const viewMap = {
            team: 'petViewTeam',
            bag: 'petViewBag',
            collection: 'petViewCollection'
        };
        
        const targetView = document.getElementById(viewMap[view]);
        if (targetView) {
            targetView.classList.remove('hidden');
        }
        
        this.refreshCurrentView();
    }
    
    /**
     * 刷新当前视图
     */
    refreshCurrentView() {
        switch (this.currentView) {
            case 'team':
                this.refreshTeamView();
                break;
            case 'bag':
                this.refreshBagView();
                break;
            case 'collection':
                this.refreshCollectionView();
                break;
        }
    }
    
    /**
     * 刷新编队视图
     */
    refreshTeamView() {
        // 更新槽位显示
        ['front', 'back'].forEach(position => {
            this.petSystem.slots[position].forEach((pet, index) => {
                const container = document.querySelector(
                    `.pet-slot-container[data-position="${position}"][data-index="${index}"]`
                );
                
                if (!container) return;
                
                const slot = container.querySelector('.pet-slot');
                
                if (pet) {
                    slot.classList.remove('empty');
                    slot.innerHTML = `
                        <div class="pet-icon">${pet.image}</div>
                        <div class="pet-level">Lv.${pet.level}</div>
                        <div class="pet-hp-bar">
                            <div class="pet-hp-fill" style="width: ${(pet.currentHp / pet.maxHp) * 100}%"></div>
                        </div>
                    `;
                } else {
                    slot.classList.add('empty');
                    slot.innerHTML = '+';
                }
            });
        });
        
        // 更新队伍属性
        const bonus = this.petSystem.getTotalPowerBonus();
        document.getElementById('teamAttack').textContent = bonus.attack;
        document.getElementById('teamDefense').textContent = bonus.defense;

        // 同步更新游戏内的6个槽位显示
        this.updateGameSlots();
    }
    
    /**
     * 刷新背包视图
     */
    refreshBagView() {
        const bagList = document.getElementById('petBagList');
        bagList.innerHTML = '';
        
        if (this.petSystem.ownedPets.length === 0) {
            bagList.innerHTML = '<div class="empty-message">还没有宠物，去图鉴解锁吧！</div>';
            return;
        }
        
        this.petSystem.ownedPets.forEach(pet => {
            const petCard = this.createPetCard(pet, true);
            bagList.appendChild(petCard);
        });
    }
    
    /**
     * 刷新图鉴视图
     */
    refreshCollectionView() {
        const collectionList = document.getElementById('petCollectionList');
        collectionList.innerHTML = '';
        
        Object.values(this.petSystem.petDatabase).forEach(template => {
            const isOwned = this.petSystem.ownedPets.some(p => p.templateId === template.id);
            const petCard = this.createCollectionCard(template, isOwned);
            collectionList.appendChild(petCard);
        });
    }
    
    /**
     * 创建宠物卡片（背包用）
     */
    createPetCard(pet, showActions = false) {
        const rarityConfig = this.petSystem.getRarityConfig(pet.rarity);
        const isEquipped = pet.position !== null;
        
        const card = document.createElement('div');
        card.className = 'pet-card';
        card.innerHTML = `
            <div class="pet-card-header" style="background: linear-gradient(135deg, ${rarityConfig.color}22, ${rarityConfig.color}44);">
                <div class="pet-card-icon">${pet.image}</div>
                <div class="pet-card-rarity" style="color: ${rarityConfig.color}">
                    ${'⭐'.repeat(rarityConfig.star)}
                </div>
            </div>
            <div class="pet-card-body">
                <h4 class="pet-card-name">${pet.name}</h4>
                <div class="pet-card-level">Lv.${pet.level}</div>
                <div class="pet-card-stats">
                    <div class="stat-mini">⚔️ ${pet.attack}</div>
                    <div class="stat-mini">❤️ ${pet.maxHp}</div>
                    <div class="stat-mini">🛡️ ${pet.defense}</div>
                </div>
                <div class="pet-card-status">
                    <div class="status-bar">
                        <span class="status-label">好感</span>
                        <div class="status-progress">
                            <div class="status-fill" style="width: ${pet.friendship}%; background: #e91e63;"></div>
                        </div>
                        <span class="status-value">${pet.friendship}%</span>
                    </div>
                    <div class="status-bar">
                        <span class="status-label">饱腹</span>
                        <div class="status-progress">
                            <div class="status-fill" style="width: ${pet.hunger}%; background: #ff9800;"></div>
                        </div>
                        <span class="status-value">${pet.hunger}%</span>
                    </div>
                    <div class="status-bar">
                        <span class="status-label">精力</span>
                        <div class="status-progress">
                            <div class="status-fill" style="width: ${pet.energy}%; background: #4caf50;"></div>
                        </div>
                        <span class="status-value">${pet.energy}%</span>
                    </div>
                </div>
                ${isEquipped ? '<div class="pet-equipped-badge">已上阵</div>' : ''}
            </div>
            ${showActions ? `
                <div class="pet-card-actions">
                    <button class="pet-action-btn" data-action="detail" data-pet-id="${pet.instanceId}">详情</button>
                    <button class="pet-action-btn" data-action="feed" data-pet-id="${pet.instanceId}">喂食</button>
                    <button class="pet-action-btn" data-action="train" data-pet-id="${pet.instanceId}">训练</button>
                </div>
            ` : ''}
        `;
        
        // 绑定按钮事件
        if (showActions) {
            card.querySelectorAll('.pet-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handlePetAction(btn.dataset.action, btn.dataset.petId);
                });
            });
        }
        
        return card;
    }
    
    /**
     * 创建图鉴卡片
     */
    createCollectionCard(template, isOwned) {
        const rarityConfig = this.petSystem.getRarityConfig(template.rarity);
        
        const card = document.createElement('div');
        card.className = `collection-card ${!isOwned ? 'locked' : ''}`;
        card.innerHTML = `
            <div class="collection-card-header" style="background: linear-gradient(135deg, ${rarityConfig.color}22, ${rarityConfig.color}44);">
                <div class="collection-card-icon">${isOwned ? template.image : '❓'}</div>
                <div class="collection-card-rarity" style="color: ${rarityConfig.color}">
                    ${'⭐'.repeat(rarityConfig.star)}
                </div>
            </div>
            <div class="collection-card-body">
                <h4 class="collection-card-name">${isOwned ? template.name : '???'}</h4>
                <p class="collection-card-desc">${isOwned ? template.description : '未解锁'}</p>
                ${isOwned ? `
                    <div class="collection-card-info">
                        <div class="info-row">
                            <span>⚔️ 攻击:</span> <span>${template.baseAttack}</span>
                        </div>
                        <div class="info-row">
                            <span>❤️ 生命:</span> <span>${template.baseHp}</span>
                        </div>
                        <div class="info-row">
                            <span>🛡️ 防御:</span> <span>${template.baseDefense}</span>
                        </div>
                        <div class="info-row skill-info">
                            <span>💫 技能:</span> <span>${template.skill.name}</span>
                        </div>
                        <p class="skill-desc">${template.skill.description}</p>
                    </div>
                ` : `
                    <div class="unlock-info">
                        <div class="unlock-requirement">
                            <span>🔓 ${template.unlockLevel}级解锁</span>
                        </div>
                        <div class="unlock-cost">
                            <span>💰 ${this.resourceSystem.formatNumber(template.unlockCost.coins)}</span>
                            ${template.unlockCost.gems > 0 ? `<span>🔴 ${template.unlockCost.gems}</span>` : ''}
                        </div>
                        <button class="unlock-btn" data-pet-id="${template.id}">解锁</button>
                    </div>
                `}
            </div>
        `;
        
        // 绑定解锁按钮
        const unlockBtn = card.querySelector('.unlock-btn');
        if (unlockBtn) {
            unlockBtn.addEventListener('click', () => {
                this.handleUnlockPet(template.id);
            });
        }
        
        return card;
    }
    
    /**
     * 处理槽位点击
     */
    handleSlotClick(position, index) {
        const pet = this.petSystem.slots[position][index];
        
        if (pet) {
            // 已有宠物，显示选项：查看详情或卸下
            this.showSlotMenu(pet, position, index);
        } else {
            // 空槽位，显示宠物选择
            this.showPetSelector(position, index);
        }
    }
    
    /**
     * 显示槽位菜单
     */
    showSlotMenu(pet, position, index) {
        const menu = document.createElement('div');
        menu.className = 'slot-menu';
        menu.innerHTML = `
            <div class="slot-menu-content">
                <h4>${pet.name} Lv.${pet.level}</h4>
                <button class="menu-btn" data-action="detail">查看详情</button>
                <button class="menu-btn" data-action="unequip">卸下</button>
                <button class="menu-btn" data-action="cancel">取消</button>
            </div>
        `;
        
        document.body.appendChild(menu);
        
        menu.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.action === 'detail') {
                    this.showPetDetail(pet);
                } else if (btn.dataset.action === 'unequip') {
                    this.petSystem.unequipPet(pet.instanceId);
                    this.refreshTeamView();
                    this.updateGameSlots();
                    this.showNotification(`${pet.name} 已下阵`);
                }
                menu.remove();
            });
        });
        
        // 点击外部关闭
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }
    
    /**
     * 显示宠物选择器
     */
    showPetSelector(position, index) {
        const selector = document.createElement('div');
        selector.className = 'pet-selector';
        selector.innerHTML = `
            <div class="pet-selector-content">
                <h4>选择宠物</h4>
                <div class="pet-selector-list" id="petSelectorList"></div>
                <button class="menu-btn" data-action="cancel">取消</button>
            </div>
        `;
        
        document.body.appendChild(selector);
        
        const list = selector.querySelector('#petSelectorList');
        
        // 显示未装备的宠物
        const availablePets = this.petSystem.ownedPets.filter(p => !p.position);
        
        if (availablePets.length === 0) {
            list.innerHTML = '<div class="empty-message">没有可用的宠物</div>';
        } else {
            availablePets.forEach(pet => {
                const item = document.createElement('div');
                item.className = 'pet-selector-item';
                item.innerHTML = `
                    <span class="pet-icon">${pet.image}</span>
                    <span class="pet-name">${pet.name}</span>
                    <span class="pet-level">Lv.${pet.level}</span>
                `;
                item.addEventListener('click', () => {
                    const result = this.petSystem.equipPet(pet.instanceId, position, index);
                    if (result.success) {
                        this.refreshTeamView();
                        this.updateGameSlots();
                        this.showNotification(result.message);
                    }
                    selector.remove();
                });
                list.appendChild(item);
            });
        }
        
        // 取消按钮
        selector.querySelector('[data-action="cancel"]').addEventListener('click', () => {
            selector.remove();
        });
    }
    
    /**
     * 处理宠物操作
     */
    handlePetAction(action, petId) {
        const pet = this.petSystem.ownedPets.find(p => p.instanceId == petId);
        if (!pet) return;
        
        switch (action) {
            case 'detail':
                this.showPetDetail(pet);
                break;
            case 'feed':
                const feedResult = this.petSystem.feedPet(petId);
                this.showNotification(feedResult.message);
                if (feedResult.success) {
                    this.refreshBagView();
                }
                break;
            case 'train':
                const trainResult = this.petSystem.trainPet(petId);
                this.showNotification(trainResult.message);
                if (trainResult.success) {
                    this.refreshBagView();
                }
                break;
        }
    }
    
    /**
     * 解锁宠物
     */
    handleUnlockPet(petId) {
        const result = this.petSystem.unlockPet(petId);
        this.showNotification(result.message);
        
        if (result.success) {
            this.refreshCollectionView();
            // 播放解锁动画
            this.playUnlockAnimation(result.pet);
        }
    }
    
    /**
     * 显示宠物详情
     */
    showPetDetail(pet) {
        const detailModal = document.getElementById('petDetailModal');
        const detailInfo = document.getElementById('petDetailInfo');
        
        const rarityConfig = this.petSystem.getRarityConfig(pet.rarity);
        
        detailInfo.innerHTML = `
            <div class="pet-detail-header" style="background: linear-gradient(135deg, ${rarityConfig.color}22, ${rarityConfig.color}44);">
                <div class="pet-detail-icon">${pet.image}</div>
                <div class="pet-detail-title">
                    <h3>${pet.name}</h3>
                    <div class="pet-detail-rarity" style="color: ${rarityConfig.color}">
                        ${'⭐'.repeat(rarityConfig.star)} ${rarityConfig.name}
                    </div>
                </div>
            </div>
            <div class="pet-detail-body">
                <div class="detail-section">
                    <h4>基础属性</h4>
                    <div class="detail-stats">
                        <div class="detail-stat">
                            <span class="stat-icon">⚔️</span>
                            <span class="stat-name">攻击力</span>
                            <span class="stat-val">${pet.attack}</span>
                        </div>
                        <div class="detail-stat">
                            <span class="stat-icon">❤️</span>
                            <span class="stat-name">生命值</span>
                            <span class="stat-val">${pet.hp}/${pet.maxHp}</span>
                        </div>
                        <div class="detail-stat">
                            <span class="stat-icon">🛡️</span>
                            <span class="stat-name">防御力</span>
                            <span class="stat-val">${pet.defense}</span>
                        </div>
                        <div class="detail-stat">
                            <span class="stat-icon">⚡</span>
                            <span class="stat-name">攻击速度</span>
                            <span class="stat-val">${pet.attackSpeed.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>技能</h4>
                    <div class="skill-detail">
                        <div class="skill-name">💫 ${pet.skill.name}</div>
                        <div class="skill-cooldown">冷却: ${pet.skill.cooldown / 1000}秒</div>
                        <div class="skill-description">${pet.skill.description}</div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>养成状态</h4>
                    <div class="pet-status-bars">
                        <div class="detail-bar">
                            <span class="bar-label">💖 好感度</span>
                            <div class="bar-container">
                                <div class="bar-fill" style="width: ${pet.friendship}%; background: #e91e63;"></div>
                            </div>
                            <span class="bar-value">${pet.friendship}/100</span>
                        </div>
                        <div class="detail-bar">
                            <span class="bar-label">🍖 饱腹度</span>
                            <div class="bar-container">
                                <div class="bar-fill" style="width: ${pet.hunger}%; background: #ff9800;"></div>
                            </div>
                            <span class="bar-value">${pet.hunger}/100</span>
                        </div>
                        <div class="detail-bar">
                            <span class="bar-label">⚡ 精力值</span>
                            <div class="bar-container">
                                <div class="bar-fill" style="width: ${pet.energy}%; background: #4caf50;"></div>
                            </div>
                            <span class="bar-value">${pet.energy}/100</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>经验</h4>
                    <div class="exp-bar">
                        <div class="exp-fill" style="width: ${(pet.exp / pet.expToNext) * 100}%"></div>
                    </div>
                    <div class="exp-text">${pet.exp} / ${pet.expToNext}</div>
                </div>
                
                <div class="detail-actions">
                    <button class="detail-action-btn" onclick="petUI.handlePetAction('feed', '${pet.instanceId}')">
                        🍖 喂食 (${50 * pet.level}💰)
                    </button>
                    <button class="detail-action-btn" onclick="petUI.handlePetAction('train', '${pet.instanceId}')">
                        🎯 训练 (${100 * pet.level}💰)
                    </button>
                </div>
            </div>
        `;
        
        detailModal.classList.remove('hidden');
    }
    
    /**
     * 关闭详情弹窗
     */
    closeDetailModal() {
        document.getElementById('petDetailModal').classList.add('hidden');
    }
    
    /**
     * 播放解锁动画
     */
    playUnlockAnimation(pet) {
        const animation = document.createElement('div');
        animation.className = 'unlock-animation';
        animation.innerHTML = `
            <div class="unlock-animation-content">
                <div class="unlock-icon">${pet.image}</div>
                <h2>恭喜解锁</h2>
                <h3>${pet.name}</h3>
                <p>${pet.description}</p>
            </div>
        `;
        document.body.appendChild(animation);
        
        setTimeout(() => {
            animation.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            animation.classList.remove('show');
            setTimeout(() => animation.remove(), 500);
        }, 3000);
    }
    
    /**
     * 显示通知
     */
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'pet-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
    
    /**
     * 更新游戏内槽位显示
     */
    updateGameSlots() {
        // 更新index.html中的6个宠物槽位显示
        const gameSlots = document.querySelectorAll('.pet-slot[data-slot]');
        
        gameSlots.forEach((slot, index) => {
            const position = index < 3 ? 'front' : 'back';
            const slotIndex = index < 3 ? index : index - 3;
            const pet = this.petSystem.slots[position][slotIndex];
            
            if (pet) {
                slot.innerHTML = `
                    <div class="pet-mini-icon">${pet.image}</div>
                    <div class="pet-mini-level">${pet.level}</div>
                `;
                slot.classList.remove('empty');
            } else {
                slot.innerHTML = '<span class="pet-slot-plus">+</span>';
                slot.classList.add('empty');
            }
        });
    }
}

// 导出UI实例
let petUIInstance = null;

export function getPetUIInstance(petSystem, resourceSystem) {
    if (!petUIInstance && petSystem && resourceSystem) {
        petUIInstance = new PetUI(petSystem, resourceSystem);
        // 暴露到全局，方便在HTML中调用
        window.petUI = petUIInstance;
    }
    return petUIInstance;
}

export default PetUI;
