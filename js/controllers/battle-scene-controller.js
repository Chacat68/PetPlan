/**
 * Owns the extraction-RPG scene controls, display refreshes, and settlement feedback.
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
    this.abandonArmedUntil = 0;
    this.abortController = null;
  }

  bind() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    const { signal } = this.abortController;
    const actions = [
      ["battle-start-expedition-btn", () => this.combatSystem.startRun()],
      ["battle-rest-btn", () => this.combatSystem.restAtCamp()],
      ["battle-leave-camp-btn", () => this.combatSystem.leaveCamp()],
      ["battle-use-supply-btn", () => this.combatSystem.useSupply()],
      ["battle-extract-btn", () => this.combatSystem.requestExtraction()],
      ["battle-restart-btn", () => this.combatSystem.startRun()],
      ["battle-abandon-btn", () => this.handleAbandon()],
    ];

    actions.forEach(([id, handler]) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.addEventListener("click", () => {
        const result = handler();
        this.handleBattleActionResult(result);
      }, { signal });
    });

    document.getElementById("battle-search-actions")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-search-mode]");
      if (!button) return;
      this.handleBattleActionResult(this.combatSystem.searchArea(button.dataset.searchMode));
    }, { signal });

    document.getElementById("battle-route-list")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-route-id]");
      if (!button) return;
      this.handleBattleActionResult(this.combatSystem.chooseRoute(button.dataset.routeId));
    }, { signal });

    document.getElementById("battle-skill-dock")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pet-skill]");
      if (!button) return;
      this.handleBattleActionResult(this.combatSystem.usePetSkill(button.dataset.petSkill));
    }, { signal });

    this.canvas.addEventListener("click", (event) => {
      if (this.getCurrentScene() !== "dungeon") return;
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
      const result = this.combatSystem.selectTargetAt(x, y);
      this.handleBattleActionResult(result, { quietFailure: true });
    }, { signal });
  }

  destroy() {
    this.abortController?.abort();
    this.abortController = null;
  }

  handleAbandon() {
    const now = Date.now();
    if (now > this.abandonArmedUntil) {
      this.abandonArmedUntil = now + 3200;
      return {
        success: false,
        message: "再次点击“放弃本局”确认；背包战利品将全部遗失",
      };
    }
    this.abandonArmedUntil = 0;
    return this.combatSystem.abandonRun();
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
    const setHidden = (id, hidden) => {
      const element = document.getElementById(id);
      if (element) element.hidden = Boolean(hidden);
    };
    const formatNumber = (value) => (
      this.resourceSystem?.formatNumber?.(value) || String(value)
    );

    setText("battle-phase-badge", state.phaseLabel);
    setText("battle-depth-display", `${state.depth}/${state.maxDepth}`);
    setText("battle-hp-display", `${state.hp}/${state.maxHp}`);
    setText("battle-threat-display", `${state.threat}%`);
    setText("battle-bag-display", `${state.backpackCount}/${state.backpackCapacity}`);
    setText("battle-enemy-display", state.activeEnemies + state.queuedEnemies);
    setText("battle-rooms-display", `${state.depth} / ${state.maxDepth}`);
    setText("battle-extractions-display", state.meta.extractions);
    setText("battle-kills-display", state.rewards.kills);
    setText("battle-reward-coins", formatNumber(state.pendingValue));
    setText("battle-supplies-display", `补给 ${state.supplies}`);
    setText("battle-event-feed", state.lastAction);

    const status = document.querySelector(".extraction-run-status");
    if (status) status.dataset.threat = state.threat >= 70 ? "high" : state.threat >= 40 ? "medium" : "low";

    this.renderCurrentRoom(state);
    this.renderRouteChoices(state.routeChoices);
    this.renderLoot(state.backpack);
    this.renderPetSkills(state.petSkills, state.isWaveActive);

    setHidden("battle-route-panel", !state.actions.canChooseRoute);
    setHidden("battle-search-actions", !state.actions.canSearch);
    setHidden("battle-camp-actions", !state.actions.canRest);
    setHidden("battle-use-supply-btn", !state.actions.canHeal);
    setHidden("battle-extract-btn", !state.actions.canExtract);
    setHidden("battle-abandon-btn", !state.actions.canAbandon);
    setHidden("battle-restart-btn", !(state.phase === "extracted" || state.phase === "defeat"));
    setHidden("battle-start-expedition-btn", state.phase !== "briefing");

    const startButton = document.getElementById("battle-start-expedition-btn");
    if (startButton) startButton.disabled = !state.actions.canStart;
    const healButton = document.getElementById("battle-use-supply-btn");
    if (healButton) healButton.disabled = !state.actions.canHeal;
    const extractButton = document.getElementById("battle-extract-btn");
    if (extractButton) extractButton.disabled = !state.actions.canExtract;
    setText(
      "battle-extract-label",
      state.threat >= 70 ? "高危守点" : state.depth >= state.maxDepth ? "最终撤离" : "带走战利品"
    );

    setText("battle-command-tip", this.getTip(state));
    this.handleSettlement(state);
  }

  renderCurrentRoom(state) {
    const node = state.currentNode;
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    };

    if (node) {
      setText("battle-room-kicker", node.icon ? `${node.icon} 当前区域` : "当前区域");
      setText("battle-room-name", node.name);
      setText("battle-room-risk", node.danger || state.phaseLabel);
      setText("battle-room-desc", node.description || state.lastAction);
      return;
    }

    const summaries = {
      briefing: ["行动简报", "未知禁区", "撤离后才会结算全部收益", "选择路线，搜索物资，击败阻拦者，并判断何时收手。"],
      route: ["路线规划", "下一处区域", state.extraction.unlocked ? "撤离点已解锁" : "继续深入以定位撤离点", "不同区域的风险与收益不同；当前阶段不会遭到攻击。"],
      "extraction-ready": ["最终目标", "撤离信标", "可以启动撤离", "启动后需要守住倒计时。高威胁会带来更多追兵。"],
      extracted: ["远征结算", "撤离成功", "战利品已入库", "本局携带的金币、水晶和经验已经发放。"],
      defeat: ["远征结算", "撤离失败", "背包战利品已遗失", "保留少量战斗收益，整备后可以再次尝试。"],
    };
    const summary = summaries[state.phase] || ["行动状态", state.phaseLabel, "远征进行中", state.lastAction];
    setText("battle-room-kicker", summary[0]);
    setText("battle-room-name", summary[1]);
    setText("battle-room-risk", summary[2]);
    setText("battle-room-desc", summary[3]);
  }

  renderRouteChoices(choices = []) {
    const list = document.getElementById("battle-route-list");
    if (!list) return;
    const buttons = choices.map((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `expedition-route-choice route-${node.type}`;
      button.dataset.routeId = node.id;

      const icon = document.createElement("span");
      icon.className = "route-choice-icon";
      icon.textContent = node.icon || "◇";
      const copy = document.createElement("span");
      copy.className = "route-choice-copy";
      const name = document.createElement("strong");
      name.textContent = node.name;
      const danger = document.createElement("small");
      danger.textContent = node.danger;
      copy.append(name, danger);
      button.append(icon, copy);
      return button;
    });
    list.replaceChildren(...buttons);
  }

  renderLoot(backpack = []) {
    const list = document.getElementById("battle-loot-list");
    if (!list) return;
    if (backpack.length === 0) {
      const empty = document.createElement("span");
      empty.className = "expedition-empty-loot";
      empty.textContent = "暂无战利品";
      list.replaceChildren(empty);
      return;
    }

    const items = backpack.slice(-4).reverse().map((loot) => {
      const item = document.createElement("div");
      item.className = `expedition-loot-item rarity-${loot.rarity}`;
      const name = document.createElement("span");
      name.textContent = `${loot.icon} ${loot.name}`;
      const value = document.createElement("b");
      value.textContent = loot.crystals > 0 ? `${loot.crystals}◆` : `${loot.coins}¤`;
      item.append(name, value);
      return item;
    });
    list.replaceChildren(...items);
  }

  renderPetSkills(skills = [], combatActive = false) {
    const dock = document.getElementById("battle-skill-dock");
    if (!dock) return;
    dock.hidden = skills.length === 0;
    const buttons = skills.map((skill) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "expedition-skill-btn";
      button.dataset.petSkill = skill.instanceId;
      button.style.setProperty("--skill-color", skill.color);
      button.disabled = !skill.ready;
      button.title = `${skill.name}：${skill.skillName}`;

      const icon = document.createElement("span");
      icon.className = "skill-pet-icon";
      icon.textContent = skill.emoji;
      const label = document.createElement("span");
      label.className = "skill-name";
      label.textContent = skill.skillName;
      const cooldown = document.createElement("span");
      cooldown.className = "skill-cooldown";
      cooldown.textContent = combatActive
        ? skill.ready ? "READY" : `${skill.cooldownSeconds}s`
        : "待战";
      button.append(icon, label, cooldown);
      return button;
    });
    dock.replaceChildren(...buttons);
  }

  getTip(state) {
    if (state.settlement) {
      return state.settlement.extracted
        ? `撤离成功：获得 ${state.settlement.coins} 金币、${state.settlement.crystals} 水晶、${state.settlement.exp} 经验。`
        : `本局结束：保留 ${state.settlement.coins} 金币和 ${state.settlement.exp} 经验，遗失 ${state.settlement.lootLost} 件战利品。`;
    }
    const tips = {
      briefing: "每局从满生命和 2 份补给开始。撤离前，背包内收益都可能遗失。",
      route: state.extraction.canExtract
        ? "撤离点已解锁：可以继续深入博取高价值战利品，也可以现在收手。"
        : `再清理 ${Math.max(0, 3 - state.depth)} 个区域即可定位撤离点。`,
      search: "快速搜索风险最低；仔细搜刮收益更高；宠物侦察需要上阵宠物。",
      camp: "安全屋会恢复 34% 生命、降低威胁并补充 1 份补给。",
      combat: "主角与宠物会自动攻击。点击敌人可锁定目标，底部按钮释放宠物技能。",
      extracting: `守住信标 ${state.extraction.remainingSeconds} 秒。倒计时结束即成功撤离。`,
      "extraction-ready": "最终区域已经清理，启动信标完成本局撤离。",
    };
    return tips[state.phase] || state.lastAction;
  }

  handleSettlement(state) {
    const settlement = state.settlement;
    if (!settlement) return;
    const settlementKey = `${settlement.runId}-${settlement.extracted}-${settlement.depth}-${settlement.kills}-${settlement.coins}`;
    if (this.lastSettlementKey === settlementKey) return;
    this.lastSettlementKey = settlementKey;

    const levelDisplay = document.querySelector(".player-level");
    if (levelDisplay) levelDisplay.textContent = `Lv.${this.playerSystem.player.level}`;
    void this.saveSystem?.saveGame?.(1);
    this.uiSystem?.showToast(
      settlement.extracted ? "撤离成功，背包奖励已入库" : "远征结束，已结算保底收益",
      settlement.extracted ? "success" : "info"
    );
  }
}
