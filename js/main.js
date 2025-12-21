/**
 * Pet Plan - 主入口文件
 * 负责初始化游戏和协调各个模块
 */

import GameCore from './modules/game-core.js';
import PlayerSystem from './modules/player-system.js';
import CombatController from './modules/combat/CombatController.js';
import UISystem, { uiSystem } from './modules/ui-system.js';
import ResourceSystem from './modules/resource-system.js';
import { getSaveSystemInstance } from './modules/save-system.js';
import { getTerritorySystemInstance } from './modules/territory-system.js';
import SaveUI from './modules/save-ui.js';
import { getPetSystemInstance } from './modules/pet-system.js';
import { getPetUIInstance } from './modules/pet-ui.js';
import AchievementSystem from './modules/achievement-system.js';
import AchievementUI from './modules/achievement-ui.js';
import { getEquipmentSystemInstance } from './modules/equipment-system.js';
import { getEquipmentUIInstance } from './modules/equipment-ui.js';
import OfflineSystem from './modules/offline-system.js';
import PlayerUI from './modules/player-ui.js';

class Game {
    constructor() {
        console.log('[Game] 开始构造 Game 实例...');
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('[Game] ❌ 无法找到游戏画布元素');
            return;
        }
        console.log('[Game] ✓ Canvas 元素已找到');

        // 初始化各个系统
        this.gameCore = new GameCore(this.canvas);
        this.resourceSystem = ResourceSystem.getInstance();
        this.territorySystem = getTerritorySystemInstance(this.resourceSystem);
        this.equipmentSystem = getEquipmentSystemInstance(this.resourceSystem);
        this.petSystem = getPetSystemInstance(this.gameCore, this.resourceSystem);
        this.playerSystem = new PlayerSystem(this.gameCore, this.resourceSystem);
        // 使用新的 CombatController
        this.combatSystem = new CombatController(this.gameCore, this.playerSystem, this.resourceSystem);
        this.uiSystem = uiSystem; // 使用单例实例
        this.saveSystem = getSaveSystemInstance();
        this.saveUI = null; // 稍后初始化
        this.petUI = null; // 稍后初始化
        this.achievementSystem = new AchievementSystem(this.resourceSystem);
        this.achievementUI = new AchievementUI(this.achievementSystem, document.body);
        this.equipmentUI = null; // 稍后初始化
        this.playerUI = new PlayerUI(this.playerSystem, this.resourceSystem); // 初始化玩家UI
        this.offlineSystem = null; // 稍后初始化

        // 设置宠物系统和战斗系统的双向引用
        this.combatSystem.setPetSystem(this.petSystem);
        this.petSystem.setCombatSystem(this.combatSystem);

        // 设置系统间的引用
        this.gameCore.setSystems(this.playerSystem, this.combatSystem, this.uiSystem, this.resourceSystem, this.territorySystem, this.saveSystem, this.petSystem, null, this.achievementSystem);
        this.saveSystem.setSystems(this.playerSystem, this.territorySystem, this.resourceSystem, this.combatSystem, this.petSystem, null, this.achievementSystem);

        // 绑定成就系统到其他系统 (如果支持)
        if (this.combatSystem.setAchievementSystem) this.combatSystem.setAchievementSystem(this.achievementSystem);
        if (this.resourceSystem.setAchievementSystem) this.resourceSystem.setAchievementSystem(this.achievementSystem);
        if (this.playerSystem.setAchievementSystem) this.playerSystem.setAchievementSystem(this.achievementSystem);
        this.playerUI.setAchievementSystem(this.achievementSystem);

        // 游戏状态
        this.isInitialized = false;
    }

    /**
     * 初始化游戏
     */
    async init() {
        try {
            console.log('[Game] 开始初始化游戏...');
            // 已移除加载界面显示，直接进入初始化流程

            // 等待DOM完全加载
            await new Promise(resolve => setTimeout(resolve, 200));

            // 加载资源数据
            console.log('[Game] 加载资源数据...');
            this.resourceSystem.loadFromLocalStorage();

            // 初始化各个系统
            console.log('[Game] 初始化游戏核心...');
            this.gameCore.init();
            console.log('[Game] ✓ 游戏核心初始化完成');

            console.log('[Game] 初始化玩家系统...');
            this.playerSystem.init();
            this.playerUI.init();
            console.log('[Game] ✓ 玩家系统初始化完成');

            console.log('[Game] 初始化UI系统...');
            this.uiSystem.init();
            console.log('[Game] ✓ UI系统初始化完成');

            // 初始化存档UI
            console.log('[Game] 初始化存档UI...');
            this.saveUI = new SaveUI(this.saveSystem);
            console.log('[Game] ✓ 存档UI初始化完成');

            // 初始化宠物UI
            console.log('[Game] 初始化宠物UI...');
            this.petUI = getPetUIInstance(this.petSystem, this.resourceSystem);
            console.log('[Game] ✓ 宠物UI初始化完成');

            console.log('[Game] 初始化成就UI...');
            this.achievementSystem.init();
            this.achievementUI.init();

            // 初始化装备UI
            console.log('[Game] 初始化装备UI...');
            this.equipmentUI = getEquipmentUIInstance(this.equipmentSystem, this.resourceSystem);
            console.log('[Game] ✓ 装备UI初始化完成');

            // 初始化离线系统
            console.log('[Game] 初始化离线系统...');
            this.offlineSystem = new OfflineSystem(this.territorySystem, this.resourceSystem, this.uiSystem, this.saveSystem);
            this.offlineSystem.init();
            console.log('[Game] ✓ 离线系统初始化完成');

            // 等待系统初始化完成
            await new Promise(resolve => setTimeout(resolve, 300));

            // 不再显示或隐藏加载界面，保持主界面直接呈现

            // 启动游戏
            console.log('[Game] 启动游戏循环...');
            this.gameCore.start();
            console.log('[Game] ✓ 游戏循环已启动');

            // 触发主界面淡入动画
            console.log('[Game] 开始移除 initial-fade 类...');
            const container = document.querySelector('.game-container');
            if (container) {
                console.log('[Game] Container 当前类名:', container.className);
                console.log('[Game] Container 当前透明度:', getComputedStyle(container).opacity);
                container.classList.remove('initial-fade');
                container.classList.add('fade-in');
                console.log('[Game] Container 更新后类名:', container.className);
                console.log('[Game] ✓ 淡入动画已触发');
            } else {
                console.error('[Game] ❌ 未找到 game-container 元素！');
            }

            this.isInitialized = true;
            console.log('[Game] ✓ 游戏初始化完成');

        } catch (error) {
            console.error('[Game] ❌ 游戏初始化失败:', error);
            console.error('[Game] 错误堆栈:', error.stack);

            // 即使初始化失败也要显示界面
            const container = document.querySelector('.game-container');
            if (container) {
                console.log('[Game] 强制显示容器（初始化失败）');
                container.classList.remove('initial-fade');
                container.classList.add('fade-in');
            }

            this.showError('游戏初始化失败，请刷新页面重试');
            // 初始化失败仍不显示加载覆盖层
        }
    }

    /**
     * 显示加载界面
     */
    showLoadingScreen() {
        const gameLoadingScreen = document.getElementById('gameLoadingScreen');
        if (gameLoadingScreen) {
            gameLoadingScreen.style.display = 'flex';
        }
    }

    /**
     * 隐藏加载界面
     */
    hideLoadingScreen() {
        const gameLoadingScreen = document.getElementById('gameLoadingScreen');
        if (gameLoadingScreen) {
            gameLoadingScreen.style.display = 'none';
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #e74c3c;
            color: white;
            padding: 20px;
            border-radius: 8px;
            font-size: 16px;
            z-index: 10000;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
    }

    /**
     * 保存游戏数据（快速保存到槽位1）
     */
    saveGame() {
        return this.saveSystem.quickSave();
    }

    /**
     * 加载游戏数据（快速加载槽位1）
     */
    loadGame() {
        return this.saveSystem.quickLoad();
    }

    /**
     * 保存到指定槽位
     */
    saveToSlot(slot) {
        return this.saveSystem.saveGame(slot);
    }

    /**
     * 从指定槽位加载
     */
    loadFromSlot(slot) {
        return this.saveSystem.loadGame(slot);
    }

    /**
     * 获取所有存档信息
     */
    getAllSaves() {
        return this.saveSystem.getAllSaves();
    }

    /**
     * 删除存档
     */
    deleteSave(slot) {
        return this.saveSystem.deleteSave(slot);
    }

    /**
     * 导出存档
     */
    exportSave(slot) {
        this.saveSystem.exportSave(slot);
    }

    /**
     * 导入存档
     */
    async importSave(file, slot) {
        return await this.saveSystem.importSave(file, slot);
    }

    /**
     * 重置游戏数据
     */
    resetGame() {
        import('./modules/ui-system.js').then(({ showConfirm }) => {
            showConfirm('确定要重置游戏数据吗？此操作不可撤销！', () => {
                // 清除本地存储
                localStorage.removeItem('pet-plan-resources');
                localStorage.removeItem('pet-plan-player');

                // 重新加载页面
                location.reload();
            });
        });
    }

    /**
     * 暂停游戏
     */
    pause() {
        this.gameCore.stop();
        console.log('游戏已暂停');
    }

    /**
     * 恢复游戏
     */
    resume() {
        this.gameCore.start();
        console.log('游戏已恢复');
    }

    /**
     * 获取游戏状态
     */
    getGameState() {
        return {
            isInitialized: this.isInitialized,
            isRunning: this.gameCore.isRunning,
            playerData: this.playerSystem.getPlayerData(),
            resourceData: this.resourceSystem.getResourceData(),
            monsterCount: this.combatSystem.getMonsterCount(),
            bulletCount: this.combatSystem.getBulletCount()
        };
    }
}

// 全局游戏实例
let game = null;

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Main] DOMContentLoaded 事件触发');

    // 领地按钮跳转
    const territoryBtn = document.getElementById('territory-button');
    console.log('[Main] 领地按钮元素:', territoryBtn);
    if (territoryBtn) {
        territoryBtn.addEventListener('click', (e) => {
            console.log('[Main] 领地按钮被点击');
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'territory.html';
        });
        console.log('[Main] 领地按钮点击事件已绑定');
    } else {
        console.error('[Main] ❌ 未找到领地按钮元素 #territory-button');
    }

    const dailyBtn = document.getElementById('dailyBtn');
    if (dailyBtn) {
        dailyBtn.addEventListener('click', () => {
            if (window.game && window.game.achievementUI) {
                window.game.achievementUI.show();
            }
        });
    }

    // 菜单/设置按钮逻辑
    const settingsBtn = document.getElementById('settingsBtn');
    const characterModal = document.getElementById('characterModal');
    const closeModal = document.getElementById('closeModal');

    if (settingsBtn && characterModal) {
        settingsBtn.addEventListener('click', () => {
            characterModal.style.display = 'block';
        });
    }

    if (closeModal && characterModal) {
        closeModal.addEventListener('click', () => {
            characterModal.style.display = 'none';
        });
    }

    // 点击遮罩层关闭菜单
    if (characterModal) {
        characterModal.addEventListener('click', (e) => {
            if (e.target === characterModal) {
                characterModal.style.display = 'none';
            }
        });
    }

    try {
        // 确保DOM完全加载后再创建游戏实例
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('[Main] 开始创建 Game 实例...');
        game = new Game();
        console.log('[Main] Game 实例创建完成，开始初始化...');
        await game.init();
        window.game = game;
        console.log('[Main] ✓ 游戏初始化成功完成');

        // 自动保存在存档系统内部处理（通过gameCore的update调用）
        // 添加快捷键支持
        window.addEventListener('keydown', (e) => {
            if (game && game.isInitialized) {
                // F5 - 快速保存
                if (e.key === 'F5') {
                    e.preventDefault();
                    game.saveGame();
                    console.log('快速保存完成');
                }
                // F9 - 快速加载
                if (e.key === 'F9') {
                    e.preventDefault();
                    game.loadGame();
                    console.log('快速加载完成');
                }
            }
        });

        // 页面卸载前保存数据
        window.addEventListener('beforeunload', () => {
            if (game && game.isInitialized) {
                game.saveGame();
            }
        });

        // 页面可见性变化时暂停/恢复游戏
        document.addEventListener('visibilitychange', () => {
            if (game && game.isInitialized) {
                if (document.hidden) {
                    game.pause();
                } else {
                    game.resume();
                }
            }
        });



    } catch (error) {
        console.error('[Main] ❌ 游戏启动失败:', error);
        console.error('[Main] 错误堆栈:', error.stack);

        // 即使出错也要显示界面
        const container = document.querySelector('.game-container');
        if (container && container.classList.contains('initial-fade')) {
            console.log('[Main] 强制显示容器（启动失败）');
            container.classList.remove('initial-fade');
            container.style.opacity = '1';
        }
    }
});

// 安全网：3秒后如果界面还没显示，强制显示
setTimeout(() => {
    const container = document.querySelector('.game-container');
    if (container && container.classList.contains('initial-fade')) {
        console.warn('[Safety] ⚠️ 检测到界面仍未显示，强制显示...');
        container.classList.remove('initial-fade');
        container.style.opacity = '1';
        console.warn('[Safety] ✓ 界面已强制显示');
    }
}, 3000);

// 导出Game类供其他模块使用
export default Game;
