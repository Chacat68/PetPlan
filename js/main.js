/**
 * PetPlan - game composition root.
 *
 * Gameplay state lives in systems; DOM behavior lives in controllers. Game only
 * assembles the shared instances, connects cross-system callbacks, and
 * coordinates primary-scene navigation.
 */

import { getGameCoreInstance } from "./modules/game-core.js?v=world-exploration-20260712b";
import { getResourceSystemInstance } from "./modules/resource-system.js";
import { getPlayerSystemInstance } from "./modules/player-system.js?v=expedition-simplification-20260723b";
import { getCombatSystemInstance } from "./modules/combat-system.js?v=expedition-simplification-20260723b";
import { getSaveSystemInstance } from "./modules/save-system.js?v=review-fixes-20260722a";
import { getUISystemInstance } from "./modules/ui-system.js";
import { getPetSystemInstance } from "./modules/pet-system.js?v=expedition-simplification-20260723b";
import { getTerritorySystemInstance } from "./modules/territory-system.js?v=territory-expedition-entry-20260723a";
import { getFateCoinSystemInstance } from "./modules/fate-coin-system.js?v=fate-stability-20260711b";
import { ModalFocusManager } from "./modules/modal-focus-manager.js?v=controllers-phase-two-20260711b";
import { getProgressionSystemInstance } from "./modules/progression-system.js?v=growth-onboarding-20260720a";
import { getAchievementSystemInstance } from "./modules/achievement-system.js?v=achievement-ui-v3-20260714a";
import { ExpeditionMetaSystem } from "./modules/expedition-meta-system.js?v=expedition-simplification-20260723b";
import { SceneRouter } from "./modules/scene-router.js?v=controllers-phase-two-20260711b";

import { AchievementController } from "./controllers/achievement-controller.js?v=achievement-ui-v3-20260714a";
import { BattleSceneController } from "./controllers/battle-scene-controller.js?v=battle-context-ui-20260723b";
import { FateSceneController } from "./controllers/fate-scene-controller.js?v=fate-toast-top-right-20260715a";
import { PetModalController } from "./controllers/pet-modal-controller.js?v=pet-command-ui-v1-20260714a";
import { OrientationController } from "./controllers/orientation-controller.js?v=experience-ux-20260722a";
import { PlayerModalController } from "./controllers/player-modal-controller.js?v=command-modals-v1-20260714a";
import { SettingsController } from "./controllers/settings-controller.js?v=command-modals-v1-20260714a";
import { ShopRecommendationController } from "./controllers/shop-recommendation-controller.js?v=territory-expedition-entry-20260723a";
import { TerritorySceneController } from "./controllers/territory-scene-controller.js?v=expedition-simplification-20260723b";

export class Game {
  constructor() {
    console.log("[Game] 初始化游戏...");

    this.isInitialized = false;
    this.currentScene = "fate";
    this.navigationAbortController = null;
    this.expeditionExitOpen = false;
    this.modalFocusManager = new ModalFocusManager();
    this.orientationController = new OrientationController();
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
      this.expeditionMetaSystem = new ExpeditionMetaSystem({
        creditSettlementCurrency: false,
      });
      this.combatSystem.setPlayerSystem(this.playerSystem);
      this.combatSystem.setResourceSystem(this.resourceSystem);
      this.combatSystem.isPaused = true;
      this.playerSystem.setCombatSystem?.(this.combatSystem);
      this.petSystem.setCombatSystem(this.combatSystem);
      this.combatSystem.setPetSystem(this.petSystem);
      this.combatSystem.setExpeditionMetaSystem?.(this.expeditionMetaSystem);

      this.territorySystem = getTerritorySystemInstance(
        this.resourceSystem,
        this.playerSystem
      );
      this.combatSystem.setTerritorySystem?.(this.territorySystem);
      this.modalFocusManager.setOnChange?.(() => this.syncCombatPause());

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
        expeditionMeta: this.expeditionMetaSystem,
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
      const claimedMetaRewards = this.claimExpeditionMetaBalances();
      if (!loadedSave && this.territorySystem.loadFromLocalStorage()) {
        await this.saveSystem.saveGame(1);
      } else if (loadedSave && claimedMetaRewards) {
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
      expeditionMetaSystem: this.expeditionMetaSystem,
      resourceSystem: this.resourceSystem,
      playerSystem: this.playerSystem,
      saveSystem: this.saveSystem,
      uiSystem: this.uiSystem,
      modalFocusManager: this.modalFocusManager,
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
      combatSystem: this.combatSystem,
      saveSystem: this.saveSystem,
      uiSystem: this.uiSystem,
      modalFocusManager: this.modalFocusManager,
      getCurrentScene: () => this.currentScene,
      onBeforeGameLoad: () => {
        this.fateSceneController.resetTransientRuntime();
        this.shopRecommendationController.resetRecommendationStability();
      },
      onGameLoaded: () => {
        const claimed = this.claimExpeditionMetaBalances();
        this.updateUI({ announceAchievements: false });
        if (claimed) void this.saveSystem.saveGame(1);
      },
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
        if (this.orientationController?.active) return;
        if (this.currentScene === "dungeon") {
          event.preventDefault();
          event.stopPropagation();
          if (event.repeat) return;
          if (this.battleSceneController?.backpackForced) {
            const status = document.getElementById("battle-action-status");
            if (status) status.textContent = "请先处理背包中待取舍的战利品";
            return;
          }
          if (this.expeditionExitOpen) this.closeExpeditionExitConfirm();
          else this.openExpeditionExitConfirm();
          return;
        }
        this.petModalController.close();
        this.achievementController.close();
        this.settingsController.close();
        this.playerModalController.close();
      },
      { signal, capture: true }
    );

    const exitOverlay = document.getElementById("expedition-exit-overlay");
    document.getElementById("expedition-exit-cancel")?.addEventListener(
      "click",
      () => this.closeExpeditionExitConfirm(),
      { signal }
    );
    document.getElementById("expedition-exit-confirm")?.addEventListener(
      "click",
      () => this.confirmExpeditionExit(),
      { signal }
    );
    exitOverlay?.addEventListener(
      "click",
      (event) => {
        if (event.target === exitOverlay) this.closeExpeditionExitConfirm();
      },
      { signal }
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden && this.combatSystem?.runSystem?.active) {
          void this.saveSystem?.saveGame?.(1);
        }
      },
      { signal }
    );

    this.playerModalController.bindEvents();
    this.settingsController.bindEvents();
    this.orientationController.bind();
    this.shopRecommendationController.bind();
    this.fateSceneController.bind();
    this.battleSceneController.bind();
    this.territorySceneController.bind();
    this.sceneRouter.bindHistory((scene) => {
      this.handleNavigation(scene, true);
    });
  }

  destroy() {
    this.closeExpeditionExitConfirm();
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
      this.orientationController,
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
    this.syncSceneChrome();
    this.fateSceneController.setSceneActive(this.currentScene === "fate");
    this.battleSceneController?.setSceneActive(this.currentScene === "dungeon");
    this.territorySceneController?.setSceneActive(this.currentScene === "territory");
    const battleFlowLayer = document.getElementById("battle-flow-layer");

    if (this.currentScene === "fate") {
      this.closeExpeditionExitConfirm();
      if (battleFlowLayer) battleFlowLayer.style.display = "none";
      if (this.combatSystem) this.combatSystem.isPaused = true;
      this.fateSceneController.updateDisplay({ commitRecommendation: true });
    } else if (this.currentScene === "territory") {
      this.closeExpeditionExitConfirm();
      if (battleFlowLayer) battleFlowLayer.style.display = "none";
      if (this.combatSystem) this.combatSystem.isPaused = true;
      this.territorySceneController.updateDisplay();
    } else if (this.currentScene === "dungeon") {
      this.petModalController?.close();
      this.achievementController?.close();
      this.settingsController?.close();
      this.playerModalController?.close();
      if (battleFlowLayer) battleFlowLayer.style.display = "block";
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

    this.syncCombatPause();

    console.log("[Game] 切换到:", this.currentScene);
  }

  syncSceneChrome() {
    const immersive = this.currentScene === "dungeon";
    document.body.dataset.scene = this.currentScene;
    const hud = document.querySelector(".game-hud-controls");
    if (!hud) return;
    hud.hidden = immersive;
    hud.toggleAttribute("inert", immersive);
    hud.setAttribute("aria-hidden", immersive ? "true" : "false");
  }

  openExpeditionExitConfirm() {
    if (this.currentScene !== "dungeon" || this.expeditionExitOpen) return false;
    const overlay = document.getElementById("expedition-exit-overlay");
    const dialog = document.getElementById("expedition-exit-dialog");
    const message = document.getElementById("expedition-exit-message");
    if (!overlay || !dialog) return false;

    const runActive = Boolean(this.combatSystem?.runSystem?.active);
    const runPhase = this.combatSystem?.runSystem?.phase || "briefing";
    const dangerousExit = runPhase === "combat" || runPhase === "extracting";
    const atRiskLoadout = this.battleSceneController?.getAtRiskLoadoutItems?.(
      this.expeditionMetaSystem?.getState?.(),
    ) || [];
    const loadoutRiskSuffix = atRiskLoadout.length
      ? `另会遗失未保险配装：${atRiskLoadout.map((item) => item.name || "未命名装备").join("、")}。`
      : "";
    if (message) {
      message.textContent = runActive
        ? dangerousExit
          ? `当前正处于战斗或撤离守点。确认退出会按战败结算：未保护战利品将丢失，仅保留安全袋、10% 金币与 20% 经验，不获得水晶。${loadoutRiskSuffix}`
          : `确认退出会按安全止损结算本局：未保护战利品将丢失，仅保留安全袋、30% 金币与 40% 经验，不获得水晶。${loadoutRiskSuffix}`
        : "当前尚未开始行动，确认后将结束整备并返回领地。";
    }
    overlay.dataset.runActive = runActive ? "true" : "false";
    overlay.dataset.exitRisk = dangerousExit ? "defeated" : runActive ? "abandoned" : "briefing";
    overlay.hidden = false;
    this.expeditionExitOpen = true;
    this.battleSceneController?.clearControlInput?.();
    this.modalFocusManager?.activate?.(dialog, "#expedition-exit-cancel");
    return true;
  }

  closeExpeditionExitConfirm() {
    const overlay = document.getElementById("expedition-exit-overlay");
    const dialog = document.getElementById("expedition-exit-dialog");
    if (!this.expeditionExitOpen && overlay?.hidden !== false) return false;
    if (overlay) overlay.hidden = true;
    this.expeditionExitOpen = false;
    this.modalFocusManager?.release?.(dialog);
    return true;
  }

  confirmExpeditionExit() {
    if (this.currentScene !== "dungeon") {
      this.closeExpeditionExitConfirm();
      return false;
    }

    const runActive = Boolean(this.combatSystem?.runSystem?.active);
    const result = runActive ? this.combatSystem.abandonRun() : null;
    this.closeExpeditionExitConfirm();
    this.handleNavigation("territory");
    this.updateUI();
    void this.saveSystem?.saveGame?.(1);
    if (runActive && result?.message) this.uiSystem?.showToast(result.message, "info");
    return true;
  }

  claimExpeditionMetaBalances() {
    const balances = this.expeditionMetaSystem?.claimBalances?.() || {};
    const total = [balances.coins, balances.crystals, balances.rubies, balances.exp]
      .reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    if (total <= 0) return false;
    this.resourceSystem?.addCoins?.(balances.coins || 0);
    this.resourceSystem?.addCrystals?.(balances.crystals || 0);
    this.resourceSystem?.addRubies?.(balances.rubies || 0);
    this.playerSystem?.addExperience?.(balances.exp || 0);
    return true;
  }

  syncCombatPause() {
    if (!this.combatSystem) return;
    this.combatSystem.isPaused = Boolean(
      this.currentScene !== "dungeon" || this.modalFocusManager?.activeModal
    );
    if (this.combatSystem.isPaused) this.battleSceneController?.clearControlInput?.();
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
      bestExtractedDepth: this.combatSystem?.meta?.bestExtractedDepth || 0,
      expeditionDepth: Math.max(
        this.combatSystem?.meta?.bestDepth || 0,
        this.combatSystem?.getBattleState?.().depth || 0
      ),
      extractions: this.combatSystem?.meta?.extractions || 0,
      losses: this.combatSystem?.meta?.losses || 0,
      bossKills: this.combatSystem?.meta?.bossKills || 0,
      flawlessExtractions: this.combatSystem?.meta?.flawlessExtractions || 0,
      bestValue: this.combatSystem?.meta?.bestValue || 0,
      maxExpeditionPetCount: this.combatSystem?.meta?.maxExpeditionPetCount || 0,
      contractFragments: this.combatSystem?.meta?.contractFragments || 0,
      deepMaterials: this.combatSystem?.meta?.deepMaterials || 0,
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
      bestExtractedDepth: progression.bestExtractedDepth,
      extractions: progression.extractions,
      bossKills: progression.bossKills,
      flawlessExtractions: progression.flawlessExtractions,
      bestValue: progression.bestValue,
      maxExpeditionPetCount: progression.maxExpeditionPetCount,
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
