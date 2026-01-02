/**
 * PetPlan - 游戏主入口
 * 负责初始化和协调所有子系统
 */

import { GameCore, getGameCoreInstance } from "./modules/game-core.js";
import {
  ResourceSystem,
  getResourceSystemInstance,
} from "./modules/resource-system.js";
import {
  PlayerSystem,
  getPlayerSystemInstance,
} from "./modules/player-system.js";
import {
  CombatSystem,
  getCombatSystemInstance,
} from "./modules/combat-system.js";
import { SaveSystem, getSaveSystemInstance } from "./modules/save-system.js";
import { UISystem, getUISystemInstance } from "./modules/ui-system.js";
import { PetSystem, getPetSystemInstance } from "./modules/pet-system.js";

class Game {
  constructor() {
    console.log("[Game] 初始化游戏...");

    // 获取 Canvas
    this.canvas = document.getElementById("gameCanvas");
    if (!this.canvas) {
      console.error("[Game] ❌ 无法找到游戏画布");
      return;
    }

    this.ctx = this.canvas.getContext("2d");
    this.isInitialized = false;
  }

  /**
   * 初始化所有系统
   */
  async init() {
    console.log("[Game] 初始化系统...");

    try {
      // 1. 初始化资源系统（最先，其他系统依赖）
      this.resourceSystem = getResourceSystemInstance();

      // 2. 初始化玩家系统
      this.playerSystem = getPlayerSystemInstance();
      this.playerSystem.setResourceSystem(this.resourceSystem);

      // 3. 初始化宠物系统
      this.petSystem = getPetSystemInstance();
      this.petSystem.setResourceSystem(this.resourceSystem);
      this.petSystem.setPlayerSystem(this.playerSystem);
      
      // 默认解锁一只火焰犬作为示例
      if (this.petSystem.unlockedPets.length === 0) {
        this.petSystem.unlockPet(1);  // 火焰犬
        if (this.petSystem.unlockedPets.length > 0) {
          this.petSystem.equipPet(this.petSystem.unlockedPets[0].instanceId);
        }
      }

      // 4. 初始化战斗系统
      this.combatSystem = getCombatSystemInstance();
      this.combatSystem.setPlayerSystem(this.playerSystem);
      this.combatSystem.setResourceSystem(this.resourceSystem);

      // 5. 初始化存档系统
      this.saveSystem = getSaveSystemInstance();
      this.saveSystem.setGameSystems({
        player: this.playerSystem,
        resource: this.resourceSystem,
        combat: this.combatSystem,
        pet: this.petSystem,
      });

      // 6. 初始化 UI 系统
      this.uiSystem = getUISystemInstance();

      // 7. 初始化游戏核心
      this.gameCore = getGameCoreInstance(this.canvas);
      this.gameCore.setSystems({
        player: this.playerSystem,
        combat: this.combatSystem,
        resource: this.resourceSystem,
        ui: this.uiSystem,
        save: this.saveSystem,
        pet: this.petSystem,
      });

      // 绑定事件
      this.bindEvents();

      // 尝试加载存档
      await this.saveSystem.loadGame(1);

      // 更新 UI
      this.updateUI();

      // 启动游戏循环
      this.gameCore.start();

      this.isInitialized = true;
      console.log("[Game] ✅ 游戏初始化完成");
    } catch (error) {
      console.error("[Game] ❌ 初始化失败:", error);
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 升级按钮事件
    document.querySelectorAll(".upgrade-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const attr = e.currentTarget.dataset.attr;
        this.handleUpgrade(attr);
      });
    });

    // 底部导航事件
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.handleNavigation(tab);
      });
    });

    // 快捷键
    document.addEventListener("keydown", (e) => {
      if (e.key === "F5") {
        e.preventDefault();
        this.quickSave();
      } else if (e.key === "F9") {
        e.preventDefault();
        this.quickLoad();
      } else if (e.key === "Escape") {
        this.closePlayerModal();
      }
    });

    // 玩家信息弹窗事件
    this.bindPlayerModalEvents();
  }

  /**
   * 绑定玩家信息弹窗事件
   */
  bindPlayerModalEvents() {
    const playerInfo = document.querySelector(".player-info");
    const modalOverlay = document.getElementById("player-modal-overlay");
    const closeBtn = document.getElementById("player-modal-close");
    const settingsBtn = document.getElementById("settings-btn");
    const saveBtn = document.getElementById("save-game-btn");

    console.log("[Game] 绑定玩家弹窗事件, playerInfo:", playerInfo);

    // 点击左上角头像打开弹窗
    if (playerInfo) {
      playerInfo.addEventListener("click", (e) => {
        console.log("[Game] 头像被点击!", e);
        this.openPlayerModal();
      });
      console.log("[Game] ✅ 头像点击事件已绑定");
    } else {
      console.error("[Game] ❌ 找不到 .player-info 元素");
    }

    // 关闭按钮
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.closePlayerModal();
      });
    }

    // 点击遮罩层关闭
    if (modalOverlay) {
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
          this.closePlayerModal();
        }
      });
    }

    // 设置按钮
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        this.closePlayerModal();
        this.openSettingsModal();
      });
    }

    // 存档按钮
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        await this.quickSave();
        this.closePlayerModal();
      });
    }

    // 绑定设置弹窗事件
    this.bindSettingsModalEvents();
  }

  /**
   * 绑定设置弹窗事件
   */
  bindSettingsModalEvents() {
    const settingsOverlay = document.getElementById("settings-modal-overlay");
    const settingsClose = document.getElementById("settings-modal-close");
    const settingsSave = document.getElementById("settings-save-btn");

    // 关闭按钮
    if (settingsClose) {
      settingsClose.addEventListener("click", () => {
        this.closeSettingsModal();
      });
    }

    // 点击遮罩层关闭
    if (settingsOverlay) {
      settingsOverlay.addEventListener("click", (e) => {
        if (e.target === settingsOverlay) {
          this.closeSettingsModal();
        }
      });
    }

    // 保存设置按钮
    if (settingsSave) {
      settingsSave.addEventListener("click", () => {
        this.saveSettings();
        this.closeSettingsModal();
        this.uiSystem.showToast("设置已保存", "success");
      });
    }

    // 加载已保存的设置
    this.loadSettings();
  }

  /**
   * 打开玩家信息弹窗
   */
  openPlayerModal() {
    const modalOverlay = document.getElementById("player-modal-overlay");
    if (!modalOverlay) return;

    // 更新弹窗中的玩家信息
    this.updatePlayerModalInfo();
    
    modalOverlay.classList.add("active");
  }

  /**
   * 关闭玩家信息弹窗
   */
  closePlayerModal() {
    const modalOverlay = document.getElementById("player-modal-overlay");
    if (modalOverlay) {
      modalOverlay.classList.remove("active");
    }
  }

  /**
   * 打开设置弹窗
   */
  openSettingsModal() {
    const modalOverlay = document.getElementById("settings-modal-overlay");
    if (modalOverlay) {
      modalOverlay.classList.add("active");
    }
  }

  /**
   * 关闭设置弹窗
   */
  closeSettingsModal() {
    const modalOverlay = document.getElementById("settings-modal-overlay");
    if (modalOverlay) {
      modalOverlay.classList.remove("active");
    }
  }

  /**
   * 加载设置
   */
  loadSettings() {
    try {
      const savedSettings = localStorage.getItem("petplan_settings");
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        // 设置分辨率单选按钮
        if (settings.resolution) {
          const radio = document.querySelector(`input[name="resolution"][value="${settings.resolution}"]`);
          if (radio) {
            radio.checked = true;
          }
        }
        
        // 应用分辨率设置
        this.applyResolution(settings.resolution || "auto");
        
        console.log("[Game] 设置已加载:", settings);
      }
    } catch (error) {
      console.error("[Game] 加载设置失败:", error);
    }
  }

  /**
   * 保存设置
   */
  saveSettings() {
    const resolution = document.querySelector('input[name="resolution"]:checked')?.value || "auto";
    
    const settings = {
      resolution,
    };
    
    try {
      localStorage.setItem("petplan_settings", JSON.stringify(settings));
      
      // 应用分辨率设置
      this.applyResolution(resolution);
      
      console.log("[Game] 设置已保存:", settings);
    } catch (error) {
      console.error("[Game] 保存设置失败:", error);
    }
  }

  /**
   * 应用分辨率设置
   */
  applyResolution(resolution) {
    if (!this.gameCore) return;
    
    let width, height;
    
    switch (resolution) {
      case "720":
        width = 1280;
        height = 720;
        break;
      case "1080":
        width = 1920;
        height = 1080;
        break;
      case "auto":
      default:
        // 自动模式：使用容器尺寸
        width = null;
        height = null;
        break;
    }
    
    // 调用 GameCore 的分辨率设置方法
    if (this.gameCore.setResolution) {
      this.gameCore.setResolution(width, height);
    }
    
    console.log(`[Game] 分辨率设置: ${resolution} (${width || 'auto'}×${height || 'auto'})`);
  }

  /**
   * 更新弹窗中的玩家信息
   */
  updatePlayerModalInfo() {
    const player = this.playerSystem?.player;
    
    // 空值检查
    if (!player || !this.resourceSystem) {
      console.warn("[Game] 玩家或资源系统尚未初始化");
      return;
    }
    
    const power = this.playerSystem.calculateTotalPower();
    // ResourceSystem 的货币直接存储在实例上，不是 resources 对象
    const coins = this.resourceSystem.coins || 0;
    const crystals = this.resourceSystem.crystals || 0;

    const nicknameEl = document.getElementById("modal-nickname");
    const levelEl = document.getElementById("modal-level");
    const powerEl = document.getElementById("modal-power");
    const coinsEl = document.getElementById("modal-coins");
    const crystalsEl = document.getElementById("modal-crystals");

    if (nicknameEl) nicknameEl.textContent = player.name || "勇者";
    if (levelEl) levelEl.textContent = `Lv.${player.level}`;
    if (powerEl) powerEl.textContent = this.resourceSystem.formatNumber(power);
    if (coinsEl) coinsEl.textContent = this.resourceSystem.formatNumber(coins);
    if (crystalsEl) crystalsEl.textContent = this.resourceSystem.formatNumber(crystals);
  }

  /**
   * 处理属性升级
   */
  handleUpgrade(attr) {
    const result = this.playerSystem.upgradeAttribute(attr);
    if (result.success) {
      this.uiSystem.showToast(result.message, "success");
      this.updateUI();
    } else {
      this.uiSystem.showToast(result.message, "error");
    }
  }

  /**
   * 处理导航切换
   */
  handleNavigation(tab) {
    // 更新按钮状态
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    // TODO: 切换面板显示
    console.log("[Game] 切换到:", tab);
  }

  /**
   * 快速保存
   */
  async quickSave() {
    const result = await this.saveSystem.saveGame(1);
    if (result) {
      this.uiSystem.showToast("已保存", "success");
    }
  }

  /**
   * 快速加载
   */
  async quickLoad() {
    const result = await this.saveSystem.loadGame(1);
    if (result) {
      this.updateUI();
      this.uiSystem.showToast("已加载", "success");
    }
  }

  /**
   * 更新 UI 显示
   */
  updateUI() {
    // 更新货币显示
    this.resourceSystem.updateDisplay();

    // 更新玩家属性显示
    this.playerSystem.updateDisplay();

    // 更新战力显示
    const power = this.playerSystem.calculateTotalPower();
    const powerDisplay = document.getElementById("power-display");
    if (powerDisplay) {
      powerDisplay.textContent = this.resourceSystem.formatNumber(power);
    }

    // 更新等级显示
    const levelDisplay = document.querySelector(".player-level");
    if (levelDisplay) {
      levelDisplay.textContent = `Lv.${this.playerSystem.player.level}`;
    }
  }
}

// 启动游戏
document.addEventListener("DOMContentLoaded", () => {
  window.game = new Game();
  window.game.init();
});
