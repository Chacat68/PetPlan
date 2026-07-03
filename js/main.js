/**
 * PetPlan - 游戏主入口
 * 负责初始化和协调所有子系统
 */

import { GameCore, getGameCoreInstance } from "./modules/game-core.js?v=monster-sequences-20260701a";
import {
  ResourceSystem,
  getResourceSystemInstance,
} from "./modules/resource-system.js";
import {
  PlayerSystem,
  getPlayerSystemInstance,
} from "./modules/player-system.js?v=hero-upgrade-loop-20260703a";
import {
  CombatSystem,
  getCombatSystemInstance,
} from "./modules/combat-system.js?v=gun-muzzle-20260703a";
import { SaveSystem, getSaveSystemInstance } from "./modules/save-system.js";
import { UISystem, getUISystemInstance } from "./modules/ui-system.js";
import { PetSystem, getPetSystemInstance } from "./modules/pet-system.js?v=pet-actions-20260702a";
import {
  TerritorySystem,
  getTerritorySystemInstance,
} from "./modules/territory-system.js?v=territory-loop-20260703a";
import { getFateCoinSystemInstance } from "./modules/fate-coin-system.js?v=fate-coins-20260702c";

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

    // 当前场景
    this.currentScene = "fate";
    this.fateDropSerial = 0;
    this.fateHelperWave = 0;
    this.petModalTab = "formation";
    this.achievementModalTab = "achievements";
    this.seenTerritoryUnlocks = new Set();
  }

  /**
   * 初始化所有系统
   */
  async init() {
    console.log("[Game] 初始化系统...");

    try {
      // 1. 初始化资源系统（最先，其他系统依赖）
      this.resourceSystem = getResourceSystemInstance();

      // 2. 初始化命运硬币系统（首页核心成长线）
      this.fateCoinSystem = getFateCoinSystemInstance();
      this.fateCoinSystem.setOnChange(() => this.updateFateDisplay());
      this.fateCoinSystem.setOnAutoFlip((result) =>
        this.handleFateAutoFlip(result)
      );

      // 3. 初始化玩家系统
      this.playerSystem = getPlayerSystemInstance();
      this.playerSystem.setResourceSystem(this.resourceSystem);

      // 4. 初始化宠物系统
      this.petSystem = getPetSystemInstance();
      this.petSystem.setResourceSystem(this.resourceSystem);
      this.petSystem.setPlayerSystem(this.playerSystem);

      // 默认解锁一只火焰犬作为示例
      if (this.petSystem.unlockedPets.length === 0) {
        this.petSystem.unlockPet(1); // 火焰犬
        if (this.petSystem.unlockedPets.length > 0) {
          this.petSystem.equipPet(this.petSystem.unlockedPets[0].instanceId);
        }
      }

      // 5. 初始化战斗系统
      this.combatSystem = getCombatSystemInstance();
      this.combatSystem.setPlayerSystem(this.playerSystem);
      this.combatSystem.setResourceSystem(this.resourceSystem);
      this.combatSystem.isPaused = true;
      if (typeof this.playerSystem.setCombatSystem === "function") {
        this.playerSystem.setCombatSystem(this.combatSystem);
      }
      this.petSystem.setCombatSystem(this.combatSystem);

      // 6. 初始化领地系统
      this.territorySystem = getTerritorySystemInstance(
        this.resourceSystem,
        this.playerSystem
      );
      this.territorySystem.loadFromLocalStorage();
      if (typeof this.combatSystem.setTerritorySystem === "function") {
        this.combatSystem.setTerritorySystem(this.territorySystem);
      }

      // 7. 初始化存档系统
      this.saveSystem = getSaveSystemInstance();
      this.saveSystem.setGameSystems({
        player: this.playerSystem,
        resource: this.resourceSystem,
        combat: this.combatSystem,
        pet: this.petSystem,
        territory: this.territorySystem,
        fate: this.fateCoinSystem,
      });

      // 8. 初始化 UI 系统
      this.uiSystem = getUISystemInstance();

      // 9. 初始化游戏核心
      this.gameCore = getGameCoreInstance(this.canvas);
      this.gameCore.setSystems({
        player: this.playerSystem,
        combat: this.combatSystem,
        resource: this.resourceSystem,
        ui: this.uiSystem,
        save: this.saveSystem,
        pet: this.petSystem,
        territory: this.territorySystem,
        fate: this.fateCoinSystem,
      });

      // 初始化领地 UI
      this.initTerritoryUI();

      // 绑定事件
      this.bindEvents();

      // 尝试加载存档
      await this.saveSystem.loadGame(1);
      this.syncTerritoryProgress({ silent: true });

      // 更新 UI
      this.updateUI();
      this.handleNavigation("fate", true);

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
        this.closePetModal();
        this.closeAchievementModal();
        this.closeSettingsModal();
        this.closePlayerModal();
      }
    });

    // 玩家信息弹窗事件
    this.bindPlayerModalEvents();

    // 命运桌事件
    this.bindFateEvents();
  }

  /**
   * 绑定命运桌事件
   */
  bindFateEvents() {
    const actions = {
      "fate-buy-coin-btn": "coin",
      "fate-buy-gold-btn": "gold",
      "fate-buy-assistant-btn": "assistant",
      "fate-upgrade-manual-btn": "manual",
      "fate-skill-tree-btn": "manual",
      "fate-upgrade-speed-btn": "speed",
      "fate-train-hero-btn": "hero",
      "fate-train-pet-btn": "pet",
    };

    Object.entries(actions).forEach(([id, action]) => {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener("click", () => this.handleFateUpgrade(action));
      }
    });
  }

  /**
   * 绑定玩家信息弹窗事件
   */
  bindPlayerModalEvents() {
    const playerInfoButtons = document.querySelectorAll(
      ".player-info, #game-player-btn"
    );
    const modalOverlay = document.getElementById("player-modal-overlay");
    const closeBtn = document.getElementById("player-modal-close");
    const gameSettingsBtn = document.getElementById("game-settings-btn");

    // 玩家信息按钮
    playerInfoButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.openPlayerModal();
      });
    });

    // 关闭按钮
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.closePlayerModal();
      });
    }

    // 点击遮罩层关闭
    if (modalOverlay) {
      modalOverlay.addEventListener("click", (e) => {
        const closeTrigger =
          e.target instanceof Element
            ? e.target.closest("#player-modal-close")
            : null;
        if (closeTrigger || e.target === modalOverlay) {
          this.closePlayerModal();
        }
      });
    }

    if (gameSettingsBtn) {
      gameSettingsBtn.addEventListener("click", () => {
        this.openSettingsModal();
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
    const quickSaveBtn = document.getElementById("settings-quick-save-btn");
    const quickLoadBtn = document.getElementById("settings-quick-load-btn");

    // 关闭按钮
    if (settingsClose) {
      settingsClose.addEventListener("click", () => {
        this.closeSettingsModal();
      });
    }

    // 点击遮罩层关闭
    if (settingsOverlay) {
      settingsOverlay.addEventListener("click", (e) => {
        const closeTrigger =
          e.target instanceof Element
            ? e.target.closest("#settings-modal-close")
            : null;
        if (closeTrigger || e.target === settingsOverlay) {
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

    if (quickSaveBtn) {
      quickSaveBtn.addEventListener("click", async () => {
        await this.quickSave();
      });
    }

    if (quickLoadBtn) {
      quickLoadBtn.addEventListener("click", async () => {
        await this.quickLoad();
        this.updatePlayerUpgradeControls();
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

    // 更新主角升级面板
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
      this.updateSettingsPanelStatus();
      modalOverlay.querySelector(".settings-content")?.scrollTo({ top: 0 });
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

  getSceneLabel() {
    const sceneLabels = {
      fate: "命运",
      dungeon: "战斗",
      territory: "领地",
    };

    return sceneLabels[this.currentScene] || "命运";
  }

  formatSettingsSaveTime(timestamp) {
    if (!timestamp) return "未保存";

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "未保存";

    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  updateSettingsPanelStatus() {
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText("settings-scene-label", this.getSceneLabel());

    const saveInfo = this.saveSystem?.getSaveInfo?.(1);
    if (!saveInfo) {
      setText("settings-save-time", "未保存");
      setText("settings-save-level", "Lv.1");
      setText("settings-save-version", "-");
      return;
    }

    setText("settings-save-time", this.formatSettingsSaveTime(saveInfo.timestamp));
    setText("settings-save-level", `Lv.${saveInfo.level || 1}`);
    setText("settings-save-version", saveInfo.version || "-");
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
          const radio = document.querySelector(
            `input[name="resolution"][value="${settings.resolution}"]`
          );
          if (radio) {
            radio.checked = true;
          }
        }

        // 应用分辨率设置
        this.applyResolution(settings.resolution || "pc");

        console.log("[Game] 设置已加载:", settings);
      }
      this.updateSettingsPanelStatus();
    } catch (error) {
      console.error("[Game] 加载设置失败:", error);
    }
  }

  /**
   * 保存设置
   */
  saveSettings() {
    const resolution =
      document.querySelector('input[name="resolution"]:checked')?.value ||
      "pc";

    const settings = {
      resolution,
    };

    try {
      localStorage.setItem("petplan_settings", JSON.stringify(settings));

      // 应用分辨率设置
      this.applyResolution(resolution);

      console.log("[Game] 设置已保存:", settings);
      this.updateSettingsPanelStatus();
    } catch (error) {
      console.error("[Game] 保存设置失败:", error);
    }
  }

  /**
   * 应用分辨率设置
   */
  applyResolution(resolution) {
    if (!this.gameCore) return;

    // 统一使用 PC 16:9 自适应舞台，避免设置页把各页面改成不同大小。
    const root = document.documentElement;
    root.style.setProperty("--game-width", "min(100vw, calc(100dvh * 16 / 9))");
    root.style.setProperty("--game-height", "min(100dvh, calc(100vw * 9 / 16))");
    root.style.setProperty("--top-bar-height", "0px");
    root.style.setProperty("--nav-height", "0px");
    root.style.setProperty("--canvas-height", "var(--game-height)");

    this.canvas.style.width = "";
    this.canvas.style.height = "";
    this.gameCore.fixedResolution = null;
    requestAnimationFrame(() => this.gameCore.resizeCanvas());

    console.log(`[Game] 分辨率设置: PC 自适应 16:9 (${resolution})`);
  }

  /**
   * 更新主角升级面板
   */
  updatePlayerModalInfo() {
    const player = this.playerSystem?.player;

    // 空值检查
    if (!player || !this.resourceSystem) {
      console.warn("[Game] 玩家或资源系统尚未初始化");
      return;
    }

    this.playerSystem.updateDisplay();
    this.updatePlayerUpgradeControls();
  }

  /**
   * 手动抛命运硬币
   */
  handleFateFlip(coin) {
    if (!this.fateCoinSystem) return;

    const face = this.getFateTableCoinFace(coin);
    const result = this.fateCoinSystem.manualFlip(face);
    if (coin) {
      this.playFateTableCoinClickFeedback(coin, face);
    }
    this.addFateResult(result);
    this.updateFateDisplay();
  }

  playFateTableCoinClickFeedback(coin, face) {
    if (!coin) return;

    coin.classList.remove("clicked");
    void coin.offsetWidth;
    coin.dataset.score = this.formatFateGainText(face);
    coin.classList.add("clicked");
  }

  formatFateGainText(face) {
    return face === "tails" ? "获得反面 +1" : "获得正面 +1";
  }

  /**
   * 处理助手自动抛币反馈
   */
  handleFateAutoFlip(request) {
    if (!request || request.cycles <= 0) return;

    if (this.currentScene !== "fate") {
      return;
    }

    this.queueFateHelperClicks(request.cycles);
  }

  /**
   * 处理命运桌升级
   */
  handleFateUpgrade(action) {
    if (!this.fateCoinSystem) return;

    const handlers = {
      coin: () => this.fateCoinSystem.buyFateCoin(),
      gold: () => this.buyFateGoldCoin(),
      assistant: () => this.fateCoinSystem.buyAssistant(),
      manual: () => this.fateCoinSystem.upgradeManualPower(),
      speed: () => this.fateCoinSystem.upgradeAssistantSpeed(),
      hero: () => this.trainHeroWithFate(),
      pet: () => this.trainPetsWithFate(),
    };

    const handler = handlers[action];
    if (!handler) return;

    const result = handler();
    this.updateUI();

    if (result.success) {
      this.uiSystem.showToast(result.message, "success");
    } else {
      this.uiSystem.showToast(result.message, "error");
    }
  }

  buyFateGoldCoin() {
    const beforeCount = this.fateCoinSystem.fateCoins;
    const result = this.fateCoinSystem.buyGoldCoin();

    if (result.success) {
      const addedCount = Math.max(
        1,
        this.fateCoinSystem.fateCoins - beforeCount
      );
      this.playNewFateTableCoinAnimation(addedCount);
    }

    return result;
  }

  playNewFateTableCoinAnimation(count = 1) {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const coins = Array.from(layer.querySelectorAll(".fate-table-coin"));
    const animatedCoins = coins.slice(-Math.max(1, Math.floor(count)));

    animatedCoins.forEach((coin) => {
      if (coin._fateSpawnEndHandler) {
        coin.removeEventListener("animationend", coin._fateSpawnEndHandler);
      }

      coin.classList.remove("spawned");
      void coin.offsetWidth;
      coin.classList.add("spawned");
      coin._fateSpawnEndHandler = (event) => {
        if (
          event.target !== coin ||
          event.animationName !== "fateTableCoinSpawn"
        ) {
          return;
        }

        coin.classList.remove("spawned");
        coin.removeEventListener("animationend", coin._fateSpawnEndHandler);
        coin._fateSpawnEndHandler = null;
      };
      coin.addEventListener("animationend", coin._fateSpawnEndHandler);
    });
  }

  getFateCoinReward() {
    const fateCoins = this.fateCoinSystem?.fateCoins || 1;
    return Math.max(10, Math.floor(25 * fateCoins));
  }

  getFateHeroTrainingCost() {
    const attack = this.playerSystem?.player?.attack || 20;
    const trainingLevel = Math.max(0, Math.round((attack - 20) / 5));

    return {
      heads: Math.floor(14 * Math.pow(1.32, trainingLevel)),
      tails: Math.floor(6 * Math.pow(1.24, trainingLevel)),
    };
  }

  getFatePetTrainingCost() {
    const equippedCount = this.petSystem?.equippedPets?.length || 0;
    const levelTotal =
      typeof this.petSystem?.getEquippedPetLevelTotal === "function"
        ? this.petSystem.getEquippedPetLevelTotal()
        : equippedCount;
    const trainingLevel = Math.max(0, levelTotal - equippedCount);

    return {
      heads: Math.floor(4 * Math.pow(1.18, trainingLevel)),
      tails: Math.floor(16 * Math.pow(1.34, trainingLevel)),
    };
  }

  exchangeFateForCoins() {
    if (!this.fateCoinSystem || !this.resourceSystem) {
      return { success: false, message: "资源系统未初始化" };
    }

    const cost = this.fateCoinSystem.getBuyGoldCoinCost();
    if (!this.fateCoinSystem.spend(cost)) {
      return { success: false, message: "正面不足" };
    }

    const reward = this.getFateCoinReward();
    this.resourceSystem.addCoins(reward);

    return {
      success: true,
      message: `金币 +${this.resourceSystem.formatNumber(reward)}`,
    };
  }

  trainHeroWithFate() {
    if (!this.fateCoinSystem || !this.playerSystem) {
      return { success: false, message: "训练系统未初始化" };
    }

    const cost = this.getFateHeroTrainingCost();
    if (!this.fateCoinSystem.spend(cost)) {
      return { success: false, message: "正面或反面不足" };
    }

    return this.playerSystem.applyFateTraining();
  }

  trainPetsWithFate() {
    if (!this.fateCoinSystem || !this.petSystem) {
      return { success: false, message: "宠物系统未初始化" };
    }

    if ((this.petSystem.equippedPets?.length || 0) === 0) {
      return { success: false, message: "没有装备宠物" };
    }

    const cost = this.getFatePetTrainingCost();
    if (!this.fateCoinSystem.spend(cost)) {
      return { success: false, message: "正面或反面不足" };
    }

    return this.petSystem.trainEquippedPets(1);
  }

  /**
   * 更新命运桌显示
   */
  updateFateDisplay() {
    if (!this.fateCoinSystem) return;

    const data = this.fateCoinSystem.getDisplayData();
    const format = (value) => this.fateCoinSystem.formatNumber(value);
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    const setDisabled = (id, disabled) => {
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    };

    setText("fate-coins-display", format(data.fateCoins));
    setText("heads-display", format(data.heads));
    setText("tails-display", format(data.tails));
    setText("fate-total-flips-display", format(data.goldCoins));
    setText("fate-assistants-display", format(data.assistants));
    setText("fate-manual-power-display", format(data.manualPower));
    setText(
      "fate-auto-rate-display",
      `${data.autoFlipsPerSecond.toFixed(1)} / 秒`
    );
    setText(
      "fate-auto-interval-display",
      `${(data.autoInterval / 1000).toFixed(1)} 秒`
    );
    setText(
      "fate-gold-effect",
      "桌面金币 +1"
    );
    setText(
      "fate-train-hero-effect",
      "攻击 +5 / 生命 +10"
    );
    const equippedPetCount = this.petSystem?.equippedPets?.length || 0;
    const equippedPetLevelTotal =
      typeof this.petSystem?.getEquippedPetLevelTotal === "function"
        ? this.petSystem.getEquippedPetLevelTotal()
        : equippedPetCount;
    setText(
      "fate-train-pet-effect",
      equippedPetCount > 0 ? `宠物 Lv 合计 ${equippedPetLevelTotal}` : "先装备宠物"
    );

    setText(
      "fate-buy-coin-cost",
      this.fateCoinSystem.formatCost(data.costs.fateCoin)
    );
    setText(
      "fate-buy-assistant-cost",
      this.fateCoinSystem.formatCost(data.costs.assistant)
    );
    setText(
      "fate-buy-gold-cost",
      this.fateCoinSystem.formatCost(data.costs.goldCoin)
    );
    setText(
      "fate-upgrade-manual-cost",
      this.fateCoinSystem.formatCost(data.costs.manual)
    );
    setText(
      "fate-upgrade-speed-cost",
      data.autoInterval <= 750
        ? "已达上限"
        : this.fateCoinSystem.formatCost(data.costs.assistantSpeed)
    );
    setText(
      "fate-train-hero-cost",
      this.fateCoinSystem.formatCost(this.getFateHeroTrainingCost())
    );
    setText(
      "fate-train-pet-cost",
      this.fateCoinSystem.formatCost(this.getFatePetTrainingCost())
    );

    setDisabled(
      "fate-buy-coin-btn",
      !this.fateCoinSystem.canAfford(data.costs.fateCoin)
    );
    setDisabled(
      "fate-buy-assistant-btn",
      !this.fateCoinSystem.canAfford(data.costs.assistant)
    );
    setDisabled(
      "fate-buy-gold-btn",
      !this.fateCoinSystem.canAfford(data.costs.goldCoin)
    );
    setDisabled(
      "fate-upgrade-manual-btn",
      !this.fateCoinSystem.canAfford(data.costs.manual)
    );
    setDisabled(
      "fate-skill-tree-btn",
      !this.fateCoinSystem.canAfford(data.costs.manual)
    );
    setDisabled(
      "fate-upgrade-speed-btn",
      data.autoInterval <= 750 ||
        !this.fateCoinSystem.canAfford(data.costs.assistantSpeed)
    );
    setDisabled(
      "fate-train-hero-btn",
      !this.fateCoinSystem.canAfford(this.getFateHeroTrainingCost())
    );
    setDisabled(
      "fate-train-pet-btn",
      (this.petSystem?.equippedPets?.length || 0) === 0 ||
        !this.fateCoinSystem.canAfford(this.getFatePetTrainingCost())
    );

    this.syncFateTableCoins(data.fateCoins);
    this.syncFateHelpers(data.assistants);
    this.syncTerritoryProgress();
  }

  /**
   * 添加命运桌结算反馈
   */
  addFateResult(result) {
    const feed = document.getElementById("fate-result-feed");
    if (!feed || !result) return;

    const item = document.createElement("div");
    item.className = "fate-result";
    if (result.flips === 1) {
      item.textContent = this.formatFateGainText(
        result.tails > 0 ? "tails" : "heads"
      );
    } else {
      item.textContent = `${result.flips} 次: +${result.heads} 正面 / +${result.tails} 反面`;
    }
    feed.prepend(item);

    while (feed.children.length > 4) {
      feed.removeChild(feed.lastElementChild);
    }
  }

  /**
   * 生成命运桌落地金币动画
   */
  addFateCoinDrops(result, options = {}) {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer || !result || result.flips <= 0) return;

    const width = layer.clientWidth;
    const height = layer.clientHeight;
    if (width <= 0 || height <= 0) return;

    const maxCoins = options.maxCoins || 10;
    const visualCount = Math.max(
      1,
      Math.min(maxCoins, Math.ceil(Math.sqrt(Math.min(result.flips, 144))))
    );
    const headsRatio = result.flips > 0 ? result.heads / result.flips : 0.5;
    const sourceY = height * (options.source === "auto" ? 0.18 : 0.24);
    const sourceX = width * 0.5;
    const laneMin = width * 0.31;
    const laneMax = width * 0.66;

    for (let i = 0; i < visualCount; i++) {
      const face = Math.random() < headsRatio ? "heads" : "tails";
      const startX = sourceX + (Math.random() - 0.5) * 34;
      const startY = sourceY + (Math.random() - 0.5) * 18;
      const landingX = laneMin + Math.random() * (laneMax - laneMin);
      const floorY = Math.min(
        height - 34,
        height * (0.74 + Math.random() * 0.18)
      );
      const fallDistance = Math.max(80, floorY - startY);
      const bounceHeight = 18 + Math.random() * 30;
      const duration = 720 + Math.random() * 190;
      const delay = i * 42 + Math.random() * 36;
      const scale = 0.82 + Math.random() * 0.28;
      const settleRotate = (Math.random() - 0.5) * 44;
      const driftX = landingX - startX;

      const coin = document.createElement("span");
      coin.className = `fate-ground-coin ${face} coin-variant-${
        this.fateDropSerial % 4
      }`;
      coin.style.left = `${startX}px`;
      coin.style.top = `${startY}px`;
      coin.style.setProperty("--drift-x", `${driftX}px`);
      coin.style.setProperty(
        "--pre-impact-y",
        `${fallDistance - bounceHeight * 1.4}px`
      );
      coin.style.setProperty("--impact-y", `${fallDistance}px`);
      coin.style.setProperty(
        "--first-hop-y",
        `${fallDistance - bounceHeight}px`
      );
      coin.style.setProperty(
        "--second-hop-y",
        `${fallDistance - bounceHeight * 0.35}px`
      );
      coin.style.setProperty("--drop-time", `${duration}ms`);
      coin.style.setProperty("--drop-delay", `${delay}ms`);
      coin.style.setProperty("--coin-scale", scale.toFixed(2));
      coin.style.setProperty("--settle-rotate", `${settleRotate}deg`);

      const frame = document.createElement("span");
      frame.className = "fate-ground-coin-frame";
      frame.textContent = face === "heads" ? "正" : "反";
      coin.appendChild(frame);

      coin.addEventListener("animationend", (event) => {
        if (event.target !== coin || event.animationName !== "fateCoinDrop") {
          return;
        }

        coin.classList.add("settled");
        this.pruneFateFloorCoins(layer);
      });

      layer.appendChild(coin);
      this.fateDropSerial += 1;
    }

    this.pruneFateFloorCoins(layer);
  }

  pruneFateFloorCoins(layer) {
    const maxFloorCoins = 56;
    const groundCoins = Array.from(layer.querySelectorAll(".fate-ground-coin"));

    while (groundCoins.length > maxFloorCoins) {
      const coin = groundCoins.shift();
      if (coin) coin.remove();
    }
  }

  syncFateTableCoins(targetCount) {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const activeCoins = Array.from(
      layer.querySelectorAll(".fate-table-coin")
    );
    const safeTarget = Math.max(1, Math.floor(targetCount || 1));

    while (activeCoins.length > safeTarget) {
      const coin = activeCoins.pop();
      if (coin) {
        this.clearFateTableCoinFaceLoop(coin);
        coin.remove();
      }
    }

    while (activeCoins.length < safeTarget) {
      const coin = this.createFateTableCoin(layer, activeCoins);
      if (!coin) return;
      activeCoins.push(coin);
    }
  }

  createFateTableCoin(layer, existingCoins = []) {
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    if (width <= 0 || height <= 0) return null;

    const coin = document.createElement("button");
    coin.type = "button";
    coin.className = "fate-table-coin";

    const point = this.findFateTableCoinPosition(layer, existingCoins);
    coin.dataset.x = String(point.x);
    coin.dataset.y = String(point.y);
    coin.style.left = `${point.x}px`;
    coin.style.top = `${point.y}px`;
    coin.style.setProperty(
      "--coin-rotate",
      `${(Math.random() - 0.5) * 18}deg`
    );
    coin.style.setProperty("--bounce-delay", `${Math.random() * -0.75}s`);
    this.setFateTableCoinFace(
      coin,
      Math.random() < 0.5 ? "heads" : "tails"
    );
    coin.innerHTML = `
      <span class="fate-table-coin-shadow"></span>
      <span class="fate-table-coin-body">
        <span class="fate-table-coin-face fate-table-coin-front">正</span>
        <span class="fate-table-coin-face fate-table-coin-back">反</span>
      </span>
    `;
    coin.addEventListener("click", () => this.handleFateFlip(coin));

    layer.appendChild(coin);
    this.startFateTableCoinFaceLoop(coin);
    return coin;
  }

  getFateTableCoinFace(coin) {
    return coin?.dataset.face === "tails" ? "tails" : "heads";
  }

  setFateTableCoinFace(coin, face) {
    const normalizedFace = face === "tails" ? "tails" : "heads";
    coin.dataset.face = normalizedFace;
    coin.dataset.score = this.formatFateGainText(normalizedFace);
    coin.setAttribute(
      "aria-label",
      normalizedFace === "heads"
        ? "当前正面，点击结算正面 +1"
        : "当前反面，点击结算反面 +1"
    );
  }

  startFateTableCoinFaceLoop(coin) {
    const flip = () => {
      if (!coin.isConnected) return;

      this.setFateTableCoinFace(
        coin,
        this.getFateTableCoinFace(coin) === "heads" ? "tails" : "heads"
      );
      coin._fateFaceTimer = window.setTimeout(flip, 525);
    };

    coin._fateFaceTimer = window.setTimeout(
      flip,
      180 + Math.random() * 360
    );
  }

  clearFateTableCoinFaceLoop(coin) {
    if (coin?._fateFaceTimer) {
      window.clearTimeout(coin._fateFaceTimer);
      coin._fateFaceTimer = 0;
    }
  }

  syncFateHelpers(targetCount) {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const helpers = Array.from(layer.querySelectorAll(".fate-helper"));
    const safeTarget = Math.max(0, Math.floor(targetCount || 0));

    while (helpers.length > safeTarget) {
      const helper = helpers.pop();
      if (helper) {
        this.clearFateHelperTimers(helper);
        helper.remove();
      }
    }

    while (helpers.length < safeTarget) {
      const helper = this.createFateHelper(layer, helpers.length);
      if (!helper) return;
      helpers.push(helper);
    }

    helpers.forEach((helper, index) => {
      helper.dataset.helperIndex = String(index);
    });
  }

  createFateHelper(layer, index) {
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    if (width <= 0 || height <= 0) return null;

    const helper = document.createElement("span");
    helper.className = "fate-helper";
    helper.dataset.state = "idle";
    helper.dataset.helperIndex = String(index);
    helper.setAttribute("aria-hidden", "true");
    helper.innerHTML = `
      <span class="fate-helper-shadow"></span>
      <span class="fate-helper-body">
        <span class="fate-helper-hood">
          <span class="fate-helper-eye left"></span>
          <span class="fate-helper-eye right"></span>
        </span>
        <span class="fate-helper-hand"></span>
        <span class="fate-helper-foot left"></span>
        <span class="fate-helper-foot right"></span>
      </span>
    `;

    const home = this.getFateHelperHomePosition(layer, index);
    helper._fateHelperState = {
      x: home.x,
      y: home.y,
      busy: false,
      actionTimer: 0,
      clickTimer: 0,
      resetTimer: 0,
    };
    helper.style.left = `${home.x}px`;
    helper.style.top = `${home.y}px`;

    layer.appendChild(helper);
    return helper;
  }

  getFateHelperHomePosition(layer, index) {
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    const x = this.clamp(48 + index * 34, 34, width - 34);
    const y = this.clamp(height * 0.76 + (index % 2) * 20, 42, height - 28);
    return { x, y };
  }

  queueFateHelperClicks(cycles = 1) {
    const safeCycles = Math.min(4, Math.max(1, Math.floor(cycles || 1)));

    for (let i = 0; i < safeCycles; i++) {
      window.setTimeout(() => this.runFateHelperClickWave(), i * 190);
    }
  }

  runFateHelperClickWave() {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const coins = Array.from(layer.querySelectorAll(".fate-table-coin"));
    const helpers = Array.from(layer.querySelectorAll(".fate-helper")).filter(
      (helper) => !helper._fateHelperState?.busy
    );
    if (coins.length === 0 || helpers.length === 0) return;

    helpers.forEach((helper, helperIndex) => {
      const coin = coins[(this.fateHelperWave + helperIndex) % coins.length];
      this.sendFateHelperToCoin(helper, coin, helperIndex);
    });
    this.fateHelperWave += 1;
  }

  sendFateHelperToCoin(helper, coin, helperIndex) {
    if (!helper || !coin || helper._fateHelperState?.busy) return;

    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const state = helper._fateHelperState;
    const point = this.getFateHelperCoinSidePosition(
      layer,
      coin,
      helperIndex
    );
    state.busy = true;
    state.targetCoin = coin;

    helper.dataset.state = "running";
    const path = this.createFateHelperWalkPath(
      layer,
      state.x,
      state.y,
      point.x,
      point.y,
      helperIndex
    );
    this.walkFateHelperPath(helper, path, () =>
      this.scheduleFateHelperClick(helper, coin, helperIndex)
    );
  }

  createFateHelperWalkPath(layer, startX, startY, endX, endY, helperIndex) {
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(3, Math.min(7, Math.ceil(distance / 68)));
    const normalX = distance > 0 ? -dy / distance : 0;
    const normalY = distance > 0 ? dx / distance : 0;
    const curve = (helperIndex % 2 === 0 ? 1 : -1) * Math.min(34, distance * 0.12);
    const path = [];

    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const arc = Math.sin(progress * Math.PI) * curve;
      path.push({
        x: this.clamp(startX + dx * progress + normalX * arc, 32, layer.clientWidth - 32),
        y: this.clamp(startY + dy * progress + normalY * arc, 34, layer.clientHeight - 26),
      });
    }

    return path;
  }

  walkFateHelperPath(helper, path, onComplete) {
    const state = helper?._fateHelperState;
    if (!helper || !state || path.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    window.clearTimeout(state.actionTimer);
    state.pathIndex = 0;

    const moveNext = () => {
      if (!helper.isConnected || !state.busy) return;

      const point = path[state.pathIndex];
      if (!point) {
        if (onComplete) onComplete();
        return;
      }

      this.addFateHelperStep(point.x, point.y, state.pathIndex);
      this.setFateHelperPosition(helper, point.x, point.y);
      state.pathIndex += 1;

      state.actionTimer = window.setTimeout(
        moveNext,
        state.pathIndex >= path.length ? 260 : 235
      );
    };

    moveNext();
  }

  addFateHelperStep(x, y, index) {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const step = document.createElement("span");
    step.className = `fate-helper-step ${index % 2 === 0 ? "left" : "right"}`;
    step.style.left = `${x}px`;
    step.style.top = `${y}px`;
    step.addEventListener("animationend", () => step.remove(), { once: true });
    layer.appendChild(step);
  }

  scheduleFateHelperClick(helper, coin, helperIndex) {
    if (!helper?.isConnected || !helper._fateHelperState?.busy) return;

    const state = helper._fateHelperState;
    const clickDelay = 160 + helperIndex * 180 + Math.random() * 520;
    helper.dataset.state = "ready";

    window.clearTimeout(state.clickTimer);
    state.clickTimer = window.setTimeout(
      () => this.resolveFateHelperClick(helper, coin),
      clickDelay
    );
  }

  getFateHelperCoinSidePosition(layer, coin, helperIndex) {
    const coinX = Number(coin.dataset.x || 0);
    const coinY = Number(coin.dataset.y || 0);
    const side = (this.fateHelperWave + helperIndex) % 2 === 0 ? -1 : 1;
    const verticalOffset = ((helperIndex % 3) - 1) * 8;

    return {
      x: this.clamp(coinX + side * 42, 32, layer.clientWidth - 32),
      y: this.clamp(coinY + 8 + verticalOffset, 34, layer.clientHeight - 26),
    };
  }

  setFateHelperPosition(helper, x, y) {
    const state = helper._fateHelperState;
    if (state) {
      state.x = x;
      state.y = y;
    }
    helper.style.left = `${x}px`;
    helper.style.top = `${y}px`;
  }

  resolveFateHelperClick(helper, coin) {
    if (!helper?.isConnected) return;

    const state = helper._fateHelperState;
    const canClick = coin?.isConnected && this.isFateHelperBesideCoin(helper, coin);

    if (canClick) {
      const face = this.getFateTableCoinFace(coin);
      const result = this.fateCoinSystem.assistantFlip(face);
      helper.dataset.state = "tap";
      this.playFateTableCoinClickFeedback(coin, face);
      this.addFateResult(result);
    } else {
      helper.dataset.state = "miss";
    }

    window.clearTimeout(state.resetTimer);
    state.resetTimer = window.setTimeout(() => {
      if (!helper.isConnected) return;
      state.busy = false;
      state.targetCoin = null;
      helper.dataset.state = "idle";
    }, 190);
  }

  isFateHelperBesideCoin(helper, coin) {
    const state = helper._fateHelperState;
    if (!state || !coin) return false;

    const coinX = Number(coin.dataset.x || 0);
    const coinY = Number(coin.dataset.y || 0);
    return Math.hypot(state.x - coinX, state.y - coinY) <= 58;
  }

  clearFateHelperTimers(helper) {
    const state = helper?._fateHelperState;
    if (!state) return;

    window.clearTimeout(state.actionTimer);
    window.clearTimeout(state.clickTimer);
    window.clearTimeout(state.resetTimer);
    state.actionTimer = 0;
    state.clickTimer = 0;
    state.resetTimer = 0;
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  findFateTableCoinPosition(layer, existingCoins) {
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    const radius = Math.max(46, Math.min(width, height) * 0.06);
    const existing = existingCoins.map((coin) => ({
      x: Number(coin.dataset.x || 0),
      y: Number(coin.dataset.y || 0),
    }));
    const area = {
      left: width * 0.35,
      right: width * 0.68,
      top: height * 0.26,
      bottom: height * 0.72,
    };

    for (let i = 0; i < 80; i++) {
      const point = {
        x: area.left + Math.random() * (area.right - area.left),
        y: area.top + Math.random() * (area.bottom - area.top),
      };

      if (this.isFateCoinPositionFree(point, existing, radius)) {
        return point;
      }
    }

    const columns = Math.max(1, Math.floor((area.right - area.left) / radius));
    const row = Math.floor(existing.length / columns);
    const col = existing.length % columns;
    return {
      x: Math.min(area.right, area.left + col * radius + radius * 0.5),
      y: Math.min(area.bottom, area.top + row * radius + radius * 0.5),
    };
  }

  isFateCoinPositionFree(point, existing, minDistance) {
    for (const other of existing) {
      const dx = point.x - other.x;
      const dy = point.y - other.y;
      if (Math.hypot(dx, dy) < minDistance) {
        return false;
      }
    }

    return true;
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

  updatePlayerUpgradeControls() {
    if (!this.playerSystem || !this.resourceSystem) return;

    const attrs = [
      "attack",
      "maxHp",
      "hpRegen",
      "critDamage",
      "attackSpeed",
      "crit",
      "multiShot",
    ];

    attrs.forEach((attr) => {
      const cost = this.playerSystem.upgradeCosts?.[attr] || 0;
      const limit = this.playerSystem.upgradeLimits?.[attr];
      const value = this.playerSystem.player?.[attr] || 0;
      const atLimit = limit !== undefined && value >= limit;
      const canAfford = this.resourceSystem.hasEnoughCoins(cost);

      document
        .querySelectorAll(`.upgrade-btn[data-attr="${attr}"]`)
        .forEach((button) => {
          button.disabled = atLimit || !canAfford;
          button.title = atLimit
            ? "已达上限"
            : canAfford
              ? ""
              : "金币不足";
        });
    });
  }

  escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[char];
    });
  }

  formatGameNumber(value) {
    if (this.resourceSystem?.formatNumber) {
      return this.resourceSystem.formatNumber(value);
    }
    return String(Math.floor(Number(value) || 0));
  }

  getPetTemplateForInstance(pet) {
    return this.petSystem?.getTemplate?.(pet.templateId);
  }

  getPetImageMarkup(template, className = "pet-thumb") {
    if (!template?.image) {
      return `<span>${this.escapeHTML(template?.emoji || "PET")}</span>`;
    }

    return `<img class="${this.escapeHTML(className)}" src="${this.escapeHTML(
      template.image
    )}" alt="${this.escapeHTML(template.name)}">`;
  }

  formatPetCost(cost = {}) {
    const parts = [];
    if ((cost.coins || 0) > 0) {
      parts.push(`金币 ${this.formatGameNumber(cost.coins)}`);
    }
    if ((cost.rubies || 0) > 0) {
      parts.push(`红宝石 ${this.formatGameNumber(cost.rubies)}`);
    }
    return parts.join(" / ") || "免费";
  }

  canUnlockPet(template) {
    if (!template) return { success: false, reason: "宠物不存在" };

    const owned = this.petSystem?.unlockedPets?.some(
      (pet) => pet.templateId === template.id
    );
    if (owned) return { success: false, reason: "已拥有" };

    const playerLevel = this.playerSystem?.player?.level || 1;
    if (playerLevel < template.requiredLevel) {
      return { success: false, reason: `需要 Lv.${template.requiredLevel}` };
    }

    if (!this.resourceSystem) {
      return { success: false, reason: "资源未初始化" };
    }

    if (!this.resourceSystem.hasEnoughCoins(template.cost?.coins || 0)) {
      return { success: false, reason: "金币不足" };
    }

    if (
      (template.cost?.rubies || 0) > 0 &&
      !this.resourceSystem.hasEnoughRubies(template.cost.rubies)
    ) {
      return { success: false, reason: "红宝石不足" };
    }

    return { success: true, reason: "可解锁" };
  }

  openPetModal(activeTab = this.petModalTab) {
    this.closeAchievementModal();
    this.petModalTab = activeTab || "formation";
    this.renderPetModal();
    document
      .querySelector("#pet-modal .pet-modal-close")
      ?.focus({ preventScroll: true });
  }

  closePetModal() {
    document.getElementById("pet-modal")?.remove();
  }

  renderPetModal() {
    document.getElementById("pet-modal")?.remove();

    const modal = document.createElement("div");
    modal.id = "pet-modal";
    modal.className = "pet-modal show";
    modal.innerHTML = `
      <div class="pet-modal-content" role="dialog" aria-modal="true" aria-labelledby="pet-modal-title">
        <div class="pet-modal-header">
          <h2 class="pet-modal-title" id="pet-modal-title">宠物</h2>
          <button class="pet-modal-close" type="button" aria-label="关闭宠物页面" data-pet-close>×</button>
        </div>
        <div class="pet-tabs" role="tablist" aria-label="宠物页面">
          ${this.renderPetTabButton("formation", "编队")}
          ${this.renderPetTabButton("bag", "背包")}
          ${this.renderPetTabButton("collection", "图鉴")}
        </div>
        <div class="pet-content">
          ${this.renderPetTabContent()}
        </div>
      </div>
    `;

    modal.addEventListener("click", (event) => {
      const target =
        event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target) return;

      if (target === modal || target.closest("[data-pet-close]")) {
        this.closePetModal();
        return;
      }

      const tabButton = target.closest("[data-pet-tab]");
      if (tabButton) {
        this.petModalTab = tabButton.dataset.petTab || "formation";
        this.renderPetModal();
        return;
      }

      const actionButton = target.closest("[data-pet-action]");
      if (actionButton) {
        this.handlePetModalAction(actionButton);
      }
    });

    document.body.appendChild(modal);
  }

  renderPetTabButton(tab, label) {
    const active = this.petModalTab === tab ? "active" : "";
    const selected = this.petModalTab === tab ? "true" : "false";
    return `
      <button class="pet-tab ${active}" type="button" role="tab" aria-selected="${selected}" data-pet-tab="${this.escapeHTML(
      tab
    )}">
        ${this.escapeHTML(label)}
      </button>
    `;
  }

  renderPetTabContent() {
    if (!this.petSystem) {
      return `<div class="modal-empty">宠物系统未初始化</div>`;
    }

    if (this.petModalTab === "bag") {
      return this.renderPetBag();
    }

    if (this.petModalTab === "collection") {
      return this.renderPetCollection();
    }

    return this.renderPetFormation();
  }

  renderPetFormation() {
    const equippedPets = this.petSystem?.equippedPets || [];
    const powerBonus = this.petSystem?.getTotalPowerBonus?.() || {
      attack: 0,
      defense: 0,
    };

    const slots = Array.from({ length: 3 }, (_, index) => {
      const pet = equippedPets[index];
      if (!pet) {
        return `
          <div class="pet-slot empty">
            <div class="pet-slot-empty">+</div>
            <div class="pet-level">空槽位</div>
          </div>
        `;
      }

      const template = this.getPetTemplateForInstance(pet);
      return `
        <div class="pet-slot">
          <div class="pet-icon">${this.getPetImageMarkup(template)}</div>
          <div class="pet-level">${this.escapeHTML(template?.name || "宠物")} Lv.${this.escapeHTML(
        pet.level || 1
      )}</div>
          <button class="pet-action-btn pet-slot-action" type="button" data-pet-action="unequip" data-instance-id="${this.escapeHTML(
            pet.instanceId
          )}">卸下</button>
        </div>
      `;
    }).join("");

    return `
      <div class="pet-formation">
        <section class="formation-section">
          <h3>当前编队</h3>
          <div class="formation-slots">${slots}</div>
        </section>
        <section class="team-stats">
          <h3>队伍属性</h3>
          <div class="stat-item">
            <span class="stat-label">上阵数量</span>
            <span class="stat-value">${equippedPets.length}/3</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">攻击加成</span>
            <span class="stat-value">+${this.formatGameNumber(powerBonus.attack)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">防御加成</span>
            <span class="stat-value">+${this.formatGameNumber(powerBonus.defense)}</span>
          </div>
        </section>
      </div>
    `;
  }

  renderPetBag() {
    const unlockedPets = this.petSystem?.unlockedPets || [];
    if (unlockedPets.length === 0) {
      return `<div class="modal-empty">还没有解锁宠物</div>`;
    }

    const cards = unlockedPets
      .map((pet) => this.renderOwnedPetCard(pet))
      .join("");

    return `<div class="pet-bag-list">${cards}</div>`;
  }

  renderOwnedPetCard(pet) {
    const template = this.getPetTemplateForInstance(pet);
    const rarity = this.petSystem?.getRarityConfig?.(template?.rarity) || {
      name: "普通",
      color: "#9e9e9e",
      stars: 1,
    };
    const level = pet.level || 1;
    const levelMultiplier = 1 + (level - 1) * 0.1;
    const attack = Math.floor((template?.baseStats?.attack || 0) * levelMultiplier);
    const defense = Math.floor(
      (template?.baseStats?.defense || 0) * levelMultiplier
    );
    const hp = Math.floor((template?.baseStats?.hp || 0) * levelMultiplier);
    const equippedCount = this.petSystem?.equippedPets?.length || 0;
    const canEquip = pet.equipped || equippedCount < 3;
    const action = pet.equipped ? "unequip" : "equip";
    const actionLabel = pet.equipped ? "卸下" : canEquip ? "上阵" : "编队已满";

    return `
      <article class="pet-card">
        <div class="pet-card-header">
          <div class="pet-card-icon">${this.getPetImageMarkup(template)}</div>
          <div class="pet-card-rarity" style="color: ${this.escapeHTML(
            rarity.color
          )}">${this.escapeHTML(rarity.name)} ${"★".repeat(rarity.stars)}</div>
        </div>
        <div class="pet-card-body">
          <h3 class="pet-card-name">${this.escapeHTML(template?.name || "未知宠物")}</h3>
          <div class="pet-card-level">Lv.${this.escapeHTML(level)}</div>
          ${pet.equipped ? `<div class="pet-equipped-badge">已上阵</div>` : ""}
          <div class="pet-card-stats">
            <span class="stat-mini">攻击 ${this.formatGameNumber(attack)}</span>
            <span class="stat-mini">生命 ${this.formatGameNumber(hp)}</span>
            <span class="stat-mini">防御 ${this.formatGameNumber(defense)}</span>
          </div>
          <div class="pet-card-status">
            ${this.renderPetStatusBar("经验", pet.exp || 0, 100)}
            ${this.renderPetStatusBar("羁绊", pet.friendship || 0, 100)}
          </div>
        </div>
        <div class="pet-card-actions">
          <button class="pet-action-btn" type="button" data-pet-action="${action}" data-instance-id="${this.escapeHTML(
      pet.instanceId
    )}" ${canEquip ? "" : "disabled"}>${this.escapeHTML(actionLabel)}</button>
        </div>
      </article>
    `;
  }

  renderPetStatusBar(label, value, max) {
    const safeValue = Math.max(0, Number(value) || 0);
    const safeMax = Math.max(1, Number(max) || 1);
    const percent = Math.min(100, Math.round((safeValue / safeMax) * 100));
    return `
      <div class="status-bar">
        <span class="status-label">${this.escapeHTML(label)}</span>
        <span class="status-progress">
          <span class="status-fill" style="width: ${percent}%"></span>
        </span>
        <span class="status-value">${this.formatGameNumber(safeValue)}/${this.formatGameNumber(safeMax)}</span>
      </div>
    `;
  }

  renderPetCollection() {
    const templates = this.petSystem?.petTemplates || [];
    const cards = templates
      .map((template) => {
        const owned = this.petSystem.unlockedPets.some(
          (pet) => pet.templateId === template.id
        );
        const rarity = this.petSystem.getRarityConfig(template.rarity);
        const unlockState = this.canUnlockPet(template);
        const disabled = owned || !unlockState.success;
        const buttonLabel = owned ? "已拥有" : unlockState.reason;

        return `
          <article class="pet-card pet-collection-card ${owned ? "is-owned" : "is-locked"}">
            <div class="pet-card-header">
              <div class="pet-card-icon">${this.getPetImageMarkup(template)}</div>
              <div class="pet-card-rarity" style="color: ${this.escapeHTML(
                rarity.color
              )}">${this.escapeHTML(rarity.name)} ${"★".repeat(rarity.stars)}</div>
            </div>
            <div class="pet-card-body">
              <h3 class="pet-card-name">${this.escapeHTML(template.name)}</h3>
              <p class="collection-card-desc">${this.escapeHTML(template.skill?.name || "基础协战")}</p>
              <div class="collection-card-info">
                <div class="info-row">
                  <span>解锁等级</span>
                  <strong>Lv.${this.escapeHTML(template.requiredLevel)}</strong>
                </div>
                <div class="info-row">
                  <span>费用</span>
                  <strong>${this.escapeHTML(this.formatPetCost(template.cost))}</strong>
                </div>
                <div class="info-row">
                  <span>基础攻击</span>
                  <strong>${this.formatGameNumber(template.baseStats.attack)}</strong>
                </div>
              </div>
            </div>
            <div class="pet-card-actions">
              <button class="pet-action-btn" type="button" data-pet-action="unlock" data-pet-id="${this.escapeHTML(
                template.id
              )}" ${disabled ? "disabled" : ""}>${this.escapeHTML(buttonLabel)}</button>
            </div>
          </article>
        `;
      })
      .join("");

    return `<div class="pet-collection-list">${cards}</div>`;
  }

  handlePetModalAction(button) {
    const action = button.dataset.petAction;
    let result = { success: false, message: "未知操作" };

    if (action === "unlock") {
      result = this.petSystem.unlockPet(Number(button.dataset.petId));
      if (result.success) {
        this.petModalTab = "bag";
      }
    } else if (action === "equip") {
      result = this.petSystem.equipPet(Number(button.dataset.instanceId));
    } else if (action === "unequip") {
      result = this.petSystem.unequipPet(Number(button.dataset.instanceId));
    }

    if (result.success) {
      this.uiSystem?.showToast(result.message, "success");
      this.updateUI();
      this.updateFateDisplay();
    } else {
      this.uiSystem?.showToast(result.message, "error");
    }

    this.renderPetModal();
  }

  openAchievementModal(activeTab = this.achievementModalTab) {
    this.closePetModal();
    this.achievementModalTab = activeTab || "achievements";
    this.renderAchievementModal();
    document
      .querySelector("#achievement-modal .achievement-close-btn")
      ?.focus({ preventScroll: true });
  }

  closeAchievementModal() {
    document.getElementById("achievement-modal")?.remove();
  }

  renderAchievementModal() {
    document.getElementById("achievement-modal")?.remove();

    const modal = document.createElement("div");
    modal.id = "achievement-modal";
    modal.className = "achievement-modal-overlay show";
    modal.innerHTML = `
      <div class="achievement-modal" role="dialog" aria-modal="true" aria-labelledby="achievement-modal-title">
        <div class="achievement-header">
          <h2 id="achievement-modal-title">成就</h2>
          <button class="achievement-close-btn" type="button" aria-label="关闭成就页面" data-achievement-close>×</button>
        </div>
        <div class="achievement-tabs" role="tablist" aria-label="成就页面">
          ${this.renderAchievementTabButton("achievements", "成就")}
          ${this.renderAchievementTabButton("tasks", "任务")}
        </div>
        <div class="achievement-content">
          ${this.renderAchievementContent()}
        </div>
      </div>
    `;

    modal.addEventListener("click", (event) => {
      const target =
        event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target) return;

      if (target === modal || target.closest("[data-achievement-close]")) {
        this.closeAchievementModal();
        return;
      }

      const tabButton = target.closest("[data-achievement-tab]");
      if (tabButton) {
        this.achievementModalTab =
          tabButton.dataset.achievementTab || "achievements";
        this.renderAchievementModal();
      }
    });

    document.body.appendChild(modal);
  }

  renderAchievementTabButton(tab, label) {
    const active = this.achievementModalTab === tab ? "active" : "";
    const selected = this.achievementModalTab === tab ? "true" : "false";
    return `
      <button class="achievement-tab ${active}" type="button" role="tab" aria-selected="${selected}" data-achievement-tab="${this.escapeHTML(
      tab
    )}">
        ${this.escapeHTML(label)}
      </button>
    `;
  }

  renderAchievementContent() {
    const items = this.getAchievementDefinitions().filter(
      (item) => item.group === this.achievementModalTab
    );

    if (items.length === 0) {
      return `<div class="modal-empty">暂无目标</div>`;
    }

    return items.map((item) => this.renderAchievementItem(item)).join("");
  }

  getAchievementDefinitions() {
    const fate = this.fateCoinSystem?.getDisplayData?.() || {};
    const totalFlips = fate.totalFlips || 0;
    const fateCoins = fate.fateCoins || 0;
    const goldCoins = fate.goldCoins || 0;
    const playerLevel = this.playerSystem?.player?.level || 1;
    const battlePower = this.playerSystem?.calculateTotalPower?.() || 0;
    const unlockedPets = this.petSystem?.unlockedPets?.length || 0;
    const equippedPets = this.petSystem?.equippedPets?.length || 0;
    const petLevelTotal = this.petSystem?.getEquippedPetLevelTotal?.() || 0;
    const buildings = this.territorySystem?.buildings?.length || 0;
    const coins = this.resourceSystem?.coins || 0;

    return [
      {
        id: "fate_10",
        group: "achievements",
        icon: "◎",
        title: "命运初动",
        desc: "累计翻面 10 次",
        current: totalFlips,
        target: 10,
        reward: "金币 80",
      },
      {
        id: "fate_100",
        group: "achievements",
        icon: "◎",
        title: "命运轮转",
        desc: "累计翻面 100 次",
        current: totalFlips,
        target: 100,
        reward: "金币 500",
      },
      {
        id: "gold_coin_1",
        group: "achievements",
        icon: "G",
        title: "金色筹码",
        desc: "拥有 1 枚金币硬币",
        current: goldCoins,
        target: 1,
        reward: "红宝石 20",
      },
      {
        id: "pet_first",
        group: "achievements",
        icon: "P",
        title: "第一位伙伴",
        desc: "解锁 1 只宠物",
        current: unlockedPets,
        target: 1,
        reward: "金币 120",
      },
      {
        id: "pet_team",
        group: "achievements",
        icon: "P",
        title: "完整小队",
        desc: "同时上阵 3 只宠物",
        current: equippedPets,
        target: 3,
        reward: "红宝石 50",
      },
      {
        id: "territory_first",
        group: "achievements",
        icon: "T",
        title: "落脚之地",
        desc: "建造 1 座领地建筑",
        current: buildings,
        target: 1,
        reward: "水晶 80",
      },
      {
        id: "hero_level_5",
        group: "achievements",
        icon: "Lv",
        title: "训练有素",
        desc: "角色等级达到 Lv.5",
        current: playerLevel,
        target: 5,
        reward: "金币 800",
      },
      {
        id: "task_flip_30",
        group: "tasks",
        icon: "◎",
        title: "翻面练习",
        desc: "累计翻面达到 30 次",
        current: totalFlips,
        target: 30,
        reward: "金币 150",
      },
      {
        id: "task_power_200",
        group: "tasks",
        icon: "ATK",
        title: "战力校准",
        desc: "战力达到 200",
        current: battlePower,
        target: 200,
        reward: "金币 300",
      },
      {
        id: "task_pet_level",
        group: "tasks",
        icon: "P",
        title: "伙伴训练",
        desc: "上阵宠物等级合计达到 3",
        current: petLevelTotal,
        target: 3,
        reward: "红宝石 15",
      },
      {
        id: "task_coins_1000",
        group: "tasks",
        icon: "C",
        title: "金币储备",
        desc: "当前金币达到 1000",
        current: coins,
        target: 1000,
        reward: "水晶 60",
      },
      {
        id: "task_fate_coins",
        group: "tasks",
        icon: "◎",
        title: "扩充硬币",
        desc: "命运硬币达到 3 枚",
        current: fateCoins,
        target: 3,
        reward: "金币 240",
      },
    ];
  }

  renderAchievementItem(item) {
    const current = Math.max(0, Number(item.current) || 0);
    const target = Math.max(1, Number(item.target) || 1);
    const percent = Math.min(100, Math.round((current / target) * 100));
    const complete = current >= target;

    return `
      <article class="achievement-item ${complete ? "completed" : ""}" data-achievement-id="${this.escapeHTML(
      item.id
    )}">
        <div class="achievement-icon">${this.escapeHTML(item.icon)}</div>
        <div class="achievement-info">
          <div class="achievement-title">${this.escapeHTML(item.title)}</div>
          <div class="achievement-desc">${this.escapeHTML(item.desc)}</div>
          <div class="achievement-progress" aria-label="${this.escapeHTML(
            item.title
          )}进度">
            <div class="achievement-progress-bar ${complete ? "complete" : ""}" style="width: ${percent}%"></div>
          </div>
          <div class="achievement-progress-text">${this.formatGameNumber(current)} / ${this.formatGameNumber(target)}</div>
        </div>
        <div class="achievement-reward">
          <span>${this.escapeHTML(item.reward)}</span>
          <span class="achievement-status ${complete ? "is-complete" : ""}">${
      complete ? "达成" : "进行中"
    }</span>
        </div>
      </article>
    `;
  }

  /**
   * 处理导航切换
   */
  handleNavigation(tab, silent = false) {
    if (tab === "pet") {
      this.openPetModal();
      return;
    }

    if (tab === "achievement") {
      this.openAchievementModal();
      return;
    }

    const availableTabs = ["fate", "dungeon", "territory"];
    const requestedTab = tab;
    if (!availableTabs.includes(tab)) {
      tab = "fate";
      if (!silent && this.uiSystem) {
        const tabNames = {
          pet: "宠物",
          achievement: "成就",
          character: "角色",
        };
        this.uiSystem.showToast(
          `${tabNames[requestedTab] || "该页面"}暂未开放`,
          "info"
        );
      }
    }

    // 更新按钮状态
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    // 切换场景
    this.currentScene = tab;

    const fateScene = document.getElementById("fate-scene");
    const battleScene = document.getElementById("battle-scene");
    const territoryScene = document.getElementById("territory-scene");
    const upgradePanel = document.getElementById("upgrade-panel");

    if (tab === "fate") {
      if (fateScene) fateScene.style.display = "flex";
      if (battleScene) battleScene.style.display = "none";
      if (territoryScene) territoryScene.style.display = "none";
      if (upgradePanel) upgradePanel.style.display = "none";
      if (this.combatSystem) this.combatSystem.isPaused = true;

      this.updateFateDisplay();
    } else if (tab === "territory") {
      // 显示领地场景
      if (fateScene) fateScene.style.display = "none";
      if (battleScene) battleScene.style.display = "none";
      if (territoryScene) territoryScene.style.display = "flex";
      if (upgradePanel) upgradePanel.style.display = "none";

      if (this.combatSystem) this.combatSystem.isPaused = true;

      // 更新领地显示
      this.updateTerritoryDisplay();
    } else if (tab === "dungeon") {
      // 显示战斗场景
      if (fateScene) fateScene.style.display = "none";
      if (battleScene) battleScene.style.display = "flex";
      if (territoryScene) territoryScene.style.display = "none";
      if (upgradePanel) upgradePanel.style.display = "flex";

      if (this.combatSystem) this.combatSystem.isPaused = false;
      if (this.gameCore?.resizeCanvas) {
        requestAnimationFrame(() => this.gameCore.resizeCanvas());
      }
      if (this.gameCore && !this.gameCore.isRunning) {
        this.gameCore.start();
      }
    }

    console.log("[Game] 切换到:", tab);
  }

  /**
   * 快速保存
   */
  async quickSave() {
    const result = await this.saveSystem.saveGame(1);
    if (result) {
      this.updateSettingsPanelStatus();
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
      this.updateSettingsPanelStatus();
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
    this.updatePlayerUpgradeControls();

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

    // 更新命运桌
    this.updateFateDisplay();
  }

  getTerritoryProgressContext() {
    const fate = this.fateCoinSystem?.getDisplayData?.() || {};
    const player = this.playerSystem?.player || {};
    const equippedPets = this.petSystem?.equippedPets?.length || 0;
    const petLevelTotal =
      typeof this.petSystem?.getEquippedPetLevelTotal === "function"
        ? this.petSystem.getEquippedPetLevelTotal()
        : equippedPets;
    const heroTrainingLevel = Math.max(
      0,
      Math.floor(((player.attack || 20) - 20) / 5)
    );

    return {
      totalFlips: fate.totalFlips || 0,
      fateCoins: fate.fateCoins || 1,
      assistants: fate.assistants || 0,
      goldCoins: fate.goldCoins || 0,
      heroTrainingLevel,
      playerLevel: player.level || 1,
      equippedPets,
      petLevelTotal,
      buildings: this.territorySystem?.buildings?.length || 0,
      expansionCount: this.territorySystem?.expansionCount || 0,
    };
  }

  syncTerritoryProgress({ silent = false } = {}) {
    if (!this.territorySystem) return null;

    const summary = this.territorySystem.setProgressContext(
      this.getTerritoryProgressContext()
    );
    const unlockedTypes = summary.unlockedBuildingTypes || [];

    if (silent || this.seenTerritoryUnlocks.size === 0) {
      this.seenTerritoryUnlocks = new Set(unlockedTypes);
      return summary;
    }

    const newlyUnlocked = unlockedTypes.filter(
      (type) => !this.seenTerritoryUnlocks.has(type)
    );
    this.seenTerritoryUnlocks = new Set(unlockedTypes);

    if (newlyUnlocked.length > 0 && this.uiSystem) {
      const names = newlyUnlocked
        .map((type) => this.territorySystem.buildingData[type]?.name)
        .filter(Boolean)
        .join("、");
      if (names) {
        this.uiSystem.showToast(`领地建筑开放: ${names}`, "success");
      }
    }

    return summary;
  }

  /**
   * 初始化领地 UI
   */
  initTerritoryUI() {
    // 生成领地网格
    this.renderTerritoryGrid();

    // 绑定扩张按钮
    const expandBtn = document.getElementById("expand-territory-btn");
    if (expandBtn) {
      expandBtn.addEventListener("click", () => this.handleExpand());
    }
  }

  /**
   * 渲染领地网格
   */
  renderTerritoryGrid() {
    const grid = document.getElementById("territory-grid");
    if (!grid || !this.territorySystem) return;

    grid.innerHTML = "";

    const maxSlots = this.territorySystem.slotConfig.maxSlots;

    for (let i = 0; i < maxSlots; i++) {
      const slot = document.createElement("div");
      slot.className = "territory-slot";
      slot.dataset.slot = i;

      const state = this.territorySystem.getSlotState(i);
      const building = this.territorySystem.getBuildingAt(i);

      if (state === "locked") {
        slot.classList.add("locked");
        const unlockPulse = this.territorySystem.getSlotUnlockPulse(i);
        slot.innerHTML = `
          <div class="slot-content">
            <div class="slot-locked">
              <div class="lock-icon">LOCK</div>
              <div class="slot-name">循环 ${unlockPulse}</div>
            </div>
          </div>
        `;
      } else if (state === "empty") {
        slot.innerHTML = `
          <div class="slot-content">
            <div class="slot-empty">+</div>
            <div class="slot-name">Build</div>
          </div>
        `;
        slot.addEventListener("click", () => this.openBuildModal(i));
      } else if (state === "built" && building) {
        slot.classList.add("built");
        const data = this.territorySystem.buildingData[building.type];
        slot.innerHTML = `
          <div class="slot-content">
            <div class="slot-icon">${data.icon}</div>
            <div class="slot-name">${data.name}</div>
            <div class="slot-level">Lv.${building.level}</div>
          </div>
        `;
        slot.addEventListener("click", () => this.openBuildingInfoModal(i));
      }

      grid.appendChild(slot);
    }
  }

  /**
   * 更新领地显示
   */
  updateTerritoryDisplay() {
    if (!this.territorySystem || !this.resourceSystem) return;
    const summary = this.syncTerritoryProgress() || this.territorySystem.getProgressSummary();

    // 先收集建筑产出，再刷新面板数字，避免领地资源显示慢一帧。
    const collected = this.territorySystem.collectResources();
    if (collected.coins > 0 || collected.crystals > 0) {
      this.resourceSystem.updateDisplay();
    }

    // 更新资源显示
    const goldEl = document.getElementById("territory-gold");
    const crystalEl = document.getElementById("territory-crystal");

    if (goldEl)
      goldEl.textContent = this.resourceSystem.formatNumber(
        this.resourceSystem.coins
      );
    if (crystalEl)
      crystalEl.textContent = this.resourceSystem.formatNumber(
        this.resourceSystem.crystals
      );

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    const loopFill = document.getElementById("territory-loop-fill");
    if (loopFill) {
      loopFill.style.width = `${Math.round((summary.progress || 0) * 100)}%`;
    }
    setText("territory-loop-stage", `${summary.stage}`);
    setText(
      "territory-loop-detail",
      summary.nextTargetPulse > summary.pulse
        ? `脉冲 ${summary.pulse} / ${summary.nextTargetPulse}`
        : `脉冲 ${summary.pulse}`
    );

    const nextBuilding = summary.nextBuilding;
    setText(
      "territory-next-building",
      nextBuilding ? nextBuilding.data.name : "全部开放"
    );
    setText(
      "territory-next-requirement",
      nextBuilding
        ? `需要循环脉冲 ${nextBuilding.state.requiredPulse}`
        : "建筑库已完整开放"
    );
    setText(
      "territory-production-rate",
      this.formatTerritoryProductionRate()
    );
    this.renderTerritoryUnlockList(summary);

    // 更新扩张进度
    const progressEl = document.getElementById("expansion-progress");
    if (progressEl) {
      progressEl.textContent = `${summary.unlockedSlots}/${summary.maxSlots}`;
    }
    const slotCountEl = document.getElementById("territory-slot-count");
    if (slotCountEl) {
      slotCountEl.textContent = `${summary.unlockedSlots}/${summary.maxSlots}`;
    }

    // 重新渲染网格
    this.renderTerritoryGrid();
  }

  formatTerritoryProductionRate() {
    if (!this.territorySystem || !this.resourceSystem) return "0";

    let coinsPerMinute = 0;
    let crystalsPerMinute = 0;
    this.territorySystem.buildings.forEach((building) => {
      const data = this.territorySystem.buildingData[building.type];
      if (!data || data.effects?.type !== "production" || data.productionInterval <= 0) {
        return;
      }

      const amountPerMinute =
        (data.effects.value * building.level * 60000) / data.productionInterval;
      if (data.effects.resource === "coins") {
        coinsPerMinute += amountPerMinute;
      } else if (data.effects.resource === "crystals") {
        crystalsPerMinute += amountPerMinute;
      }
    });

    const parts = [];
    if (coinsPerMinute > 0) {
      parts.push(`💰${this.resourceSystem.formatNumber(coinsPerMinute)}`);
    }
    if (crystalsPerMinute > 0) {
      parts.push(`💎${this.resourceSystem.formatNumber(crystalsPerMinute)}`);
    }

    return parts.join(" / ") || "0";
  }

  renderTerritoryUnlockList(summary) {
    const list = document.getElementById("territory-unlock-list");
    if (!list || !this.territorySystem) return;

    const unlocked = new Set(summary.unlockedBuildingTypes || []);
    list.innerHTML = this.territorySystem
      .getBuildingEntries()
      .map(([type, data]) => {
        const state = this.territorySystem.getBuildingUnlockState(type);
        const isUnlocked = unlocked.has(type);
        return `
          <div class="territory-unlock-chip ${isUnlocked ? "is-open" : "is-locked"}">
            <span class="unlock-chip-icon">${data.icon}</span>
            <span class="unlock-chip-name">${this.escapeHTML(data.name)}</span>
            <span class="unlock-chip-state">${
              isUnlocked
                ? "开放"
                : this.escapeHTML(String(state.requiredPulse))
            }</span>
          </div>
        `;
      })
      .join("");
  }

  /**
   * 打开建造弹窗
   */
  openBuildModal(slotIndex) {
    this.selectedSlot = slotIndex;

    // 创建弹窗
    let modal = document.getElementById("build-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "build-modal";
      modal.className = "territory-modal";
      modal.innerHTML = `
        <div class="territory-modal-content">
          <div class="territory-modal-header">
            <h3>选择建筑</h3>
            <button class="territory-modal-close" id="close-build-modal">✕</button>
          </div>
          <div class="territory-modal-body" id="building-options"></div>
        </div>
      `;
      document.getElementById("territory-scene")?.appendChild(modal);

      document
        .getElementById("close-build-modal")
        ?.addEventListener("click", () => {
          modal.classList.remove("show");
        });

      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("show");
      });
    }

    // 生成建筑选项
    const optionsEl = document.getElementById("building-options");
    optionsEl.innerHTML = "";

    for (const [type, data] of this.territorySystem.getBuildingEntries()) {
      const unlockState = this.territorySystem.getBuildingUnlockState(type);
      const canBuild = this.territorySystem.canBuild(type, slotIndex);
      const cost = this.territorySystem.calculateBuildCost(type);

      const option = document.createElement("button");
      option.className = `building-option ${
        unlockState.unlocked ? "is-open" : "is-locked"
      }`;
      option.disabled = !canBuild.success;
      option.innerHTML = `
        <div class="building-option-icon">${data.icon}</div>
        <div class="building-option-info">
          <div class="building-option-name">${data.name}</div>
          <div class="building-option-desc">${data.description}</div>
          <div class="building-option-unlock">
            阶段 ${unlockState.stage} · ${
              unlockState.unlocked
                ? this.escapeHTML(canBuild.success ? "可建造" : canBuild.reason)
                : this.escapeHTML(unlockState.reason)
            }
          </div>
        </div>
        <div class="building-option-cost">
          ${
            cost.coins > 0
              ? `💰${this.resourceSystem.formatNumber(cost.coins)}`
              : ""
          }
          ${
            cost.crystals > 0
              ? ` 💎${this.resourceSystem.formatNumber(cost.crystals)}`
              : ""
          }
          ${!unlockState.unlocked ? `<span class="building-lock-cost">脉冲 ${unlockState.requiredPulse}</span>` : ""}
        </div>
      `;

      option.addEventListener("click", () => this.handleBuild(type));
      optionsEl.appendChild(option);
    }

    modal.classList.add("show");
  }

  /**
   * 处理建造
   */
  handleBuild(buildingType) {
    const result = this.territorySystem.buildBuilding(
      buildingType,
      this.selectedSlot
    );

    if (result.success) {
      this.uiSystem.showToast(
        `✅ 建造成功: ${this.territorySystem.buildingData[buildingType].name}`,
        "success"
      );
      this.updateTerritoryDisplay();
      this.resourceSystem.updateDisplay();
      document.getElementById("build-modal")?.classList.remove("show");
    } else {
      this.uiSystem.showToast(`❌ ${result.reason}`, "error");
    }
  }

  /**
   * 打开建筑信息弹窗
   */
  openBuildingInfoModal(slotIndex) {
    const building = this.territorySystem.getBuildingAt(slotIndex);
    if (!building) return;

    const data = this.territorySystem.buildingData[building.type];
    const canUpgrade = this.territorySystem.canUpgrade(slotIndex);
    const upgradeCost = this.territorySystem.calculateUpgradeCost(
      building.type,
      building.level
    );

    // 创建弹窗
    let modal = document.getElementById("building-info-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "building-info-modal";
      modal.className = "territory-modal";
      document.getElementById("territory-scene")?.appendChild(modal);
    }

    // 计算效果描述
    let effectText = "";
    if (data.effects) {
      switch (data.effects.type) {
        case "attackBonus":
          effectText = `攻击力 +${data.effects.value * building.level}`;
          break;
        case "defenseBonus":
          effectText = `防御力 +${data.effects.value * building.level}`;
          break;
        case "combatBonus":
          effectText = `攻击 +${data.effects.attack * building.level}, 防御 +${
            data.effects.defense * building.level
          }`;
          break;
        case "production":
          const amount = data.effects.value * building.level;
          effectText = `每${data.productionInterval / 1000}秒产出 ${amount} ${
            data.effects.resource === "coins" ? "💰" : "💎"
          }`;
          break;
        case "expBonus":
          effectText = `经验 +${data.effects.value * building.level}%`;
          break;
        case "slotUnlock":
          effectText = `扩张节奏 +${data.effects.value * building.level}`;
          break;
      }
    }

    modal.innerHTML = `
      <div class="territory-modal-content">
        <div class="territory-modal-header">
          <h3>${data.icon} ${data.name}</h3>
          <button class="territory-modal-close" id="close-info-modal">✕</button>
        </div>
        <div class="territory-modal-body">
          <div class="building-stats">
            <div class="building-stat">
              <span class="building-stat-label">当前等级</span>
              <span class="building-stat-value">Lv.${building.level} / ${
      data.maxLevel
    }</span>
            </div>
            <div class="building-stat">
              <span class="building-stat-label">当前效果</span>
              <span class="building-stat-value">${effectText || "无"}</span>
            </div>
            ${
              building.level < data.maxLevel
                ? `
              <div class="building-stat">
                <span class="building-stat-label">升级费用</span>
                <span class="building-stat-value">💰${this.resourceSystem.formatNumber(
                  upgradeCost.coins
                )} 💎${this.resourceSystem.formatNumber(
                    upgradeCost.crystals
                  )}</span>
              </div>
            `
                : ""
            }
          </div>
          <div class="building-actions">
            <button class="btn-upgrade" ${
              !canUpgrade.success ? "disabled" : ""
            } id="btn-upgrade-building">
              ${building.level >= data.maxLevel ? "已满级" : "升级"}
            </button>
            ${
              building.type !== "main_base"
                ? `<button class="btn-demolish" id="btn-demolish-building">拆除</button>`
                : ""
            }
          </div>
        </div>
      </div>
    `;

    document
      .getElementById("close-info-modal")
      ?.addEventListener("click", () => {
        modal.classList.remove("show");
      });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("show");
    });

    document
      .getElementById("btn-upgrade-building")
      ?.addEventListener("click", () => {
        this.handleUpgradeBuilding(slotIndex);
      });

    document
      .getElementById("btn-demolish-building")
      ?.addEventListener("click", () => {
        this.handleDemolish(slotIndex);
      });

    modal.classList.add("show");
  }

  /**
   * 处理建筑升级
   */
  handleUpgradeBuilding(slotIndex) {
    const result = this.territorySystem.upgradeBuilding(slotIndex);

    if (result.success) {
      const data = this.territorySystem.buildingData[result.building.type];
      this.uiSystem.showToast(
        `✅ ${data.name} 升级至 Lv.${result.building.level}`,
        "success"
      );
      this.updateTerritoryDisplay();
      this.resourceSystem.updateDisplay();
      document.getElementById("building-info-modal")?.classList.remove("show");
    } else {
      this.uiSystem.showToast(`❌ ${result.reason}`, "error");
    }
  }

  /**
   * 处理拆除
   */
  handleDemolish(slotIndex) {
    if (!confirm("确定要拆除这个建筑吗？将返还50%的建造成本。")) return;

    const result = this.territorySystem.demolishBuilding(slotIndex);

    if (result.success) {
      this.uiSystem.showToast(
        `✅ 拆除成功，返还 💰${result.refund.coins} 💎${result.refund.crystals}`,
        "success"
      );
      this.updateTerritoryDisplay();
      this.resourceSystem.updateDisplay();
      document.getElementById("building-info-modal")?.classList.remove("show");
    } else {
      this.uiSystem.showToast(`❌ ${result.reason}`, "error");
    }
  }

  /**
   * 处理领地扩张
   */
  handleExpand() {
    const canExpand = this.territorySystem.canExpand();

    if (!canExpand.success) {
      this.uiSystem.showToast(`❌ ${canExpand.reason}`, "error");
      return;
    }

    const cost = this.territorySystem.getNextExpansionCost();
    if (!confirm(`确定扩张领地吗？\n费用: 💰${cost.coins} 💎${cost.crystals}`))
      return;

    const result = this.territorySystem.expandTerritory();

    if (result.success) {
      this.uiSystem.showToast(
        `✅ 领地扩张成功！当前地块: ${result.unlockedSlots}`,
        "success"
      );
      this.updateTerritoryDisplay();
      this.resourceSystem.updateDisplay();
    }
  }
}

// 启动游戏
function startPetPlanGame() {
  window.game = new Game();
  window.game.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startPetPlanGame);
} else {
  startPetPlanGame();
}
