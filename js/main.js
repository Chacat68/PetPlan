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
import {
  TerritorySystem,
  getTerritorySystemInstance,
} from "./modules/territory-system.js";

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
    this.currentScene = "dungeon";
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
        this.petSystem.unlockPet(1); // 火焰犬
        if (this.petSystem.unlockedPets.length > 0) {
          this.petSystem.equipPet(this.petSystem.unlockedPets[0].instanceId);
        }
      }

      // 4. 初始化战斗系统
      this.combatSystem = getCombatSystemInstance();
      this.combatSystem.setPlayerSystem(this.playerSystem);
      this.combatSystem.setResourceSystem(this.resourceSystem);

      // 5. 初始化领地系统
      this.territorySystem = getTerritorySystemInstance(
        this.resourceSystem,
        this.playerSystem
      );
      this.territorySystem.loadFromLocalStorage();

      // 6. 初始化存档系统
      this.saveSystem = getSaveSystemInstance();
      this.saveSystem.setGameSystems({
        player: this.playerSystem,
        resource: this.resourceSystem,
        combat: this.combatSystem,
        pet: this.petSystem,
        territory: this.territorySystem,
      });

      // 7. 初始化 UI 系统
      this.uiSystem = getUISystemInstance();

      // 8. 初始化游戏核心
      this.gameCore = getGameCoreInstance(this.canvas);
      this.gameCore.setSystems({
        player: this.playerSystem,
        combat: this.combatSystem,
        resource: this.resourceSystem,
        ui: this.uiSystem,
        save: this.saveSystem,
        pet: this.petSystem,
        territory: this.territorySystem,
      });

      // 初始化领地 UI
      this.initTerritoryUI();

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
          const radio = document.querySelector(
            `input[name="resolution"][value="${settings.resolution}"]`
          );
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
    const resolution =
      document.querySelector('input[name="resolution"]:checked')?.value ||
      "auto";

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

    // 分辨率对应的窗口尺寸（手机游戏常见竖屏分辨率）
    // 这里的 width 是游戏容器宽度，height 是游戏画布区域高度
    switch (resolution) {
      case "540":
        // HD: 540×960 (16:9)
        width = 540;
        height = 960;
        break;
      case "720":
        // HD+: 720×1280 (16:9)
        width = 720;
        height = 1280;
        break;
      case "1080":
        // FHD: 1080×1920 (16:9)
        width = 1080;
        height = 1920;
        break;
      case "1080x2340":
        // FHD+: 1080×2340 (19.5:9 刘海屏)
        width = 1080;
        height = 2340;
        break;
      case "1440":
        // QHD+: 1440×3200 (20:9)
        width = 1440;
        height = 3200;
        break;
      case "auto":
      default:
        // 自动模式：使用默认 CSS 变量值
        width = null;
        height = null;
        break;
    }

    // 更新 CSS 变量以改变游戏窗口实际尺寸
    const root = document.documentElement;
    if (width && height) {
      root.style.setProperty("--game-width", `${width}px`);
      root.style.setProperty("--canvas-height", `${height}px`);
    } else {
      // 自动模式：恢复默认值
      root.style.setProperty("--game-width", "750px");
      root.style.setProperty("--canvas-height", "1350px");
    }

    // 调用 GameCore 的分辨率设置方法（处理 Canvas 内部尺寸）
    if (this.gameCore.setResolution) {
      this.gameCore.setResolution(width, height);
    }

    console.log(
      `[Game] 分辨率设置: ${resolution} (${width || "auto"}×${
        height || "auto"
      })`
    );
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
    if (crystalsEl)
      crystalsEl.textContent = this.resourceSystem.formatNumber(crystals);
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

    // 切换场景
    this.currentScene = tab;

    const battleScene = document.getElementById("battle-scene");
    const territoryScene = document.getElementById("territory-scene");
    const upgradePanel = document.getElementById("upgrade-panel");
    const gameUIOverlay = document.querySelector(".game-ui-overlay");

    if (tab === "territory") {
      // 显示领地场景
      if (battleScene) battleScene.style.display = "none";
      if (territoryScene) territoryScene.style.display = "flex";
      if (upgradePanel) upgradePanel.style.display = "none";
      if (gameUIOverlay) gameUIOverlay.style.display = "none";

      // 暂停战斗场景
      if (this.gameCore) this.gameCore.stop();

      // 更新领地显示
      this.updateTerritoryDisplay();
    } else {
      // 显示战斗场景
      if (battleScene) battleScene.style.display = "block";
      if (territoryScene) territoryScene.style.display = "none";
      if (upgradePanel) upgradePanel.style.display = "block";
      if (gameUIOverlay) gameUIOverlay.style.display = "block";

      // 恢复战斗场景
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
        const unlockLevel = this.territorySystem.slots[i]?.unlockLevel || 0;
        slot.innerHTML = `
          <div class="slot-content">
            <div class="slot-locked">
              <div class="lock-icon">🔒</div>
              <div>Lv.${unlockLevel} 解锁</div>
            </div>
          </div>
        `;
      } else if (state === "empty") {
        slot.innerHTML = `
          <div class="slot-content">
            <div class="slot-empty">+</div>
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

    // 更新扩张进度
    const progressEl = document.getElementById("expansion-progress");
    if (progressEl) {
      progressEl.textContent = `${this.territorySystem.unlockedSlots}/${this.territorySystem.slotConfig.maxSlots}`;
    }

    // 收集资源
    const collected = this.territorySystem.collectResources();
    if (collected.coins > 0 || collected.crystals > 0) {
      this.resourceSystem.updateDisplay();
    }

    // 重新渲染网格
    this.renderTerritoryGrid();
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
            <h3>🏗️ 选择建筑</h3>
            <button class="territory-modal-close" id="close-build-modal">×</button>
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

    for (const [type, data] of Object.entries(
      this.territorySystem.buildingData
    )) {
      const canBuild = this.territorySystem.canBuild(type, slotIndex);
      const cost = this.territorySystem.calculateBuildCost(type);

      const option = document.createElement("button");
      option.className = "building-option";
      option.disabled = !canBuild.success;
      option.innerHTML = `
        <div class="building-option-icon">${data.icon}</div>
        <div class="building-option-info">
          <div class="building-option-name">${data.name}</div>
          <div class="building-option-desc">${data.description}</div>
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
      }
    }

    modal.innerHTML = `
      <div class="territory-modal-content">
        <div class="territory-modal-header">
          <h3>${data.icon} ${data.name}</h3>
          <button class="territory-modal-close" id="close-info-modal">×</button>
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
document.addEventListener("DOMContentLoaded", () => {
  window.game = new Game();
  window.game.init();
});
