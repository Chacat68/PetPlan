/**
 * PetPlan - game composition root.
 *
 * Gameplay state lives in systems; DOM behavior lives in controllers. Game only
 * assembles the shared instances, connects cross-system callbacks, and
 * coordinates primary-scene navigation.
 */

import { getGameCoreInstance } from "./modules/game-core.js?v=world-exploration-20260712b";
import { getResourceSystemInstance } from "./modules/resource-system.js";
import { getPlayerSystemInstance } from "./modules/player-system.js?v=world-exploration-20260712b";
import { getCombatSystemInstance } from "./modules/combat-system.js?v=pet-loop-calibration-20260713a";
import { getSaveSystemInstance } from "./modules/save-system.js?v=achievement-v2-20260714a";
import { getUISystemInstance } from "./modules/ui-system.js";
import { getPetSystemInstance } from "./modules/pet-system.js?v=pet-loop-calibration-20260713a";
import { getTerritorySystemInstance } from "./modules/territory-system.js?v=pet-loop-calibration-20260713a";
import { getFateCoinSystemInstance } from "./modules/fate-coin-system.js?v=fate-stability-20260711b";
import { ModalFocusManager } from "./modules/modal-focus-manager.js?v=controllers-phase-two-20260711b";
import { getProgressionSystemInstance } from "./modules/progression-system.js?v=phase-one-20260710b";
import { getAchievementSystemInstance } from "./modules/achievement-system.js?v=achievement-ui-v3-20260714a";
import { SceneRouter } from "./modules/scene-router.js?v=controllers-phase-two-20260711b";

import { AchievementController } from "./controllers/achievement-controller.js?v=achievement-ui-v3-20260714a";
import { BattleSceneController } from "./controllers/battle-scene-controller.js?v=pet-loop-calibration-20260713a";
import { FateSceneController } from "./controllers/fate-scene-controller.js?v=controllers-phase-two-20260711b";
import { PetModalController } from "./controllers/pet-modal-controller.js?v=pet-loop-calibration-20260713a";
import { PlayerModalController } from "./controllers/player-modal-controller.js?v=controllers-phase-two-20260711b";
import { SettingsController } from "./controllers/settings-controller.js?v=fate-stability-20260711b";
import { ShopRecommendationController } from "./controllers/shop-recommendation-controller.js?v=pet-loop-calibration-20260713a";
import { TerritorySceneController } from "./controllers/territory-scene-controller.js?v=pet-loop-calibration-20260713a";

export class Game {
  constructor() {
    console.log("[Game] 初始化游戏...");

    this.isInitialized = false;
    this.currentScene = "fate";
    this.navigationAbortController = null;
    this.modalFocusManager = new ModalFocusManager();
    this.sceneRouter = new SceneRouter();

    this.canvas = document.getElementById("gameCanvas");
    if (!this.canvas) {
      console.error("[Game] ❌ 无法找到游戏画布");
      return;
    }
    this.ctx = this.canvas.getContext("2d");
  }

  async init() {
    if (!this.canvas || this.isInitialized) return;
    console.log("[Game] 初始化系统...");

    try {
      this.modalFocusManager.bind();
      this.resourceSystem = getResourceSystemInstance();
      this.progressionSystem = getProgressionSystemInstance();
      this.achievementSystem = getAchievementSystemInstance(this.resourceSystem);
      this.fateCoinSystem = getFateCoinSystemInstance();

      this.playerSystem = getPlayerSystemInstance();
      this.playerSystem.setResourceSystem(this.resourceSystem);

      this.petSystem = getPetSystemInstance();
      this.petSystem.setResourceSystem(this.resourceSystem);
      this.petSystem.setPlayerSystem(this.playerSystem);
      if (this.petSystem.unlockedPets.length === 0) {
        this.petSystem.unlockPet(1);
        if (this.petSystem.unlockedPets.length > 0) {
          this.petSystem.equipPet(this.petSystem.unlockedPets[0].instanceId);
        }
      }

      this.combatSystem = getCombatSystemInstance();
      this.combatSystem.setPlayerSystem(this.playerSystem);
      this.combatSystem.setResourceSystem(this.resourceSystem);
      this.combatSystem.isPaused = true;
      this.playerSystem.setCombatSystem?.(this.combatSystem);
      this.petSystem.setCombatSystem(this.combatSystem);
      this.combatSystem.setPetSystem(this.petSystem);

      this.territorySystem = getTerritorySystemInstance(
        this.resourceSystem,
        this.playerSystem
      );
      this.combatSystem.setTerritorySystem?.(this.territorySystem);

      this.saveSystem = getSaveSystemInstance();
      this.saveSystem.setGameSystems({
        player: this.playerSystem,
        resource: this.resourceSystem,
        combat: this.combatSystem,
        pet: this.petSystem,
        territory: this.territorySystem,
        fate: this.fateCoinSystem,
        progression: this.progressionSystem,
        achievement: this.achievementSystem,
      });

      this.uiSystem = getUISystemInstance();
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

      this.createControllers();
      this.connectSystemCallbacks();
      this.bindEvents();

      this.fateSceneController.resetTransientRuntime();
      this.shopRecommendationController.resetRecommendationStability();
      const loadedSave = await this.saveSystem.loadGame(1);
      if (!loadedSave && this.territorySystem.loadFromLocalStorage()) {
        await this.saveSystem.saveGame(1);
      }
      this.territorySceneController.syncProgress({ silent: true });

      this.updateUI({ announceAchievements: false });
      this.handleNavigation(
        this.sceneRouter.getRequestedScene("fate", { normalize: true }),
        true
      );

      this.gameCore.start();
      this.isInitialized = true;
      console.log("[Game] ✅ 游戏初始化完成");
    } catch (error) {
      console.error("[Game] ❌ 初始化失败:", error);
    }
  }

  createControllers() {
    const escapeHTML = (value) => this.escapeHTML(value);
    const formatNumber = (value) => this.formatGameNumber(value);
    const getProgressionContext = (fateData) =>
      this.getProgressionContext(fateData);

    this.territorySceneController = new TerritorySceneController({
      canvas: document.getElementById("territoryCanvas"),
      territorySystem: this.territorySystem,
      resourceSystem: this.resourceSystem,
      playerSystem: this.playerSystem,
      petSystem: this.petSystem,
      combatSystem: this.combatSystem,
      saveSystem: this.saveSystem,
      uiSystem: this.uiSystem,
      formatNumber,
      getProgressionContext,
      getCurrentScene: () => this.currentScene,
      onNavigate: (scene) => this.handleNavigation(scene),
      onChanged: () => this.updateUI(),
    });

    this.shopRecommendationController = new ShopRecommendationController({
      fateCoinSystem: this.fateCoinSystem,
      playerSystem: this.playerSystem,
      petSystem: this.petSystem,
      progressionSystem: this.progressionSystem,
      formatNumber,
      getProgressionContext,
      onNavigate: (scene) => this.handleNavigation(scene),
    });

    this.fateSceneController = new FateSceneController({
      fateCoinSystem: this.fateCoinSystem,
      playerSystem: this.playerSystem,
      petSystem: this.petSystem,
      resourceSystem: this.resourceSystem,
      uiSystem: this.uiSystem,
      shopController: this.shopRecommendationController,
      territoryController: this.territorySceneController,
      getCurrentScene: () => this.currentScene,
      getProgressionContext,
      onChanged: () => this.updateUI(),
    });

    this.battleSceneController = new BattleSceneController({
      canvas: this.canvas,
      combatSystem: this.combatSystem,
      resourceSystem: this.resourceSystem,
      playerSystem: this.playerSystem,
      saveSystem: this.saveSystem,
      uiSystem: this.uiSystem,
      getCurrentScene: () => this.currentScene,
    });

    this.playerModalController = new PlayerModalController({
      playerSystem: this.playerSystem,
      resourceSystem: this.resourceSystem,
      uiSystem: this.uiSystem,
      modalFocusManager: this.modalFocusManager,
      onChanged: () => this.updateUI(),
    });

    this.settingsController = new SettingsController({
      canvas: this.canvas,
      getGameCore: () => this.gameCore,
      saveSystem: this.saveSystem,
      uiSystem: this.uiSystem,
      modalFocusManager: this.modalFocusManager,
      getCurrentScene: () => this.currentScene,
      onBeforeGameLoad: () => {
        this.fateSceneController.resetTransientRuntime();
        this.shopRecommendationController.resetRecommendationStability();
      },
      onGameLoaded: () => this.updateUI({ announceAchievements: false }),
    });

    this.petModalController = new PetModalController({
      petSystem: this.petSystem,
      territorySystem: this.territorySystem,
      playerSystem: this.playerSystem,
      resourceSystem: this.resourceSystem,
      uiSystem: this.uiSystem,
      modalFocusManager: this.modalFocusManager,
      escapeHTML,
      formatNumber,
      onBeforeOpen: () => this.achievementController?.close(),
      onChanged: () => this.updateUI(),
    });

    this.achievementController = new AchievementController({
      achievementSystem: this.achievementSystem,
      saveSystem: this.saveSystem,
      uiSystem: this.uiSystem,
      modalFocusManager: this.modalFocusManager,
      getContext: () => this.getAchievementContext(),
      escapeHTML,
      formatNumber,
      onBeforeOpen: () => this.petModalController?.close(),
      onRewardClaimed: () => {
        this.fateSceneController.updateDisplay();
        this.territorySceneController.updateDisplay();
      },
    });
  }

  connectSystemCallbacks() {
    this.achievementSystem.setOnChange((event) =>
      this.achievementController.handleSystemChange(event)
    );
    this.fateCoinSystem.setOnChange(() => {
      this.fateSceneController.updateDisplay();
      this.refreshAchievements();
    });
    this.fateCoinSystem.setOnAutoFlip((request) =>
      this.fateSceneController.handleAutoFlip(request)
    );
    this.combatSystem.setOnStateChange((state) => {
      this.battleSceneController.updateBattleDisplay(state);
      this.refreshAchievements();
    });
    this.territorySystem.setOnPersist(() => {
      this.refreshAchievements();
      void this.saveSystem.saveGame(1);
    });
  }

  bindEvents() {
    this.navigationAbortController?.abort();
    this.navigationAbortController = new AbortController();
    const { signal } = this.navigationAbortController;

    document.querySelectorAll(".nav-btn").forEach((button) => {
      button.addEventListener(
        "click",
        (event) => this.handleNavigation(event.currentTarget.dataset.tab),
        { signal }
      );
    });
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape") return;
        this.petModalController.close();
        this.achievementController.close();
        this.settingsController.close();
        this.playerModalController.close();
      },
      { signal }
    );

    this.playerModalController.bindEvents();
    this.settingsController.bindEvents();
    this.shopRecommendationController.bind();
    this.fateSceneController.bind();
    this.battleSceneController.bind();
    this.territorySceneController.bind();
    this.sceneRouter.bindHistory((scene) => {
      this.handleNavigation(scene, true);
    });
  }

  destroy() {
    this.petModalController?.close();
    this.achievementController?.close();
    this.settingsController?.close();
    this.playerModalController?.close();

    this.navigationAbortController?.abort();
    this.navigationAbortController = null;
    this.sceneRouter?.destroy();

    [
      this.fateSceneController,
      this.battleSceneController,
      this.territorySceneController,
      this.shopRecommendationController,
      this.settingsController,
      this.playerModalController,
    ].forEach((controller) => controller?.destroy?.());

    this.fateCoinSystem?.setOnChange(null);
    this.fateCoinSystem?.setOnAutoFlip(null);
    this.combatSystem?.setOnStateChange(null);
    this.territorySystem?.setOnPersist(null);
    this.achievementSystem?.setOnChange(null);
    this.gameCore?.stop();
    this.modalFocusManager?.destroy();
    this.isInitialized = false;
  }

  handleNavigation(tab, silent = false) {
    if (tab === "pet") {
      this.petModalController.open();
      return;
    }
    if (tab === "achievement") {
      this.achievementController.open();
      return;
    }

    const requestedTab = tab;
    if (!this.sceneRouter.isPrimaryScene(tab)) {
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

    this.currentScene = this.sceneRouter.activate(tab, {
      syncHistory: !silent,
    });
    this.fateSceneController.setSceneActive(this.currentScene === "fate");
    this.battleSceneController?.setSceneActive(this.currentScene === "dungeon");
    this.territorySceneController?.setSceneActive(this.currentScene === "territory");
    const upgradePanel = document.getElementById("upgrade-panel");

    if (this.currentScene === "fate") {
      if (upgradePanel) upgradePanel.style.display = "none";
      if (this.combatSystem) this.combatSystem.isPaused = true;
      this.fateSceneController.updateDisplay({ commitRecommendation: true });
    } else if (this.currentScene === "territory") {
      if (upgradePanel) upgradePanel.style.display = "none";
      if (this.combatSystem) this.combatSystem.isPaused = true;
      this.territorySceneController.updateDisplay();
    } else if (this.currentScene === "dungeon") {
      if (upgradePanel) upgradePanel.style.display = "flex";
      if (this.combatSystem) {
        this.combatSystem.prepareBattle();
        this.combatSystem.isPaused = false;
        this.battleSceneController.updateBattleDisplay();
      }
      if (this.gameCore?.resizeCanvas) {
        this.gameCore.resizeCanvas();
        this.combatSystem?.placeHeroAtBase?.();
        this.battleSceneController.updateBattleDisplay();
        requestAnimationFrame(() => {
          this.gameCore.resizeCanvas();
          this.combatSystem?.placeHeroAtBase?.();
          this.battleSceneController.updateBattleDisplay();
        });
      }
      if (this.gameCore && !this.gameCore.isRunning) {
        this.gameCore.start();
      }
    }

    console.log("[Game] 切换到:", this.currentScene);
  }

  updateUI({ announceAchievements = true } = {}) {
    this.resourceSystem.updateDisplay();
    this.playerSystem.updateDisplay();
    this.playerModalController.updateUpgradeControls();

    const power = this.playerSystem.calculateTotalPower();
    const powerDisplay = document.getElementById("power-display");
    if (powerDisplay) {
      powerDisplay.textContent = this.resourceSystem.formatNumber(power);
    }

    const levelDisplay = document.querySelector(".player-level");
    if (levelDisplay) {
      levelDisplay.textContent = `Lv.${this.playerSystem.player.level}`;
    }

    this.fateSceneController.updateDisplay();
    this.battleSceneController.updateBattleDisplay();
    this.refreshAchievements({ announce: announceAchievements });
  }

  refreshAchievements({ announce = true } = {}) {
    const result = this.achievementController?.refreshProgress({ announce });
    this.achievementController?.updateBadge(result?.summary);
    return result;
  }

  getProgressionContext(fateData = null) {
    const fate = fateData || this.fateCoinSystem?.getDisplayData?.() || {};
    const player = this.playerSystem?.player || {};
    const equippedPets = this.petSystem?.equippedPets?.length || 0;
    const petLevelTotal =
      typeof this.petSystem?.getEquippedPetLevelTotal === "function"
        ? this.petSystem.getEquippedPetLevelTotal()
        : equippedPets;
    const heroTrainingLevel = Math.max(
      0,
      Math.floor(this.playerSystem?.fateTrainingLevel || 0)
    );

    return {
      totalFlips: fate.totalFlips || 0,
      fateCoins: fate.fateCoins || 1,
      assistants: fate.assistants || 0,
      manualPower: fate.manualPower || 1,
      assistantPower: fate.assistantPower || 1,
      assistantSpeedLevel: Math.max(
        0,
        Math.round((3000 - (fate.autoInterval || 3000)) / 250)
      ),
      heroTrainingLevel,
      playerLevel: player.level || 1,
      equippedPets,
      petLevelTotal,
      petTrainingLevels: Math.max(0, petLevelTotal - equippedPets),
      buildings: this.territorySystem?.buildings?.length || 0,
      expansionCount: this.territorySystem?.expansionCount || 0,
      bestDepth: this.combatSystem?.meta?.bestDepth || 0,
      extractions: this.combatSystem?.meta?.extractions || 0,
      losses: this.combatSystem?.meta?.losses || 0,
    };
  }

  getAchievementContext() {
    const progression = this.getProgressionContext();
    const unlockedPets = this.petSystem?.unlockedPets || [];
    return {
      totalFlips: progression.totalFlips,
      fateCoins: progression.fateCoins,
      assistants: progression.assistants,
      playerLevel: progression.playerLevel,
      bestDepth: progression.bestDepth,
      extractions: progression.extractions,
      unlockedPets: unlockedPets.length,
      equippedPets: progression.equippedPets,
      maxPetFriendship: unlockedPets.reduce(
        (highest, pet) => Math.max(highest, Number(pet?.friendship) || 0),
        0
      ),
      territoryRank: this.territorySystem?.rank || 0,
      constructionScore:
        this.territorySystem?.getConstructionScore?.() || 0,
    };
  }

  escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  formatGameNumber(value) {
    if (this.resourceSystem?.formatNumber) {
      return this.resourceSystem.formatNumber(value);
    }
    return String(Math.floor(Number(value) || 0));
  }
}

function startPetPlanGame() {
  window.game = new Game();
  void window.game.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startPetPlanGame);
} else {
  startPetPlanGame();
}
