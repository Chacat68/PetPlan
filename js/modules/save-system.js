/**
 * 存档系统模块
 * 负责游戏数据的保存、加载、导出、导入等功能
 */

class SaveSystem {
    constructor() {
        // 存档配置
        this.savePrefix = 'petplan_save_';
        this.autoSaveInterval = 30000; // 自动保存间隔（毫秒）30秒
        this.autoSaveTimer = 0;
        this.maxSaveSlots = 5; // 最多5个存档位

        // 系统引用
        this.playerSystem = null;
        this.territorySystem = null;
        this.resourceSystem = null;
        this.combatSystem = null;

        console.log('存档系统初始化完成');
    }

    /**
     * 设置系统引用
     */
    setSystems(playerSystem, territorySystem, resourceSystem, combatSystem, petSystem = null, equipmentSystem = null) {
        this.playerSystem = playerSystem;
        this.territorySystem = territorySystem;
        this.resourceSystem = resourceSystem;
        this.combatSystem = combatSystem;
        this.petSystem = petSystem;
        this.equipmentSystem = equipmentSystem;
    }

    /**
     * 获取当前游戏状态
     * @returns {Object} 游戏状态数据
     */
    getGameState() {
        const gameState = {
            version: '1.0.0',
            timestamp: Date.now(),
            player: this.playerSystem ? this.playerSystem.getSaveData() : null,
            territory: this.territorySystem ? this.territorySystem.getSaveData() : null,
            resources: this.resourceSystem ? this.resourceSystem.getSaveData() : null,
            combat: this.combatSystem ? this.combatSystem.getSaveData() : null,
            pets: this.petSystem ? this.petSystem.getSaveData() : null,
            equipment: this.equipmentSystem ? this.equipmentSystem.getSaveData() : null
        };

        return gameState;
    }

    /**
     * 恢复游戏状态
     * @param {Object} gameState 游戏状态数据
     */
    setGameState(gameState) {
        if (!gameState) {
            console.error('无效的游戏状态数据');
            return false;
        }

        try {
            // 恢复资源系统（优先恢复，其他系统可能依赖它）
            if (gameState.resources && this.resourceSystem) {
                this.resourceSystem.loadSaveData(gameState.resources);
            }

            // 恢复领地系统
            if (gameState.territory && this.territorySystem) {
                this.territorySystem.loadSaveData(gameState.territory);
            }

            // 恢复玩家系统
            if (gameState.player && this.playerSystem) {
                this.playerSystem.loadSaveData(gameState.player);
            }

            // 恢复战斗系统
            if (gameState.combat && this.combatSystem) {
                this.combatSystem.loadSaveData(gameState.combat);
            }

            // 恢复宠物系统
            if (this.petSystem && gameState.pets) {
                this.petSystem.loadSaveData(gameState.pets);
            }

            // 7. 加载装备系统数据
            if (this.equipmentSystem && gameState.equipment) {
                this.equipmentSystem.loadSaveData(gameState.equipment);
            }

            console.log('游戏状态加载完成');
            return true;
        } catch (error) {
            console.error('恢复游戏状态失败:', error);
            return false;
        }
    }

    /**
     * 保存游戏到指定槽位
     * @param {number} slot 存档槽位 (1-5)
     * @returns {boolean} 保存是否成功
     */
    saveGame(slot = 1) {
        if (slot < 1 || slot > this.maxSaveSlots) {
            console.error(`无效的存档槽位: ${slot}`);
            return false;
        }

        try {
            const gameState = this.getGameState();
            const saveKey = `${this.savePrefix}slot${slot}`;

            // 添加存档元数据
            // 注意：player数据可能嵌套在player.player中，也可能有顶层level
            const playerLevel = gameState.player?.level || gameState.player?.player?.level || 1;
            const saveData = {
                ...gameState,
                slotInfo: {
                    slot: slot,
                    savedAt: new Date().toLocaleString('zh-CN'),
                    playerLevel: playerLevel,
                    coins: gameState.resources?.coins || 0
                }
            };

            localStorage.setItem(saveKey, JSON.stringify(saveData));
            console.log(`游戏已保存到槽位 ${slot}`);
            return true;
        } catch (error) {
            console.error(`保存游戏失败 (槽位 ${slot}):`, error);
            return false;
        }
    }

    /**
     * 从指定槽位加载游戏
     * @param {number} slot 存档槽位 (1-5)
     * @returns {boolean} 加载是否成功
     */
    loadGame(slot = 1) {
        if (slot < 1 || slot > this.maxSaveSlots) {
            console.error(`无效的存档槽位: ${slot}`);
            return false;
        }

        try {
            const saveKey = `${this.savePrefix}slot${slot}`;
            const saveDataStr = localStorage.getItem(saveKey);

            if (!saveDataStr) {
                console.warn(`槽位 ${slot} 没有存档`);
                return false;
            }

            const saveData = JSON.parse(saveDataStr);
            const success = this.setGameState(saveData);

            if (success) {
                console.log(`游戏已从槽位 ${slot} 加载`);
            }

            return success;
        } catch (error) {
            console.error(`加载游戏失败 (槽位 ${slot}):`, error);
            return false;
        }
    }

    /**
     * 删除指定槽位的存档
     * @param {number} slot 存档槽位 (1-5)
     * @returns {boolean} 删除是否成功
     */
    deleteSave(slot) {
        if (slot < 1 || slot > this.maxSaveSlots) {
            console.error(`无效的存档槽位: ${slot}`);
            return false;
        }

        try {
            const saveKey = `${this.savePrefix}slot${slot}`;
            localStorage.removeItem(saveKey);
            console.log(`槽位 ${slot} 的存档已删除`);
            return true;
        } catch (error) {
            console.error(`删除存档失败 (槽位 ${slot}):`, error);
            return false;
        }
    }

    /**
     * 获取所有存档信息
     * @returns {Array} 存档信息列表
     */
    getAllSaves() {
        const saves = [];

        for (let slot = 1; slot <= this.maxSaveSlots; slot++) {
            const saveKey = `${this.savePrefix}slot${slot}`;
            const saveDataStr = localStorage.getItem(saveKey);

            if (saveDataStr) {
                try {
                    const saveData = JSON.parse(saveDataStr);
                    saves.push({
                        slot: slot,
                        slotInfo: saveData.slotInfo || {},
                        exists: true
                    });
                } catch (error) {
                    console.error(`读取槽位 ${slot} 失败:`, error);
                    saves.push({
                        slot: slot,
                        exists: false
                    });
                }
            } else {
                saves.push({
                    slot: slot,
                    exists: false
                });
            }
        }

        return saves;
    }

    /**
     * 导出存档为JSON文件
     * @param {number} slot 存档槽位
     */
    exportSave(slot = 1) {
        const saveKey = `${this.savePrefix}slot${slot}`;
        const saveDataStr = localStorage.getItem(saveKey);

        if (!saveDataStr) {
            console.warn(`槽位 ${slot} 没有存档可导出`);
            return;
        }

        try {
            const blob = new Blob([saveDataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `petplan_save_slot${slot}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log(`槽位 ${slot} 的存档已导出`);
        } catch (error) {
            console.error('导出存档失败:', error);
        }
    }

    /**
     * 从文件导入存档
     * @param {File} file JSON文件
     * @param {number} slot 目标存档槽位
     * @returns {Promise<boolean>} 导入是否成功
     */
    async importSave(file, slot = 1) {
        if (slot < 1 || slot > this.maxSaveSlots) {
            console.error(`无效的存档槽位: ${slot}`);
            return false;
        }

        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const saveDataStr = e.target.result;
                    const saveData = JSON.parse(saveDataStr);

                    // 验证存档数据
                    if (!saveData.version || !saveData.timestamp) {
                        console.error('无效的存档文件格式');
                        resolve(false);
                        return;
                    }

                    // 更新槽位信息
                    saveData.slotInfo = {
                        ...saveData.slotInfo,
                        slot: slot,
                        importedAt: new Date().toLocaleString('zh-CN')
                    };

                    // 保存到指定槽位
                    const saveKey = `${this.savePrefix}slot${slot}`;
                    localStorage.setItem(saveKey, JSON.stringify(saveData));

                    console.log(`存档已导入到槽位 ${slot}`);
                    resolve(true);
                } catch (error) {
                    console.error('导入存档失败:', error);
                    resolve(false);
                }
            };

            reader.onerror = () => {
                console.error('读取文件失败');
                resolve(false);
            };

            reader.readAsText(file);
        });
    }

    /**
     * 自动保存更新（在游戏主循环中调用）
     * @param {number} deltaTime 帧间隔时间
     */
    updateAutoSave(deltaTime) {
        this.autoSaveTimer += deltaTime;

        if (this.autoSaveTimer >= this.autoSaveInterval) {
            this.autoSave();
            this.autoSaveTimer = 0;
        }
    }

    /**
     * 自动保存到槽位1
     */
    autoSave() {
        const success = this.saveGame(1);
        if (success) {
            console.log('自动保存完成');
            // 可以在这里显示自动保存提示
            this.showAutoSaveNotification();
        }
    }

    /**
     * 显示自动保存提示
     */
    showAutoSaveNotification() {
        // 创建提示元素
        const notification = document.createElement('div');
        notification.className = 'auto-save-notification';
        notification.textContent = '游戏已自动保存';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 10000;
            animation: fadeInOut 2s ease-in-out;
        `;

        document.body.appendChild(notification);

        // 2秒后移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }

    /**
     * 快速保存（快捷键用）
     */
    quickSave() {
        return this.saveGame(1);
    }

    /**
     * 快速加载（快捷键用）
     */
    quickLoad() {
        return this.loadGame(1);
    }

    /**
     * 清空所有存档
     */
    clearAllSaves() {
        for (let slot = 1; slot <= this.maxSaveSlots; slot++) {
            this.deleteSave(slot);
        }
        console.log('所有存档已清空');
    }
}

// 单例模式
let saveSystemInstance = null;

export function getSaveSystemInstance() {
    if (!saveSystemInstance) {
        saveSystemInstance = new SaveSystem();
    }
    return saveSystemInstance;
}

export default SaveSystem;
