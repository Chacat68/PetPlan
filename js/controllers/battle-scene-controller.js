/**
 * Owns the battle scene controls, display refreshes, and settlement feedback.
 */
export class BattleSceneController {
  constructor({
    canvas,
    combatSystem,
    resourceSystem,
    playerSystem,
    saveSystem,
    uiSystem,
    getCurrentScene,
  }) {
    this.canvas = canvas;
    this.combatSystem = combatSystem;
    this.resourceSystem = resourceSystem;
    this.playerSystem = playerSystem;
    this.saveSystem = saveSystem;
    this.uiSystem = uiSystem;
    this.getCurrentScene = getCurrentScene;
    this.lastSettlementKey = null;
    this.abortController = null;
  }

  /**
   * Bind the vertical tower-defense wave, upgrade, repair, restart, and canvas events.
   */
  bind() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    const { signal } = this.abortController;
    const actions = [
      ["battle-start-wave-btn", () => this.combatSystem.startNextWave()],
      ["battle-upgrade-tower-btn", () => this.combatSystem.upgradeSelectedTower()],
      ["battle-repair-base-btn", () => this.combatSystem.repairBase()],
      ["battle-restart-btn", () => this.combatSystem.restartBattle()],
    ];

    actions.forEach(([id, handler]) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.addEventListener("click", () => {
        const result = handler();
        this.handleBattleActionResult(result);
      }, { signal });
    });

    this.canvas.addEventListener("click", (event) => {
      if (this.getCurrentScene() !== "dungeon") return;
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
      const result = this.combatSystem.selectTowerAt(x, y);
      this.handleBattleActionResult(result, { quietFailure: !result?.message });
    }, { signal });
  }

  destroy() {
    this.abortController?.abort();
    this.abortController = null;
  }

  handleBattleActionResult(result, options = {}) {
    if (!result) return;
    this.updateBattleDisplay();
    if (!result.message || (options.quietFailure && !result.success)) return;
    this.uiSystem?.showToast(
      result.message,
      result.success ? "success" : "info"
    );
  }

  updateBattleDisplay(providedState = null) {
    if (!this.combatSystem) return;
    const state = providedState || this.combatSystem.getBattleState();
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    };

    setText("battle-phase-badge", state.phaseLabel);
    setText("battle-wave-display", `${state.currentWave}/${state.totalWaves}`);
    setText("battle-base-hp-display", `${state.baseHp}/${state.baseMaxHp}`);
    setText("battle-energy-display", state.energy);
    setText("battle-enemy-display", state.activeEnemies + state.queuedEnemies);
    setText("battle-panel-wave", `${state.currentWave} / ${state.totalWaves}`);
    setText("battle-best-wave", state.meta.bestWave);
    setText("battle-kills-display", state.rewards.kills);
    setText(
      "battle-reward-coins",
      this.resourceSystem?.formatNumber?.(state.rewards.coins) || state.rewards.coins
    );

    const tower = state.selectedTower;
    setText("selected-tower-name", tower?.name || "暂无上阵宠物");
    setText("selected-tower-role", tower?.role || "请先在宠物编队中上阵宠物");
    setText("selected-tower-level", tower ? `${tower.level} / ${tower.maxLevel}` : "--");
    setText("selected-tower-damage", tower?.damage ?? "--");
    setText("selected-tower-range", tower?.range ?? "--");
    setText("selected-tower-speed", tower ? `${tower.attackSpeed}/秒` : "--");
    setText("battle-upgrade-cost", tower ? `${tower.upgradeCost}⚡` : "--");

    const towerCard = document.getElementById("selected-tower-card");
    if (towerCard) {
      towerCard.style.borderColor = tower?.color || "#565d6c";
    }

    const startButton = document.getElementById("battle-start-wave-btn");
    if (startButton) {
      startButton.disabled = !state.canStartWave;
      startButton.textContent = state.currentWave === 0
        ? "开始第一波"
        : state.canStartWave
          ? `开始第 ${state.currentWave + 1} 波`
          : state.phase === "victory"
            ? "本局已通关"
            : state.phase === "defeat"
              ? "基地已失守"
              : "防守进行中";
    }

    const upgradeButton = document.getElementById("battle-upgrade-tower-btn");
    if (upgradeButton) {
      upgradeButton.disabled = !tower || tower.level >= tower.maxLevel || state.energy < tower.upgradeCost;
    }

    const repairButton = document.getElementById("battle-repair-base-btn");
    if (repairButton) {
      repairButton.disabled = (
        state.baseHp >= state.baseMaxHp ||
        state.energy < 35 ||
        state.phase === "victory" ||
        state.phase === "defeat"
      );
    }

    const restartButton = document.getElementById("battle-restart-btn");
    if (restartButton) {
      restartButton.textContent = state.phase === "victory" || state.phase === "defeat"
        ? "重新挑战"
        : "重整防线";
    }

    const tips = {
      ready: "点击有宠物的塔位进行选择；先选塔，再点空塔位即可换位。",
      spawning: "敌军正在进入战场。宠物塔会优先攻击最接近基地的目标。",
      combat: "击杀敌人可获得战斗能量，用于升级宠物塔或修复基地。",
      intermission: "波次间可以移动宠物塔。调整阵型后再开始下一波。",
      victory: "十波已全部守住，金币、水晶和经验已经结算。",
      defeat: "失败也会获得部分金币和经验；重整防线即可重新开始。",
    };
    const settlement = state.settlement;
    const settlementText = settlement
      ? `${tips[state.phase]} 本次获得 ${settlement.coins} 金币、${settlement.crystals} 水晶、${settlement.exp} 经验。`
      : tips[state.phase];
    setText("battle-command-tip", settlementText || "守住基地！");

    if (settlement) {
      const settlementKey = `${settlement.runId}-${settlement.victory}-${settlement.wave}-${settlement.kills}-${settlement.coins}`;
      if (this.lastSettlementKey !== settlementKey) {
        this.lastSettlementKey = settlementKey;
        const levelDisplay = document.querySelector(".player-level");
        if (levelDisplay) levelDisplay.textContent = `Lv.${this.playerSystem.player.level}`;
        void this.saveSystem?.saveGame?.(1);
        this.uiSystem?.showToast(
          settlement.victory ? "防线胜利，奖励已结算" : "基地失守，已结算部分奖励",
          settlement.victory ? "success" : "info"
        );
      }
    }
  }
}
