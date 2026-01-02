/**
 * SaveSystem - 存档系统
 * 管理游戏数据的保存、加载和备份
 */

let instance = null;

export class SaveSystem {
    constructor() {
        // 存档槽位数
        this.maxSlots = 5;
        
        // 存档版本
        this.version = '1.0.0';
        
        // 存档前缀
        this.storagePrefix = 'petplan_save_';
        
        // 系统引用
        this.gameSystems = {};
        
        console.log('[SaveSystem] 初始化完成');
    }
    
    /**
     * 设置游戏系统引用
     */
    setGameSystems(systems) {
        this.gameSystems = systems;
    }
    
    /**
     * 保存游戏
     */
    async saveGame(slot) {
        if (slot < 1 || slot > this.maxSlots) {
            console.error('[SaveSystem] 无效的存档槽位:', slot);
            return false;
        }
        
        try {
            const saveData = {
                version: this.version,
                timestamp: Date.now(),
                slot: slot,
                data: {}
            };
            
            // 收集各系统数据
            if (this.gameSystems.player) {
                saveData.data.player = this.gameSystems.player.getSaveData();
                saveData.level = this.gameSystems.player.player.level;
            }
            
            if (this.gameSystems.resource) {
                saveData.data.resource = this.gameSystems.resource.getSaveData();
            }
            
            if (this.gameSystems.combat) {
                saveData.data.combat = this.gameSystems.combat.getSaveData();
            }
            
            // 保存到 LocalStorage
            const key = this.storagePrefix + slot;
            localStorage.setItem(key, JSON.stringify(saveData));
            
            console.log('[SaveSystem] ✅ 保存成功:', slot);
            return true;
            
        } catch (error) {
            console.error('[SaveSystem] ❌ 保存失败:', error);
            return false;
        }
    }
    
    /**
     * 加载游戏
     */
    async loadGame(slot) {
        if (slot < 1 || slot > this.maxSlots) {
            console.error('[SaveSystem] 无效的存档槽位:', slot);
            return false;
        }
        
        try {
            const key = this.storagePrefix + slot;
            const saveDataStr = localStorage.getItem(key);
            
            if (!saveDataStr) {
                console.log('[SaveSystem] 槽位为空:', slot);
                return false;
            }
            
            const saveData = JSON.parse(saveDataStr);
            
            // 验证版本
            if (!saveData.version || !saveData.timestamp) {
                console.error('[SaveSystem] 无效的存档格式');
                return false;
            }
            
            // 恢复各系统数据
            if (saveData.data.player && this.gameSystems.player) {
                this.gameSystems.player.loadSaveData(saveData.data.player);
            }
            
            if (saveData.data.resource && this.gameSystems.resource) {
                this.gameSystems.resource.loadSaveData(saveData.data.resource);
            }
            
            if (saveData.data.combat && this.gameSystems.combat) {
                this.gameSystems.combat.loadSaveData(saveData.data.combat);
            }
            
            console.log('[SaveSystem] ✅ 加载成功:', slot);
            return true;
            
        } catch (error) {
            console.error('[SaveSystem] ❌ 加载失败:', error);
            return false;
        }
    }
    
    /**
     * 删除存档
     */
    async deleteGame(slot) {
        if (slot < 1 || slot > this.maxSlots) {
            return false;
        }
        
        try {
            const key = this.storagePrefix + slot;
            localStorage.removeItem(key);
            console.log('[SaveSystem] 存档已删除:', slot);
            return true;
        } catch (error) {
            console.error('[SaveSystem] 删除失败:', error);
            return false;
        }
    }
    
    /**
     * 获取存档信息
     */
    getSaveInfo(slot) {
        try {
            const key = this.storagePrefix + slot;
            const saveDataStr = localStorage.getItem(key);
            
            if (!saveDataStr) return null;
            
            const saveData = JSON.parse(saveDataStr);
            return {
                slot: slot,
                timestamp: saveData.timestamp,
                level: saveData.level || 1,
                version: saveData.version
            };
        } catch (error) {
            return null;
        }
    }
    
    /**
     * 获取所有存档信息
     */
    getAllSaveInfos() {
        const infos = [];
        for (let i = 1; i <= this.maxSlots; i++) {
            infos.push(this.getSaveInfo(i));
        }
        return infos;
    }
    
    /**
     * 导出存档
     */
    exportSave(slot) {
        try {
            const key = this.storagePrefix + slot;
            const saveDataStr = localStorage.getItem(key);
            
            if (!saveDataStr) {
                console.error('[SaveSystem] 槽位为空');
                return;
            }
            
            const blob = new Blob([saveDataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `petplan_save_${slot}_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            console.log('[SaveSystem] 导出成功');
        } catch (error) {
            console.error('[SaveSystem] 导出失败:', error);
        }
    }
    
    /**
     * 导入存档
     */
    async importSave(file, slot) {
        return new Promise((resolve) => {
            try {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    try {
                        const saveData = JSON.parse(e.target.result);
                        
                        if (!saveData.version || !saveData.timestamp) {
                            console.error('[SaveSystem] 无效的存档文件');
                            resolve(false);
                            return;
                        }
                        
                        const key = this.storagePrefix + slot;
                        localStorage.setItem(key, JSON.stringify(saveData));
                        
                        console.log('[SaveSystem] 导入成功');
                        resolve(true);
                    } catch (error) {
                        console.error('[SaveSystem] 解析失败:', error);
                        resolve(false);
                    }
                };
                
                reader.onerror = () => {
                    console.error('[SaveSystem] 读取文件失败');
                    resolve(false);
                };
                
                reader.readAsText(file);
            } catch (error) {
                console.error('[SaveSystem] 导入失败:', error);
                resolve(false);
            }
        });
    }
}

/**
 * 获取单例实例
 */
export function getSaveSystemInstance() {
    if (!instance) {
        instance = new SaveSystem();
    }
    return instance;
}
