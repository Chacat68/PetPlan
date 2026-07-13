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
        this.version = '1.3.0';
        
        // 存档前缀
        this.storagePrefix = 'petplan_save_';
        this.legacyStoragePrefix = 'petplan_save_slot';
        
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

    getStorageKey(slot) {
        return this.storagePrefix + slot;
    }

    getLegacyStorageKey(slot) {
        return this.legacyStoragePrefix + slot;
    }

    isValidSlot(slot) {
        return Number.isInteger(slot) && slot >= 1 && slot <= this.maxSlots;
    }

    /**
     * 将 1.0 时期的顶层存档与当前嵌套存档统一为当前结构。
     */
    normalizeSaveData(rawSaveData, slot = 1) {
        if (!rawSaveData || typeof rawSaveData !== 'object') return null;
        if (!rawSaveData.version || !Number.isFinite(Number(rawSaveData.timestamp))) {
            return null;
        }

        const currentData = rawSaveData.data;
        const hasCurrentShape =
            currentData && typeof currentData === 'object' && !Array.isArray(currentData);
        const sourceData = hasCurrentShape
            ? currentData
            : {
                player: rawSaveData.player,
                resource: rawSaveData.resources ?? rawSaveData.resource,
                combat: rawSaveData.combat,
                pet: rawSaveData.pets ?? rawSaveData.pet,
                territory: rawSaveData.territory,
                fate: rawSaveData.fate,
                progression: rawSaveData.progression,
                achievement: rawSaveData.achievement
            };
        const knownKeys = [
            'player',
            'resource',
            'combat',
            'pet',
            'territory',
            'fate',
            'progression',
            'achievement'
        ];

        if (!knownKeys.some((key) => sourceData[key] !== undefined)) {
            return null;
        }

        const data = {};
        knownKeys.forEach((key) => {
            if (sourceData[key] !== undefined) data[key] = sourceData[key];
        });

        // 旧存档不包含命运与进度模块，加载空值可避免串入当前会话状态。
        data.fate ??= {};
        data.progression ??= {};

        return {
            version: this.version,
            timestamp: Number(rawSaveData.timestamp),
            slot,
            level:
                rawSaveData.level ??
                rawSaveData.slotInfo?.playerLevel ??
                data.player?.level ??
                data.player?.player?.level ??
                1,
            data
        };
    }

    readStoredSave(slot) {
        const candidates = [
            { key: this.getStorageKey(slot), legacyKey: false },
            { key: this.getLegacyStorageKey(slot), legacyKey: true }
        ];

        for (const candidate of candidates) {
            const serialized = localStorage.getItem(candidate.key);
            if (serialized) return { ...candidate, serialized };
        }

        return null;
    }

    applySaveData(saveData) {
        const data = saveData.data;

        // 资源先恢复，为玩家、宠物和领地的后续刷新提供正确依赖。
        if (data.resource && this.gameSystems.resource) {
            this.gameSystems.resource.loadSaveData(data.resource);
        }
        if (data.territory && this.gameSystems.territory) {
            this.gameSystems.territory.loadSaveData(data.territory);
        }
        if (data.player && this.gameSystems.player) {
            this.gameSystems.player.loadSaveData(data.player);
        }
        if (data.combat && this.gameSystems.combat) {
            this.gameSystems.combat.loadSaveData(data.combat);
        }
        if (data.pet && this.gameSystems.pet) {
            this.gameSystems.pet.loadSaveData(data.pet);
        }
        if (this.gameSystems.fate) {
            this.gameSystems.fate.loadSaveData(data.fate ?? {});
        }
        if (this.gameSystems.progression) {
            this.gameSystems.progression.loadSaveData(data.progression ?? {});
        }
        if (this.gameSystems.achievement) {
            const achievementData = data.achievement ?? {
                claimedAchievementIds: data.progression?.claimedAchievementIds ?? []
            };
            this.gameSystems.achievement.loadSaveData(achievementData);
        }
    }
    
    /**
     * 保存游戏
     */
    async saveGame(slot) {
        if (!this.isValidSlot(slot)) {
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

            if (this.gameSystems.pet) {
                saveData.data.pet = this.gameSystems.pet.getSaveData();
            }

            if (this.gameSystems.territory) {
                saveData.data.territory = this.gameSystems.territory.getSaveData();
            }

            if (this.gameSystems.fate) {
                saveData.data.fate = this.gameSystems.fate.getSaveData();
            }

            if (this.gameSystems.progression) {
                saveData.data.progression = this.gameSystems.progression.getSaveData();
            }

            if (this.gameSystems.achievement) {
                saveData.data.achievement = this.gameSystems.achievement.getSaveData();
            }
            
            // 保存到 LocalStorage
            const key = this.getStorageKey(slot);
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
        if (!this.isValidSlot(slot)) {
            console.error('[SaveSystem] 无效的存档槽位:', slot);
            return false;
        }
        
        try {
            const storedSave = this.readStoredSave(slot);

            if (!storedSave) {
                console.log('[SaveSystem] 槽位为空:', slot);
                return false;
            }

            const rawSaveData = JSON.parse(storedSave.serialized);
            const saveData = this.normalizeSaveData(rawSaveData, slot);

            if (!saveData) {
                console.error('[SaveSystem] 无效的存档格式');
                return false;
            }

            this.applySaveData(saveData);

            const isMigratedShape = !rawSaveData.data || rawSaveData.version !== this.version;
            if (storedSave.legacyKey || isMigratedShape) {
                if (this.gameSystems.achievement) {
                    saveData.data.achievement = this.gameSystems.achievement.getSaveData();
                }
                const currentKey = this.getStorageKey(slot);
                if (!storedSave.legacyKey && !localStorage.getItem(`${currentKey}_legacy_backup`)) {
                    localStorage.setItem(`${currentKey}_legacy_backup`, storedSave.serialized);
                }
                localStorage.setItem(currentKey, JSON.stringify(saveData));
                console.log('[SaveSystem] 已迁移旧版存档:', slot);
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
        if (!this.isValidSlot(slot)) {
            return false;
        }
        
        try {
            localStorage.removeItem(this.getStorageKey(slot));
            localStorage.removeItem(this.getLegacyStorageKey(slot));
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
            const storedSave = this.readStoredSave(slot);
            if (!storedSave) return null;

            const saveData = this.normalizeSaveData(
                JSON.parse(storedSave.serialized),
                slot
            );
            if (!saveData) return null;

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
            const storedSave = this.readStoredSave(slot);

            if (!storedSave) {
                console.error('[SaveSystem] 槽位为空');
                return;
            }

            const saveData = this.normalizeSaveData(
                JSON.parse(storedSave.serialized),
                slot
            );
            if (!saveData) {
                console.error('[SaveSystem] 无效的存档格式');
                return;
            }

            const blob = new Blob([JSON.stringify(saveData)], { type: 'application/json' });
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
        if (!this.isValidSlot(slot)) return false;

        return new Promise((resolve) => {
            try {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    try {
                        const parsedSaveData = JSON.parse(e.target.result);
                        const saveData = this.normalizeSaveData(parsedSaveData, slot);

                        if (!saveData) {
                            console.error('[SaveSystem] 无效的存档文件');
                            resolve(false);
                            return;
                        }

                        const key = this.getStorageKey(slot);
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
