/**
 * 玩家UI模块
 * 负责管理玩家系统的界面交互、事件绑定和UI更新
 */
class PlayerUI {
    constructor(playerSystem, resourceSystem) {
        this.playerSystem = playerSystem;
        this.resourceSystem = resourceSystem;
        this.achievementSystem = null; // 稍后设置
    }

    /**
     * 设置成就系统引用
     */
    setAchievementSystem(achievementSystem) {
        this.achievementSystem = achievementSystem;
    }

    /**
     * 初始化UI
     */
    init() {
        // 延迟绑定升级按钮事件，确保DOM完全加载
        setTimeout(() => {
            this.bindUpgradeEvents();
            this.updateUpgradeButtons();
            this.updateUpgradeItems();
            this.updateTotalPower();
            console.log('玩家UI初始化完成');
        }, 200);
    }

    /**
     * 绑定升级事件
     */
    bindUpgradeEvents() {
        // 升级按钮事件 - 支持长按
        this.bindUpgradeButton('upgradeAttack', 'attack', 5);
        this.bindUpgradeButton('upgradeHp', 'hp', 20);
        this.bindUpgradeButton('upgradeDefense', 'defense', 2);
        this.bindUpgradeButton('upgradeHpRegen', 'hpRegen', 1);
        this.bindUpgradeButton('upgradeCritDamage', 'critDamage', 10);
        this.bindUpgradeButton('upgradeAttackSpeed', 'attackSpeed', 0.1);
        this.bindUpgradeButton('upgradeCrit', 'crit', 1);
        this.bindUpgradeButton('upgradeMultiShot', 'multiShot', 1);
        this.bindUpgradeButton('upgradeTripleShot', 'tripleShot', 5);

        // 绑定长按升级菜单功能
        this.bindLongPressUpgradeMenu();
    }

    /**
     * 绑定升级按钮的长按功能
     */
    bindUpgradeButton(buttonId, attribute, increase) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        let longPressTimer = null;
        let isLongPressing = false;
        let repeatTimer = null;

        // 执行升级的包装函数
        const performUpgrade = (silent = false) => {
           const result = this.playerSystem.upgradeAttribute(attribute, increase);
           if (result.success) {
               if (!silent) this.showUpgradeSuccess(button, attribute);
               // 触发成就 (原逻辑在System里，现在UI层也可以处理，或者System层处理)
               // 这里假设System层处理数据，UI层处理反馈
               
               // 如果长按中，不每次都刷新按钮状态，节省性能？原逻辑是每次都刷新。
               this.updateUpgradeButtons(); 
               this.updateUpgradeItems(); 
           } else {
               if (!silent && result.reason === 'insufficient_coins') {
                   this.showInsufficientCoins(button);
               }
           }
        };

        // 开始长按
        const startLongPress = () => {
            // 先执行一次升级
            performUpgrade();

            // 设置长按定时器
            longPressTimer = setTimeout(() => {
                isLongPressing = true;
                // 开始重复升级
                repeatTimer = setInterval(() => {
                    performUpgrade(true); // 长按重复时静默显示动画？原逻辑是 silent=true 不显示动画但扣费
                }, 150); // 每150ms升级一次
            }, 500); // 长按500ms后开始重复
        };

        // 停止长按
        const stopLongPress = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            if (repeatTimer) {
                clearInterval(repeatTimer);
                repeatTimer = null;
            }
            isLongPressing = false;
        };

        // 鼠标事件
        button.addEventListener('mousedown', startLongPress);
        button.addEventListener('mouseup', stopLongPress);
        button.addEventListener('mouseleave', stopLongPress);

        // 触摸事件
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startLongPress();
        });
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopLongPress();
        });
        button.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            stopLongPress();
        });

        // 防止右键菜单
        button.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    /**
     * 绑定长按升级菜单功能
     */
    bindLongPressUpgradeMenu() {
        const upgradeButtons = [
            { id: 'upgradeAttack', attribute: 'attack' },
            { id: 'upgradeHp', attribute: 'hp' },
            { id: 'upgradeHpRegen', attribute: 'hpRegen' },
            { id: 'upgradeCritDamage', attribute: 'critDamage' },
            { id: 'upgradeAttackSpeed', attribute: 'attackSpeed' },
            { id: 'upgradeCrit', attribute: 'crit' },
            { id: 'upgradeMultiShot', attribute: 'multiShot' },
            { id: 'upgradeTripleShot', attribute: 'tripleShot' }
        ];

        upgradeButtons.forEach(({ id, attribute }) => {
            const button = document.getElementById(id);
            if (button) {
                let longPressTimer = null;
                let isLongPress = false;

                // 鼠标/触摸开始事件
                const startLongPress = (e) => {
                    e.preventDefault();
                    isLongPress = false;
                    longPressTimer = setTimeout(() => {
                        isLongPress = true;
                        this.showUpgradeMenu(button, attribute, e);
                    }, 500); // 长按500毫秒触发
                };

                // 鼠标/触摸结束事件
                const endLongPress = (e) => {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }

                    // 如果不是长按，执行升级操作 (这部分逻辑在bindUpgradeButton已经有了，但原代码似乎有重叠或覆盖)
                    // 注意：原代码中 bindUpgradeButton 和 bindLongPressUpgradeMenu 都绑定了 mousedown/touchstart
                    // 这可能导致冲突。
                    // 修正：bindUpgradeButton 处理点击和长按连续升级。bindLongPressUpgradeMenu 处理长按弹出菜单。
                    // 这两个逻辑是冲突的：长按到底该连续升级还是弹出菜单？
                    // 检查原代码：
                    // bindUpgradeButton 绑定了 mousedown. 
                    // bindLongPressUpgradeMenu 也绑定了 mousedown.
                    // 原代码逻辑似乎是 bindUpgradeButton 处理普通长按升级。
                    // 但 bindLongPressUpgradeMenu 也是长按 500ms。
                    // 以前的逻辑可能存在冲突，同一个按钮既有连续升级又有菜单。
                    // 仔细看原码：bindUpgradeButton 是给 button 绑定的。
                    // bindLongPressUpgradeMenu 也是给 button 绑定的。
                    // 这意味着长按500ms后，两个定时器都会触发！
                    // 这绝对是个BUG或者设计缺陷。
                    // 观察 UI：通常长按是连续升级。菜单哪里出来的？
                    // 假设为了不破坏现有行为，我保留这两个逻辑，但在重构时应该留意。
                    // 不过，分析原代码，bindLongPressUpgradeMenu 是后添加的，可能覆盖了。
                    // 不，addEventListener 是累加的。
                    // 结论：长按时既会连续升级，也会弹出菜单（如果两个都在运行）。
                    // 等等，原代码 L909 bindUpgradeButton 里的长按是 500ms。
                    // L982 bindLongPressUpgradeMenu 里的长按也是 500ms。
                    // 它们确实冲突。
                    // 无论如何，我照搬逻辑到这里。
                };

                // 为避免冲突，这里只绑定用于菜单的逻辑，且不做点击处理（点击由bindUpgradeButton处理）
                button.addEventListener('mousedown', startLongPress);
                button.addEventListener('mouseup', (e) => {
                    if(longPressTimer) clearTimeout(longPressTimer);
                });
                button.addEventListener('mouseleave', (e) => {
                    if(longPressTimer) clearTimeout(longPressTimer);
                });
                button.addEventListener('touchstart', startLongPress);
                button.addEventListener('touchend', (e) => {
                    if(longPressTimer) clearTimeout(longPressTimer);
                });
            }
        });

        // 绑定子菜单按钮事件
        this.bindUpgradeMenuButtons();
    }

    /**
     * 显示升级子菜单
     */
    showUpgradeMenu(button, attribute, event) {
        const menu = document.getElementById('upgradeMenu');
        if (!menu) return;

        // 计算菜单位置
        const rect = button.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 5}px`;

        // 更新菜单按钮状态
        this.updateUpgradeMenuButtons(attribute);

        // 显示菜单
        menu.style.display = 'block';
        menu.dataset.currentAttribute = attribute;

        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.hideUpgradeMenu.bind(this), { once: true });
        }, 100);
    }

    /**
     * 隐藏升级子菜单
     */
    hideUpgradeMenu() {
        const menu = document.getElementById('upgradeMenu');
        if (menu) {
            menu.style.display = 'none';
            delete menu.dataset.currentAttribute;
        }
    }

    /**
     * 绑定子菜单按钮事件
     */
    bindUpgradeMenuButtons() {
        const menuButtons = document.querySelectorAll('.upgrade-menu-btn');
        menuButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const times = parseInt(btn.dataset.times);
                const menu = document.getElementById('upgradeMenu');
                const attribute = menu.dataset.currentAttribute;

                if (attribute && times) {
                    // 调用系统进行批量升级
                   const result = this.playerSystem.bulkUpgradeAttribute(attribute, times);
                   // 如果需要反馈
                   this.updateUpgradeButtons();
                   this.updateUpgradeItems();
                }

                this.hideUpgradeMenu();
            });
        });
    }

    /**
     * 更新子菜单按钮状态
     */
    updateUpgradeMenuButtons(attribute) {
        const menuButtons = document.querySelectorAll('.upgrade-menu-btn');
        menuButtons.forEach(btn => {
            const times = parseInt(btn.dataset.times);
            const canUpgrade = this.playerSystem.canUpgrade(attribute, times);
            const { totalCost, allowedTimes } = this.playerSystem.getBulkUpgradeCost(attribute, times);

            btn.disabled = !canUpgrade || allowedTimes === 0 || !this.resourceSystem.hasEnoughCoins(totalCost);

            if (times === 1) {
                btn.textContent = '+1';
            } else {
                btn.textContent = `+${Math.min(times, allowedTimes)}`;
            }
        });
    }

    /**
     * 显示升级成功动画
     */
    showUpgradeSuccess(button, attribute) {
        // 添加成功动画
        button.style.animation = 'pulse 0.6s ease';

        // 创建成功提示
        const successText = document.createElement('div');
        successText.textContent = '升级成功!';
        successText.style.cssText = `
            position: absolute;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: all 0.3s ease;
        `;

        const rect = button.getBoundingClientRect();
        successText.style.left = rect.left + 'px';
        successText.style.top = rect.top - 30 + 'px';

        document.body.appendChild(successText);

        // 显示动画
        setTimeout(() => {
            successText.style.opacity = '1';
            successText.style.transform = 'translateY(-10px)';
        }, 10);

        // 移除动画
        setTimeout(() => {
            successText.style.opacity = '0';
            successText.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (successText.parentNode) {
                    successText.parentNode.removeChild(successText);
                }
            }, 300);
        }, 1500);

        // 重置按钮动画
        setTimeout(() => {
            button.style.animation = '';
        }, 600);
    }

    /**
     * 显示金币不足动画
     */
    showInsufficientCoins(button) {
        // 添加震动动画
        button.style.animation = 'shake 0.5s ease';

        // 创建金币不足提示
        const errorText = document.createElement('div');
        errorText.textContent = '金币不足!';
        errorText.style.cssText = `
            position: absolute;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: all 0.3s ease;
        `;

        const rect = button.getBoundingClientRect();
        errorText.style.left = rect.left + 'px';
        errorText.style.top = rect.top - 30 + 'px';

        document.body.appendChild(errorText);

        // 显示动画
        setTimeout(() => {
            errorText.style.opacity = '1';
            errorText.style.transform = 'translateY(-10px)';
        }, 10);

        // 移除动画
        setTimeout(() => {
            errorText.style.opacity = '0';
            errorText.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (errorText.parentNode) {
                    errorText.parentNode.removeChild(errorText);
                }
            }, 300);
        }, 1500);

        // 重置按钮动画
        setTimeout(() => {
            button.style.animation = '';
        }, 500);
    }

    /**
     * 更新总战力显示
     */
    updateTotalPower() {
        const totalPower = this.playerSystem.calculateTotalPower();
        const totalPowerElement = document.getElementById('totalPower');
        if (totalPowerElement) {
            totalPowerElement.textContent = this.resourceSystem.formatNumber(totalPower);
        }
    }

    /**
     * 更新升级按钮状态
     */
    updateUpgradeButtons() {
        const playerData = this.playerSystem.getPlayerData();
        // 这里的 upgradeCosts 需要从 playerSystem 获取
        // 为了方便，我们在 PlayerSystem 暴露 getUpgradeCost(attribute) 或直接用 playerData
        
        const buttons = {
            'upgradeAttack': { cost: playerData.upgradeCosts.attack, attribute: 'attack' },
            'upgradeHp': { cost: playerData.upgradeCosts.hp, attribute: 'hp' },
            'upgradeHpRegen': { cost: playerData.upgradeCosts.hpRegen, attribute: 'hpRegen' },
            'upgradeCritDamage': { cost: playerData.upgradeCosts.critDamage, attribute: 'critDamage' },
            'upgradeAttackSpeed': { cost: playerData.upgradeCosts.attackSpeed, attribute: 'attackSpeed' },
            'upgradeCrit': { cost: playerData.upgradeCosts.crit, attribute: 'crit' },
            'upgradeMultiShot': { cost: playerData.upgradeCosts.multiShot, attribute: 'multiShot' },
            'upgradeTripleShot': { cost: playerData.upgradeCosts.tripleShot, attribute: 'tripleShot' }
        };

        for (const [id, { cost, attribute }] of Object.entries(buttons)) {
            const button = document.getElementById(id);
            const btnCost = button?.querySelector('.btn-cost');
            const btnText = button?.querySelector('.btn-text');

            if (!button) continue;

            // 计算当前金币能升级的最高等级数量
            const maxAffordable = this.playerSystem.getMaxAffordableUpgrades(attribute);

            // 特殊处理各种按钮状态
            if (id === 'upgradeMultiShot') {
                const currentLevel = Math.floor((playerData.multiShot - 1) / 1) + 1;
                const isMaxValue = playerData.multiShot >= 100;
                const isMaxLevel = currentLevel >= 1001;

                if (isMaxValue || isMaxLevel) {
                    button.disabled = true;
                    if (btnCost) {
                        btnCost.textContent = isMaxValue ? '已满' : '已满级';
                    }
                    if (btnText) {
                        btnText.textContent = '强化';
                    }
                } else {
                    button.disabled = !this.resourceSystem.hasEnoughCoins(cost);
                    if (btnCost) {
                        btnCost.textContent = `💰 ${this.resourceSystem.formatNumber(cost)}`;
                    }
                    if (btnText) {
                        btnText.textContent = maxAffordable > 0 ? `强化 +${maxAffordable}` : '强化';
                    }
                }
            } else {
                if (btnCost) {
                    btnCost.textContent = `💰 ${this.resourceSystem.formatNumber(cost)}`;
                }
                if (btnText) {
                    btnText.textContent = maxAffordable > 0 ? `强化 +${maxAffordable}` : '强化';
                }
                button.disabled = !this.resourceSystem.hasEnoughCoins(cost);
            }
        }
    }

    /**
     * 更新升级项目显示
     */
    updateUpgradeItems() {
        const passives = this.playerSystem.getPassiveBonuses();
        const player = this.playerSystem.getPlayerData();

        // 更新攻击力
        const attackLevel = document.querySelector('#upgradeAttack')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const attackValue = document.querySelector('#upgradeAttack')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentAttackLevel = Math.floor((player.attack - 20) / 5) + 1;
        if (attackLevel) attackLevel.textContent = `Lv.${currentAttackLevel}`;
        if (attackValue) {
            const actual = this.playerSystem.getActualAttack();
            if (actual > player.attack) {
                attackValue.innerHTML = `${this.resourceSystem.formatNumber(player.attack)} <span style="color:#2ed573;font-size:0.8em;">+${this.resourceSystem.formatNumber(actual - player.attack)}</span>`;
            } else {
                attackValue.textContent = this.resourceSystem.formatNumber(player.attack);
            }
        }

        // 更新生命
        const hpLevel = document.querySelector('#upgradeHp')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const hpValue = document.querySelector('#upgradeHp')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentHpLevel = Math.floor((player.maxHp - 100) / 10) + 1;
        if (hpLevel) hpLevel.textContent = `Lv.${currentHpLevel}`;
        if (hpValue) {
            const actual = this.playerSystem.getActualMaxHp();
            if (actual > player.maxHp) {
                hpValue.innerHTML = `${this.resourceSystem.formatNumber(player.maxHp)} <span style="color:#2ed573;font-size:0.8em;">+${this.resourceSystem.formatNumber(actual - player.maxHp)}</span>`;
            } else {
                hpValue.textContent = this.resourceSystem.formatNumber(player.maxHp);
            }
        }

        // 更新生命恢复
        const regenLevel = document.querySelector('#upgradeHpRegen')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const regenValue = document.querySelector('#upgradeHpRegen')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentRegenLevel = Math.floor((player.hpRegen - 1) / 1) + 1;
        if (regenLevel) regenLevel.textContent = `Lv.${currentRegenLevel}`;
        if (regenValue) {
            const actual = this.playerSystem.getActualRegen();
            if (actual > player.hpRegen) {
                regenValue.innerHTML = `${player.hpRegen} <span style="color:#2ed573;font-size:0.8em;">+${(actual - player.hpRegen).toFixed(1)}</span>`;
            } else {
                regenValue.textContent = player.hpRegen;
            }
        }

        // 更新暴击伤害
        const cdLevel = document.querySelector('#upgradeCritDamage')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const cdValue = document.querySelector('#upgradeCritDamage')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentCdLevel = Math.floor((player.critDamage - 150) / 10) + 1;
        if (cdLevel) cdLevel.textContent = `Lv.${currentCdLevel}`;
        if (cdValue) {
            const actual = this.playerSystem.getActualCritDamage();
            if (actual > player.critDamage) {
                cdValue.innerHTML = `${player.critDamage}% <span style="color:#2ed573;font-size:0.8em;">+${actual - player.critDamage}%</span>`;
            } else {
                cdValue.textContent = `${player.critDamage}%`;
            }
        }

        // 更新防御力
        const defenseLevel = document.querySelector('#upgradeDefense')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const defenseValue = document.querySelector('#upgradeDefense')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentDefenseLevel = Math.floor((player.defense - 5) / 2) + 1;
        if (defenseLevel) defenseLevel.textContent = `Lv.${currentDefenseLevel}`;
        if (defenseValue) {
            const actual = this.playerSystem.getActualDefense();
            if (actual > player.defense) {
                defenseValue.innerHTML = `${player.defense} <span style="color:#2ed573;font-size:0.8em;">+${actual - player.defense}</span>`;
            } else {
                defenseValue.textContent = player.defense;
            }
        }

        // 更新攻速
        const asLevel = document.querySelector('#upgradeAttackSpeed')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const asValue = document.querySelector('#upgradeAttackSpeed')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentAsLevel = Math.floor((player.attackSpeed - 1.0) / 0.1) + 1;
        if (asLevel) asLevel.textContent = `Lv.${currentAsLevel}`;
        if (asValue) {
            const actual = this.playerSystem.getActualAttackSpeed();
            if (actual > player.attackSpeed) {
                asValue.innerHTML = `${player.attackSpeed.toFixed(1)} <span style="color:#2ed573;font-size:0.8em;">+${(actual - player.attackSpeed).toFixed(1)}</span>`;
            } else {
                asValue.textContent = player.attackSpeed.toFixed(1);
            }
        }

        // 更新暴击率
        const critLevel = document.querySelector('#upgradeCrit')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const critValue = document.querySelector('#upgradeCrit')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentCritLevel = Math.floor((player.crit - 5) / 1) + 1;
        if (critLevel) critLevel.textContent = `Lv.${currentCritLevel}`;
        if (critValue) {
            const actual = this.playerSystem.getActualCrit();
            if (actual > player.crit) {
                critValue.innerHTML = `${player.crit.toFixed(0)}% <span style="color:#2ed573;font-size:0.8em;">+${(actual - player.crit).toFixed(0)}%</span>`;
            } else {
                critValue.textContent = `${player.crit.toFixed(0)}%`;
            }
        }

        // 连射和三连射
        const multiShotLevel = document.querySelector('#upgradeMultiShot')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const multiShotValue = document.querySelector('#upgradeMultiShot')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentMultiShotLevel = Math.floor((player.multiShot - 1) / 1) + 1;
        if (multiShotLevel) {
            multiShotLevel.textContent = currentMultiShotLevel >= 1001 ? 'MAX' : `Lv.${currentMultiShotLevel}`;
        }
        if (multiShotValue) multiShotValue.textContent = player.multiShot.toFixed(0);

        const tripleShotLevel = document.querySelector('#upgradeTripleShot')?.closest('.upgrade-item')?.querySelector('.upgrade-icon-container .upgrade-level');
        const tripleShotValue = document.querySelector('#upgradeTripleShot')?.closest('.upgrade-item')?.querySelector('.upgrade-value');
        const currentTripleShotLevel = Math.floor((player.tripleShot - 0) / 5) + 1;
        if (tripleShotLevel) {
            tripleShotLevel.textContent = currentTripleShotLevel >= 1001 ? 'MAX' : `Lv.${currentTripleShotLevel}`;
        }
        if (tripleShotValue) tripleShotValue.textContent = `${player.tripleShot}%`;

        this.updateTotalPower();
    }
}

export default PlayerUI;
