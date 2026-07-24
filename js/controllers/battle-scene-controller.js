/**
 * Owns the extraction-RPG scene controls, display refreshes, and settlement feedback.
 */
export class BattleSceneController {
  constructor({
    canvas,
    combatSystem,
    expeditionMetaSystem = null,
    resourceSystem,
    playerSystem,
    saveSystem,
    uiSystem,
    modalFocusManager = null,
    getCurrentScene,
  }) {
    this.canvas = canvas;
    this.combatSystem = combatSystem;
    this.expeditionMetaSystem = expeditionMetaSystem;
    this.resourceSystem = resourceSystem;
    this.playerSystem = playerSystem;
    this.saveSystem = saveSystem;
    this.uiSystem = uiSystem;
    this.modalFocusManager = modalFocusManager;
    this.getCurrentScene = getCurrentScene;
    this.lastSettlementKey = null;
    this.pressedMovementKeys = new Set();
    this.firingPointerIds = new Set();
    this.lastWorldRevision = -1;
    this.lastActionPhase = null;
    this.backpackOpen = false;
    this.backpackForced = false;
    this.isSceneActive = false;
    this.lastMetaRenderSignature = null;
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
      ["battle-reload-btn", () => this.combatSystem.reloadWeapon?.()],
      ["battle-interact-btn", () => this.combatSystem.interactWithNearbyLocation()],
      ["battle-cancel-search-btn", () => this.combatSystem.cancelSearch?.("manual")],
      ["battle-restart-btn", () => this.combatSystem.resetBattle()],
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

    document.getElementById("battle-skill-dock")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pet-skill]");
      if (!button) return;
      this.handleBattleActionResult(this.combatSystem.usePetSkill(button.dataset.petSkill));
    }, { signal });

    document.getElementById("battle-loot-choice-panel")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-loot-action]");
      if (!button) return;
      const action = button.dataset.lootAction;
      const replaceItemId = button.dataset.lootItemId || null;
      const result = this.combatSystem.resolveLootChoice?.(action, replaceItemId)
        || this.combatSystem.runSystem?.resolveLootChoice?.(action, replaceItemId);
      this.handleBattleActionResult(result);
    }, { signal });

    document.getElementById("battle-loot-list")?.addEventListener("click", (event) => {
      const insureButton = event.target.closest("[data-loot-insure]");
      const markButton = event.target.closest("[data-loot-mark]");
      if (!insureButton && !markButton) return;
      let result = null;
      if (insureButton) {
        result = this.combatSystem.toggleLootInsurance?.(insureButton.dataset.lootInsure);
      } else {
        const itemId = markButton.dataset.lootMark;
        const loot = this.combatSystem.runSystem?.backpack?.find((entry) => entry.id === itemId);
        const wasLocked = Boolean(loot?.locked);
        result = this.combatSystem.runSystem?.setLootLocked?.(itemId, !wasLocked);
        if (result?.success) result.message = wasLocked ? "已取消物资锁定" : "已锁定物资，不会被替换";
      }
      this.handleBattleActionResult(result);
    }, { signal });

    document.getElementById("battle-weapon-slots")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-weapon-id]");
      if (!button) return;
      const result = this.combatSystem.switchWeapon?.(button.dataset.weaponId);
      this.handleBattleActionResult(result);
    }, { signal });

    document.getElementById("battle-stash-list")?.addEventListener("click", (event) => {
      const sellButton = event.target.closest("[data-stash-sell]");
      const equipButton = event.target.closest("[data-stash-equip]");
      const claimButton = event.target.closest("[data-stash-claim]");
      let result = null;
      if (sellButton) {
        result = this.expeditionMetaSystem?.sellItem?.(sellButton.dataset.stashSell);
      } else if (equipButton) {
        const metaState = this.expeditionMetaSystem?.getState?.() || {};
        const item = (metaState.warehouse || []).find(entry => entry.instanceId === equipButton.dataset.stashEquip);
        const expectedSlot = this.expeditionMetaSystem?.expectedEquipSlot?.(item);
        const consumables = metaState.loadout?.consumables || [];
        const emptyConsumableIndex = consumables.findIndex(entry => !entry);
        if (expectedSlot === "consumable" && emptyConsumableIndex < 0) {
          result = { success: false, message: "四个补给栏已满，请先卸下一件消耗品" };
        } else {
          result = this.expeditionMetaSystem?.equipItem?.(
            equipButton.dataset.stashEquip,
            { consumableIndex: expectedSlot === "consumable" ? emptyConsumableIndex : 0 }
          );
        }
      } else if (claimButton) {
        result = this.expeditionMetaSystem?.claimPendingDeliveries?.();
      }
      this.handleMetaActionResult(result);
    }, { signal });

    document.getElementById("battle-equipped-items")?.addEventListener("click", (event) => {
      const unequipButton = event.target.closest("[data-loadout-unequip]");
      const insureButton = event.target.closest("[data-loadout-insure]");
      const cancelInsuranceButton = event.target.closest("[data-loadout-uninsure]");
      if (unequipButton) {
        this.handleMetaActionResult(this.expeditionMetaSystem?.unequipItem?.(
          unequipButton.dataset.loadoutUnequip,
          { consumableIndex: Number(unequipButton.dataset.consumableIndex) || 0 }
        ));
      } else if (insureButton) {
        this.handleMetaActionResult(this.purchaseLoadoutInsurance(insureButton.dataset.loadoutInsure));
      } else if (cancelInsuranceButton) {
        this.handleMetaActionResult(
          this.expeditionMetaSystem?.cancelLoadoutInsurance?.(cancelInsuranceButton.dataset.loadoutUninsure)
        );
      }
    }, { signal });

    document.getElementById("battle-crafting-list")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-craft-recipe]");
      if (!button) return;
      this.handleMetaActionResult(
        this.expeditionMetaSystem?.craftRecipe?.(button.dataset.craftRecipe)
      );
    }, { signal });

    document.getElementById("battle-facility-list")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-facility-upgrade]");
      if (!button) return;
      this.handleMetaActionResult(
        this.expeditionMetaSystem?.upgradeFacility?.(button.dataset.facilityUpgrade)
          || this.expeditionMetaSystem?.upgradeCapacity?.(button.dataset.facilityUpgrade)
      );
    }, { signal });

    document.getElementById("battle-contract-list")?.addEventListener("click", (event) => {
      const acceptButton = event.target.closest("[data-contract-accept]");
      const turnInButton = event.target.closest("[data-contract-turn-in]");
      const abandonButton = event.target.closest("[data-contract-abandon]");
      let result = null;
      if (acceptButton) {
        const pet = this.combatSystem?.petSystem?.equippedPets?.[0] || null;
        const template = this.combatSystem?.petSystem?.getTemplate?.(pet?.templateId);
        result = this.expeditionMetaSystem?.acceptContract?.(
          acceptButton.dataset.contractAccept,
          pet ? {
            petId: pet.instanceId,
            petName: template?.name || "上阵宠物",
          } : {}
        );
      } else if (turnInButton) {
        result = this.expeditionMetaSystem?.turnInContract?.(
          turnInButton.dataset.contractTurnIn
        );
      } else if (abandonButton) {
        result = this.expeditionMetaSystem?.abandonContract?.(
          abandonButton.dataset.contractAbandon
        );
      }
      this.handleMetaActionResult(result);
    }, { signal });

    document.getElementById("battle-pack-toggle")?.addEventListener(
      "click",
      () => this.setBackpackOpen(!this.backpackOpen),
      { signal }
    );
    document.getElementById("battle-pack-close")?.addEventListener(
      "click",
      () => this.setBackpackOpen(false),
      { signal }
    );
    document.getElementById("battle-target-cycle-btn")?.addEventListener(
      "click",
      () => this.handleBattleActionResult(this.cycleNavigationTarget()),
      { signal }
    );

    this.bindWeaponControls(signal);

    this.bindMovementControls(signal);
  }

  bindWeaponControls(signal) {
    const updateAim = (event) => {
      if (this.getCurrentScene() !== "dungeon" || this.hasOpenModal()) return false;
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
      this.combatSystem.setAimScreenPosition?.(x, y);
      return true;
    };

    this.canvas.addEventListener("pointermove", (event) => {
      updateAim(event);
    }, { signal });
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !updateAim(event)) return;
      event.preventDefault();
      try { this.canvas.setPointerCapture(event.pointerId); } catch (_) {}
      this.firingPointerIds.add(event.pointerId);
      this.combatSystem.startFiring?.();
    }, { signal });

    const releaseCanvasFire = (event) => {
      this.firingPointerIds.delete(event.pointerId);
      if (this.firingPointerIds.size === 0) this.combatSystem.stopFiring?.();
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
      this.canvas.addEventListener(type, releaseCanvasFire, { signal });
    });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });

    const fireButton = document.getElementById("battle-fire-btn");
    if (fireButton) {
      const releaseButtonFire = (event) => {
        this.firingPointerIds.delete(event.pointerId);
        fireButton.setAttribute("aria-pressed", "false");
        if (this.firingPointerIds.size === 0) this.combatSystem.stopFiring?.();
      };
      fireButton.addEventListener("pointerdown", (event) => {
        if (this.getCurrentScene() !== "dungeon" || fireButton.disabled) return;
        event.preventDefault();
        try { fireButton.setPointerCapture(event.pointerId); } catch (_) {}
        this.firingPointerIds.add(event.pointerId);
        fireButton.setAttribute("aria-pressed", "true");
        this.combatSystem.startFiring?.();
      }, { signal });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
        fireButton.addEventListener(type, releaseButtonFire, { signal });
      });
    }
  }

  bindMovementControls(signal) {
    const movementCodes = new Set([
      "KeyW", "ArrowUp", "KeyS", "ArrowDown",
      "KeyA", "ArrowLeft", "KeyD", "ArrowRight",
    ]);

    window.addEventListener("keydown", (event) => {
      if (this.getCurrentScene() !== "dungeon") return;
      if (this.hasOpenModal()) {
        this.clearControlInput();
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) return;

      if (movementCodes.has(event.code)) {
        event.preventDefault();
        this.pressedMovementKeys.add(event.code);
        this.applyMovementInput();
        return;
      }
      if (event.code === "KeyE" && !event.repeat) {
        event.preventDefault();
        this.handleBattleActionResult(this.combatSystem.interactWithNearbyLocation());
        return;
      }
      if (event.code === "KeyQ" && !event.repeat) {
        event.preventDefault();
        this.handleBattleActionResult(this.useTeamSkill());
        return;
      }
      if (event.code === "KeyR" && !event.repeat) {
        event.preventDefault();
        this.handleBattleActionResult(this.combatSystem.reloadWeapon?.());
        return;
      }
      if (event.code === "Digit4" && !event.repeat) {
        event.preventDefault();
        this.handleBattleActionResult(this.combatSystem.useSupply?.());
        return;
      }
      if (event.code === "KeyB" && !event.repeat) {
        event.preventDefault();
        this.setBackpackOpen(!this.backpackOpen);
        return;
      }
      if (event.code === "KeyM" && !event.repeat) {
        event.preventDefault();
        this.handleBattleActionResult(this.cycleNavigationTarget());
      }
    }, { signal });

    window.addEventListener("keyup", (event) => {
      if (!movementCodes.has(event.code)) return;
      this.pressedMovementKeys.delete(event.code);
      this.applyMovementInput();
    }, { signal });

    window.addEventListener("blur", () => this.clearControlInput(), { signal });
    document.addEventListener("focusin", (event) => {
      if (event.target?.closest?.('[role="dialog"][aria-modal="true"]')) {
        this.clearControlInput();
      }
    }, { signal });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.clearControlInput();
    }, { signal });

  }

  applyMovementInput() {
    let x = 0;
    let y = 0;
    if (this.pressedMovementKeys.has("KeyA") || this.pressedMovementKeys.has("ArrowLeft")) x -= 1;
    if (this.pressedMovementKeys.has("KeyD") || this.pressedMovementKeys.has("ArrowRight")) x += 1;
    if (this.pressedMovementKeys.has("KeyW") || this.pressedMovementKeys.has("ArrowUp")) y -= 1;
    if (this.pressedMovementKeys.has("KeyS") || this.pressedMovementKeys.has("ArrowDown")) y += 1;
    this.combatSystem.setMovementInput(x, y);
  }

  hasOpenModal() {
    return Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'))
      .some((dialog) => dialog.getClientRects().length > 0);
  }

  clearMovementInput() {
    this.pressedMovementKeys.clear();
    this.combatSystem?.clearMovementInput?.();
  }

  clearWeaponInput() {
    this.firingPointerIds.clear();
    document.getElementById("battle-fire-btn")?.setAttribute("aria-pressed", "false");
    this.combatSystem?.stopFiring?.();
  }

  clearControlInput() {
    this.clearMovementInput();
    this.clearWeaponInput();
  }

  useTeamSkill() {
    const state = this.combatSystem?.getBattleState?.() || {};
    const skills = state.teamSkill
      ? [state.teamSkill]
      : Array.isArray(state.petSkills) ? state.petSkills : [];
    const skill = skills[0];
    if (!skill) return { success: false, message: "当前没有可用的队伍技" };
    return this.combatSystem.usePetSkill?.(skill.instanceId);
  }

  setSceneActive(active) {
    const nextActive = Boolean(active);
    this.isSceneActive = nextActive;
    if (!nextActive) {
      this.setBackpackOpen(false, {}, { forceClose: true });
      this.clearControlInput();
    }
  }

  destroy() {
    this.clearControlInput();
    this.abortController?.abort();
    this.abortController = null;
  }

  canOpenBackpack(state = {}) {
    return Boolean(
      state.actions?.canAbandon
      && !(state.activeSearch || state.searchState)
      && !state.pendingLootChoice
      && state.phase !== "extracting"
    );
  }

  setBackpackOpen(open, providedState = null, options = {}) {
    const state = providedState || this.combatSystem?.getBattleState?.() || {};
    const forcedChoice = Boolean(state.actions?.canAbandon && state.pendingLootChoice);
    const allowed = forcedChoice || this.canOpenBackpack(state);
    const nextOpen = options.forceClose
      ? false
      : forcedChoice || (Boolean(open) && allowed);
    this.backpackOpen = nextOpen;

    const drawer = document.getElementById("battle-pack-drawer");
    const wasOpen = Boolean(drawer && !drawer.hidden);
    const wasForcedOpen = Boolean(drawer && drawer.dataset.forced === "true" && !drawer.hidden);
    if (drawer) {
      drawer.hidden = !nextOpen;
      drawer.dataset.forced = forcedChoice ? "true" : "false";
      if (forcedChoice && nextOpen) {
        drawer.setAttribute("role", "dialog");
        drawer.setAttribute("aria-modal", "true");
        drawer.setAttribute("aria-describedby", "battle-loot-choice-detail");
      } else {
        drawer.removeAttribute("role");
        drawer.removeAttribute("aria-modal");
        drawer.removeAttribute("aria-describedby");
      }
    }
    const toggle = document.getElementById("battle-pack-toggle");
    if (toggle) {
      toggle.disabled = !allowed;
      toggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      toggle.title = allowed
        ? (nextOpen ? "关闭远征背包（B）" : "打开远征背包（B）")
        : "搜索和撤离过程中不能整理背包";
    }
    const close = document.getElementById("battle-pack-close");
    if (close) {
      close.hidden = forcedChoice;
      close.disabled = forcedChoice;
    }
    const board = document.querySelector(".battle-board-panel");
    if (board) {
      board.inert = Boolean(forcedChoice && nextOpen);
      board.setAttribute("aria-hidden", forcedChoice && nextOpen ? "true" : "false");
    }
    if (forcedChoice && nextOpen && !wasForcedOpen) {
      this.clearControlInput();
      const status = document.getElementById("battle-action-status");
      if (status) status.textContent = "背包已满，请先选择替换物品或放弃新战利品";
      if (this.modalFocusManager) {
        this.modalFocusManager.activate?.(
          drawer,
          '[data-loot-action]:not([disabled]), button:not([disabled])'
        );
      } else {
        queueMicrotask(() => {
          if (drawer?.hidden === false) {
            const focusTarget = drawer.querySelector(
              '[data-loot-action]:not([disabled]), button:not([disabled])'
            ) || drawer;
            focusTarget.focus?.();
          }
        });
      }
    } else if (wasOpen && !nextOpen && drawer?.contains(document.activeElement)) {
      if (wasForcedOpen && this.modalFocusManager) {
        this.modalFocusManager.release?.(drawer);
      } else {
        const restoreTarget = !toggle?.disabled
          ? toggle
          : document.getElementById("battle-restart-btn");
        restoreTarget?.focus?.();
      }
    } else if (wasForcedOpen && !nextOpen && this.modalFocusManager) {
      this.modalFocusManager.release?.(drawer);
    }
    return nextOpen;
  }

  getNavigationCandidates(state = {}) {
    const world = state.world || {};
    const candidates = [];
    const seen = new Set();
    const append = (id, kind, name = "地图目标") => {
      if (!id || seen.has(String(id))) return;
      seen.add(String(id));
      candidates.push({ id: String(id), kind, name });
    };

    (state.routeChoices || []).forEach((node) => {
      const location = (world.locations || []).find((item) => item.nodeId === node.id);
      if (!location || ["available", "engaged"].includes(location.state)) {
        append(node.id, "route", node.name);
      }
    });
    (world.locations || []).forEach((location) => {
      if (
        location.kind === "world-event"
        && location.state === "available"
        && (location.known || location.discovered)
      ) {
        append(location.id, "world-event", location.name);
      }
    });
    (world.extractionLocations || world.locations || []).forEach((location) => {
      if (location.kind === "extraction" && ["unlocked", "engaged"].includes(location.state)) {
        append(location.id, "extraction", location.name);
      }
    });
    return candidates;
  }

  cycleNavigationTarget(providedState = null) {
    const state = providedState || this.combatSystem?.getBattleState?.() || {};
    if (!state.actions?.canTrackMap) {
      return { success: false, message: "当前不需要切换地图目标" };
    }
    const candidates = this.getNavigationCandidates(state);
    if (candidates.length === 0) {
      return { success: false, message: "当前没有可追踪的地图目标" };
    }
    const current = state.world?.navigationTarget || {};
    const currentIndex = candidates.findIndex((candidate) => (
      candidate.id === String(current.id || "")
      || candidate.id === String(current.nodeId || "")
    ));
    const next = candidates[(currentIndex + 1 + candidates.length) % candidates.length];
    return this.combatSystem.trackLocation(next.id);
  }

  syncActionContext(state = {}) {
    const phase = state.phase || "briefing";
    const activeSearch = state.activeSearch || state.searchState || null;
    const contextVisible = Boolean(
      state.actions?.canSearch
      || state.actions?.canRest
      || activeSearch
    );
    const contextDock = document.getElementById("battle-context-dock");
    if (contextDock) contextDock.hidden = !contextVisible;
    const battleScene = document.getElementById("battle-scene");
    if (battleScene) battleScene.dataset.contextActive = contextVisible ? "true" : "false";

    const contextTitle = document.getElementById("battle-context-title");
    if (contextTitle) {
      contextTitle.textContent = activeSearch
        ? "正在搜索"
        : state.actions?.canRest
          ? "营地选择"
          : "选择搜索方式";
    }

    const prepTitle = document.getElementById("battle-prep-title");
    const prepSubtitle = document.getElementById("battle-prep-subtitle");
    const prepCopy = {
      briefing: ["远征准备", "选一把武器即可出发；高级配装与委托按需展开。"],
      extracted: ["撤离成功", "战利品已经入库，本局收益已完成结算。"],
      defeat: ["行动结束", "安全袋与战败结果已经结算，可以调整整备后再次出发。"],
    }[phase] || ["远征进行中", "保持移动，靠近地点后按 E 交互。"];
    if (prepTitle) prepTitle.textContent = prepCopy[0];
    if (prepSubtitle) prepSubtitle.textContent = prepCopy[1];

    const candidates = this.getNavigationCandidates(state);
    const targetButton = document.getElementById("battle-target-cycle-btn");
    if (targetButton) {
      targetButton.hidden = !state.actions?.canTrackMap;
      targetButton.disabled = candidates.length === 0;
      targetButton.setAttribute(
        "aria-label",
        candidates.length > 1
          ? "切换地图追踪目标（M）"
          : candidates.length === 1 ? "追踪当前地图目标（M）" : "当前没有地图目标"
      );
    }
    const targetHint = document.getElementById("battle-target-cycle-hint");
    if (targetHint) {
      targetHint.textContent = candidates.length > 1
        ? `点击或 M 切换 · ${candidates.length} 个目标`
        : candidates.length === 1 ? "点击或 M 追踪" : "暂无目标";
    }

    const wasForced = this.backpackForced;
    this.backpackForced = Boolean(state.actions?.canAbandon && state.pendingLootChoice);
    if (this.backpackForced) {
      this.setBackpackOpen(true, state);
    } else if (wasForced) {
      this.setBackpackOpen(false, state, { forceClose: true });
    } else if (this.backpackOpen && !this.canOpenBackpack(state)) {
      this.setBackpackOpen(false, state, { forceClose: true });
    } else {
      this.setBackpackOpen(this.backpackOpen, state);
    }

    if (this.lastActionPhase !== phase) {
      const status = document.getElementById("battle-action-status");
      if (status && this.lastActionPhase !== null) {
        status.textContent = `远征已进入${state.phaseLabel || "新阶段"}`;
      }
      this.lastActionPhase = phase;
    }
  }

  renderRunSummary(state = {}, formatNumber = String) {
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    };
    const settlement = state.settlement || null;
    const detail = document.getElementById("battle-settlement-detail");

    if (!settlement) {
      setText("battle-summary-label-a", "已探索");
      setText("battle-summary-label-b", "本局击杀");
      setText("battle-summary-label-c", "携带价值");
      setText("battle-summary-label-d", "历史撤离");
      const routeLocations = (state.world?.locations || []).filter((location) => location.kind === "route");
      const exploredLocations = routeLocations.filter((location) => (
        location.completed || ["visited", "cleared", "completed", "searched"].includes(location.state)
      )).length;
      setText(
        "battle-rooms-display",
        `${state.exploredCount ?? exploredLocations} / ${state.hotspotCount ?? routeLocations.length ?? state.maxDepth ?? 0}`
      );
      setText("battle-kills-display", state.rewards?.kills || 0);
      setText("battle-reward-coins", formatNumber(state.pendingValue || 0));
      setText("battle-extractions-display", state.meta?.extractions || 0);
      if (detail) detail.hidden = true;
      return;
    }

    setText("battle-summary-label-a", "结算金币");
    setText("battle-summary-label-b", "水晶 / 红宝石");
    setText("battle-summary-label-c", "结算经验");
    setText(
      "battle-summary-label-d",
      settlement.extracted ? "带回战利品" : "安全袋 / 遗失"
    );
    setText("battle-rooms-display", formatNumber(settlement.coins || 0));
    setText(
      "battle-kills-display",
      `${formatNumber(settlement.crystals || 0)} / ${formatNumber(settlement.rubyReward || 0)}`
    );
    setText("battle-reward-coins", formatNumber(settlement.exp || 0));
    setText(
      "battle-extractions-display",
      settlement.extracted
        ? `${settlement.lootExtracted || 0} 件`
        : `${settlement.insuredLootRecovered || 0} / ${settlement.lootLost || 0} 件`
    );
    if (detail) {
      detail.hidden = false;
      detail.textContent = this.getTip(state);
    }
  }

  getAtRiskLoadoutItems(metaState = null) {
    const state = metaState || this.expeditionMetaSystem?.getState?.() || {};
    const activeRaid = state.activeRaid;
    if (!activeRaid) return [];
    const protectedIds = new Set((activeRaid.insuredLoadoutIds || []).map(String));
    const loadout = state.loadout || activeRaid.loadoutSnapshot || {};
    return [
      loadout.mainWeapon,
      loadout.armor,
      loadout.petLinker,
      ...(loadout.consumables || []),
    ].filter((item) => item
      && !item.permanent
      && !item.keepOnFailure
      && !protectedIds.has(String(item.instanceId)));
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
    const routeLocations = (state.world?.locations || []).filter((location) => location.kind === "route");
    const exploredLocations = routeLocations.filter((location) => (
      location.completed || ["visited", "cleared", "completed", "searched"].includes(location.state)
    )).length;
    setText(
      "battle-depth-display",
      `${state.exploredCount ?? exploredLocations} / ${state.hotspotCount ?? routeLocations.length ?? state.maxDepth ?? 0}`
    );
    const guardHp = Math.ceil(state.petGuard?.hp || 0);
    const guardMaxHp = Math.ceil(state.petGuard?.maxHp || 0);
    setText(
      "battle-hp-display",
      state.actions.canAbandon && guardMaxHp > 0
        ? `${state.hp}/${state.maxHp} · 护${guardHp}`
        : `${state.hp}/${state.maxHp}`
    );
    setText(
      "battle-threat-display",
      `${this.getThreatTierLabel(state)} · ${state.threat}${state.raidThreatActive ? " · 暴露" : ""}`
    );
    setText("battle-bag-display", `${state.backpackCount}/${state.backpackCapacity}`);
    setText(
      "battle-guard-display",
      `${guardHp}/${guardMaxHp}${state.petGuard?.rescueReady ? " +救援" : ""}`
    );
    setText("battle-enemy-display", state.activeEnemies + state.queuedEnemies);
    setText("battle-supplies-display", `补给 ${state.supplies}`);
    setText("battle-event-feed", state.lastAction);
    setText(
      "battle-location-display",
      state.world.navigationTarget
        ? `${this.getNavigationLabel(state.world.navigationTarget)} · ${this.getNavigationHint(state.world.navigationTarget)}`
        : "自由探索"
    );
    setText("battle-interact-label", state.interaction.label);
    setText("battle-interact-detail", state.interaction.detail);

    const battleScene = document.getElementById("battle-scene");
    if (battleScene) {
      const combatEngaged = Boolean(
        state.phase === "combat"
        || state.phase === "extracting"
        || state.raidThreatActive
      );
      battleScene.dataset.phase = state.phase;
      battleScene.dataset.moving = state.world.player.moving ? "true" : "false";
      battleScene.dataset.raidActive = state.actions.canAbandon ? "true" : "false";
      battleScene.dataset.combatActive = combatEngaged ? "true" : "false";
    }
    const flowLayer = document.getElementById("battle-flow-layer");
    if (flowLayer) {
      flowLayer.dataset.phase = state.phase;
      flowLayer.dataset.raidActive = state.actions.canAbandon ? "true" : "false";
    }
    const loadoutPanel = document.getElementById("battle-loadout-panel");
    if (loadoutPanel) loadoutPanel.dataset.raidActive = state.actions.canAbandon ? "true" : "false";
    setText("battle-loadout-title", state.actions.canAbandon ? "本局锁定武器" : "出发配装与委托");

    const status = document.querySelector(".extraction-run-status");
    if (status) status.dataset.threat = state.threat >= 70 ? "high" : state.threat >= 40 ? "medium" : "low";

    this.renderCurrentRoom(state);
    this.renderRunSummary(state, formatNumber);
    this.renderLoot(state.backpack, state);
    this.renderLootChoice(state.pendingLootChoice);
    this.renderRiskPreview(state, formatNumber);
    const teamSkills = state.teamSkill
      ? [state.teamSkill]
      : Array.isArray(state.petSkills) ? state.petSkills : [];
    this.renderPetSkills(teamSkills, state.isWaveActive);
    this.renderSearchBonuses(
      state.searchBonuses,
      teamSkills.length > 0,
      state.searchProfiles || state.run?.searchProfiles || {},
      state
    );
    this.renderWeaponState(state.weapon || this.combatSystem.getWeaponState?.(), state);
    this.renderSearchProgress(state.activeSearch || state.searchState || null);
    this.renderMetaState(state.raidMeta || this.expeditionMetaSystem?.getState?.(), state);

    setHidden("battle-search-actions", !state.actions.canSearch);
    setHidden("battle-camp-actions", !state.actions.canRest);
    setHidden("battle-use-supply-btn", !state.actions.canHeal);
    setHidden("battle-restart-btn", !(state.phase === "extracted" || state.phase === "defeat"));
    setHidden("battle-start-expedition-btn", state.phase !== "briefing");
    setHidden("battle-world-controls", !state.actions.canAbandon);
    setHidden("battle-weapon-hud", !state.actions.canAbandon);

    const startButton = document.getElementById("battle-start-expedition-btn");
    if (startButton) {
      startButton.disabled = !state.actions.canStart;
      startButton.textContent = "选好武器，开始远征";
    }
    const restartButton = document.getElementById("battle-restart-btn");
    if (restartButton) restartButton.textContent = "返回整备";
    const healButton = document.getElementById("battle-use-supply-btn");
    if (healButton) healButton.disabled = !state.actions.canHeal;
    const interactButton = document.getElementById("battle-interact-btn");
    if (interactButton) interactButton.disabled = !state.actions.canInteract;
    const fireButton = document.getElementById("battle-fire-btn");
    const combatControlsActive = Boolean(state.actions.canFire ?? state.actions.canAbandon);
    if (fireButton) fireButton.disabled = !combatControlsActive;
    const reloadButton = document.getElementById("battle-reload-btn");
    if (reloadButton) {
      const activeWeapon = state.weapon?.active;
      reloadButton.disabled = !combatControlsActive
        || Boolean(activeWeapon?.reloading)
        || Number(activeWeapon?.reserve || 0) <= 0
        || Number(activeWeapon?.magazine || 0) >= Number(activeWeapon?.magazineSize || activeWeapon?.capacity || Infinity);
    }
    setText("battle-command-tip", this.getTip(state));
    this.syncActionContext(state);
    this.handleSettlement(state);
  }

  getNavigationLabel(location = null) {
    if (!location) return "自由探索";
    if (location.kind === "route" && !(location.known || location.discovered)) return "未知信号";
    return location.name || "地图目标";
  }

  getNavigationHint(location = null) {
    if (!location) return "自由探索";
    if (location.guidance || location.navigationHint) {
      return String(location.guidance || location.navigationHint);
    }
    if (location.directionLabel || location.distanceBandLabel) {
      return [location.directionLabel, location.distanceBandLabel].filter(Boolean).join(" · ");
    }
    const distance = Math.max(0, Number(location.distance) || 0);
    const distanceBand = distance <= 120
      ? "就在附近"
      : distance <= 360
        ? "中距离"
        : distance <= 720
          ? "远处"
          : "深区";
    return location.directionLabel
      ? `${location.directionLabel} · ${distanceBand}`
      : distanceBand;
  }

  getThreatTierLabel(state = {}) {
    const preview = state.threatPreview || state.threatForecast || {};
    if (preview.label || preview.tierLabel) return preview.label || preview.tierLabel;
    const threat = Math.max(0, Number(state.threat) || 0);
    return threat >= 75 ? "封锁" : threat >= 50 ? "围猎" : threat >= 25 ? "追踪" : "警戒";
  }

  renderWeaponState(weaponState = null, state = {}) {
    const active = weaponState?.active || null;
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    };
    setText("battle-weapon-name", active?.name || "未装备武器");
    setText("battle-ammo-magazine", active?.magazine ?? "--");
    setText("battle-ammo-reserve", active?.reserve ?? "--");

    const reloadTrack = document.getElementById("battle-reload-track");
    const reloadProgress = document.getElementById("battle-reload-progress");
    const reloadLabel = document.getElementById("battle-reload-label");
    if (reloadTrack) reloadTrack.hidden = !active?.reloading;
    if (reloadProgress) {
      const total = Math.max(1, Number(active?.reloadMs) || 1);
      reloadProgress.value = active?.reloading
        ? Math.max(0, Math.min(1, 1 - Number(active.reloadRemainingMs || 0) / total))
        : 0;
    }
    if (reloadLabel && active?.reloading) {
      reloadLabel.textContent = `换弹 ${Math.ceil(active.reloadRemainingMs / 100) / 10}s`;
    }

    const slotContainer = document.getElementById("battle-weapon-slots");
    if (slotContainer && Array.isArray(weaponState?.weapons)) {
      const raidActive = Boolean(state.actions?.canAbandon);
      slotContainer.setAttribute("aria-label", raidActive ? "本局锁定武器" : "出发武器选择");
      const roles = {
        rifle: "稳定中距",
        shotgun: "近距爆发",
        marksman: "远距精确",
      };
      const visibleWeapons = raidActive
        ? [active || weaponState.weapons.find((weapon) => weapon.active)].filter(Boolean)
        : weaponState.weapons;
      slotContainer.innerHTML = visibleWeapons.map((weapon) => `
        <button type="button" class="expedition-weapon-slot" data-weapon-id="${this.escapeHTML(weapon.id)}"
          aria-pressed="${weapon.active ? "true" : "false"}"
          title="${this.escapeHTML(`${roles[weapon.id] || "战斗武器"} · 射程 ${weapon.range || 0}`)}"
          ${!raidActive && weapon.available !== false && state.actions?.canStart ? "" : "disabled"}>
          <span>${this.escapeHTML(weapon.name)}</span>
          <small>${raidActive ? "本局锁定 · R 换弹" : roles[weapon.id] || "战斗武器"}</small>
        </button>
      `).join("");
    }
  }

  renderSearchProgress(search = null) {
    const panel = document.getElementById("battle-search-progress");
    if (!panel) return;
    panel.hidden = !search;
    if (!search) return;
    const profileName = search.profileName || search.label || ({
      quick: "快速拿取",
      thorough: "彻底搜刮",
    }[search.mode] || "搜索");
    const progress = Math.max(0, Math.min(1, Number(search.progress) || 0));
    const remainingMs = Math.max(0, Number(search.remainingMs) || 0);
    const label = document.getElementById("battle-search-progress-label");
    const time = document.getElementById("battle-search-progress-time");
    const bar = document.getElementById("battle-search-progress-bar");
    if (label) label.textContent = `正在${profileName}`;
    if (time) time.textContent = `还需 ${(remainingMs / 1000).toFixed(1)} 秒`;
    if (bar) bar.value = progress;
  }

  purchaseLoadoutInsurance(instanceId) {
    const quote = this.expeditionMetaSystem?.quoteLoadoutInsurance?.(instanceId);
    if (!quote?.success) return quote || { success: false, message: "装备保险暂不可用" };
    if (quote.alreadyInsured) {
      return { success: true, duplicate: true, message: `${quote.item?.name || "该装备"}已投保` };
    }
    if (Number(quote.voucherCount || 0) > 0) {
      return this.expeditionMetaSystem.insureLoadoutItem?.(instanceId, { useVoucher: true });
    }
    const premium = Math.max(0, Number(quote.premium) || 0);
    if (!this.resourceSystem?.hasEnoughCoins?.(premium)) {
      return { success: false, message: `装备保险需要 ${premium} 金币或 1 张保险券` };
    }
    const result = this.expeditionMetaSystem.insureLoadoutItem?.(instanceId, {
      useVoucher: false,
      useBalance: false,
      paidCoins: premium,
    });
    if (result?.success && premium > 0) this.resourceSystem.spendCoins?.(premium);
    return result;
  }

  renderMetaState(metaState = null, state = {}) {
    if (!metaState) return;
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    };
    const inboxCount = (metaState.deliveryInbox || [])
      .reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
    setText(
      "battle-stash-summary",
      `仓库 ${metaState.warehouseUsed || 0}/${metaState.warehouseCapacity || 0}${inboxCount ? ` · 待领 ${inboxCount}` : ""}`
    );

    const raidActive = Boolean(metaState.activeRaid && state.actions?.canAbandon);
    const loadout = (raidActive ? metaState.activeRaid?.loadoutSnapshot : metaState.loadout) || {};
    const atRiskLoadout = this.getAtRiskLoadoutItems(metaState);
    const atRiskSummary = atRiskLoadout.length
      ? `；失败会遗失：${atRiskLoadout.map((item) => item.name || "未命名装备").join("、")}`
      : "；当前没有暴露配装";
    const consumables = (loadout.consumables || []).filter(Boolean).length;
    const canManage = Boolean(state.actions?.canStart && !metaState.activeRaid);
    const currentWeaponName = state.weapon?.active?.name || loadout.mainWeapon?.name || "制式武器";
    const selectedInsuranceIds = new Set([
      ...(metaState.insurance?.selected || []).map((entry) => String(entry.instanceId)),
      ...(metaState.insurance?.activeRaidInsuredIds || []).map(String),
    ]);
    const metaRenderSignature = JSON.stringify({
      raidActive,
      canManage,
      currentWeaponName,
      warehouseUsed: metaState.warehouseUsed,
      warehouseCapacity: metaState.warehouseCapacity,
      warehouse: metaState.warehouse,
      deliveryInbox: metaState.deliveryInbox,
      loadout,
      activeRaid: metaState.activeRaid,
      insurance: metaState.insurance,
      crafting: metaState.crafting,
      facilityUpgrades: metaState.facilityUpgrades,
      contracts: metaState.contracts,
    });
    if (metaRenderSignature === this.lastMetaRenderSignature) return;
    this.lastMetaRenderSignature = metaRenderSignature;
    const renderInsuranceControl = (item) => {
      if (!item || item.permanent || item.bound || item.keepOnFailure) return "";
      const insured = selectedInsuranceIds.has(String(item.instanceId));
      if (insured) {
        return `<button type="button" data-loadout-uninsure="${this.escapeHTML(item.instanceId)}" ${canManage ? "" : "disabled"}>已投保</button>`;
      }
      const premium = Math.max(1, Math.ceil(Math.max(0, Number(item.sellPrice) || 0) * 0.2));
      return `<button type="button" data-loadout-insure="${this.escapeHTML(item.instanceId)}" ${canManage ? "" : "disabled"}>保险 ${premium}</button>`;
    };
    setText(
      "battle-loadout-summary",
      raidActive
        ? `本局武器已锁定为 ${currentWeaponName}；R 手动换弹，空弹时仍会自动换弹${atRiskSummary}。`
        : `${loadout.mainWeapon?.name || "制式训练武器组"} · ${loadout.armor?.name || "无护甲"} · ${loadout.petLinker?.name || "无宠物链接器"} · 消耗品 ${consumables}/4。确认后锁定配装；基础武器不会遗失。`
    );

    const equippedItems = document.getElementById("battle-equipped-items");
    if (equippedItems) {
      const activeWeapon = state.weapon?.active
        || state.weapon?.weapons?.find(weapon => weapon.id === loadout.mainWeapon?.combatWeaponId);
      const cards = [
        `<div class="expedition-equipped-item permanent"><span>${raidActive ? "本局锁定武器" : "出发武器"}</span><b>${this.escapeHTML(activeWeapon?.name || loadout.mainWeapon?.name || "制式武器")}</b>${renderInsuranceControl(loadout.mainWeapon)}</div>`,
        `<div class="expedition-equipped-item"><span>护甲</span><b>${this.escapeHTML(loadout.armor?.name || "空")}</b>${renderInsuranceControl(loadout.armor)}${loadout.armor ? `<button type="button" data-loadout-unequip="armor" ${canManage ? "" : "disabled"}>卸下</button>` : ""}</div>`,
        `<div class="expedition-equipped-item"><span>宠物链接</span><b>${this.escapeHTML(loadout.petLinker?.name || "空")}</b>${renderInsuranceControl(loadout.petLinker)}${loadout.petLinker ? `<button type="button" data-loadout-unequip="petLinker" ${canManage ? "" : "disabled"}>卸下</button>` : ""}</div>`,
        ...(loadout.consumables || []).map((item, index) => `
          <div class="expedition-equipped-item compact"><span>补给 ${index + 1}</span><b>${this.escapeHTML(item?.name || "空")}${item ? ` ×${Math.max(1, Number(item.quantity) || 1)}` : ""}</b>
            ${item ? `<button type="button" data-loadout-unequip="consumable" data-consumable-index="${index}" ${canManage ? "" : "disabled"}>卸下</button>` : ""}
          </div>
        `),
      ];
      equippedItems.innerHTML = cards.join("");
    }

    const formatRequirements = (requirements = []) => requirements
      .map((requirement) => `${requirement.label} ${requirement.current}/${requirement.required}`)
      .join(" · ");
    const craftingList = document.getElementById("battle-crafting-list");
    if (craftingList) {
      const recipes = metaState.crafting?.recipes || this.expeditionMetaSystem?.getCraftingRecipes?.() || [];
      craftingList.innerHTML = recipes.map((recipe) => `
        <article class="expedition-meta-action-card">
          <div><strong>${this.escapeHTML(recipe.name)}</strong><small>${this.escapeHTML(recipe.description || "")}</small></div>
          <span>${this.escapeHTML(formatRequirements(recipe.requirements))}</span>
          <button type="button" data-craft-recipe="${this.escapeHTML(recipe.id)}" ${canManage && recipe.available ? "" : "disabled"}>制作</button>
        </article>
      `).join("") || '<span class="expedition-empty-loot">暂无可用配方</span>';
    }

    const facilityList = document.getElementById("battle-facility-list");
    if (facilityList) {
      const upgrades = Object.values(metaState.facilityUpgrades || {});
      facilityList.innerHTML = upgrades.map((upgrade) => `
        <article class="expedition-meta-action-card">
          <div><strong>${this.escapeHTML(upgrade.label)}</strong><small>Lv.${upgrade.level}/${upgrade.maxLevel} · 当前容量 ${upgrade.capacity}</small></div>
          <span>${upgrade.next ? this.escapeHTML(formatRequirements(upgrade.requirements)) : "已满级"}</span>
          <button type="button" data-facility-upgrade="${this.escapeHTML(upgrade.id)}" ${canManage && upgrade.available ? "" : "disabled"}>升级</button>
        </article>
      `).join("") || '<span class="expedition-empty-loot">暂无设施升级</span>';
    }

    const stashList = document.getElementById("battle-stash-list");
    if (stashList) {
      const items = Array.isArray(metaState.warehouse) ? metaState.warehouse : [];
      const rows = items.map(item => {
        const equipSlot = this.expeditionMetaSystem?.expectedEquipSlot?.(item);
        return `
          <div class="expedition-stash-item rarity-${this.escapeHTML(item.rarity || "common")}">
            <span title="${this.escapeHTML(item.purposeUse || item.use || item.description || "")}">${this.escapeHTML(item.name)} ×${Math.max(1, Number(item.quantity) || 1)}${item.purposeLabel ? ` · ${this.escapeHTML(item.purposeLabel)}` : ""}</span>
            <div class="expedition-stash-actions">
              ${equipSlot ? `<button type="button" data-stash-equip="${this.escapeHTML(item.instanceId)}" ${canManage ? "" : "disabled"}>装备</button>` : ""}
              <button type="button" data-stash-sell="${this.escapeHTML(item.instanceId)}"
                ${item.bound || item.permanent || !canManage ? "disabled" : ""}>出售 ${Math.max(0, Number(item.sellPrice) || 0)}</button>
            </div>
          </div>
        `;
      });
      if (inboxCount > 0) {
        rows.push(`<button type="button" class="expedition-action-btn" data-stash-claim="true" ${canManage ? "" : "disabled"}>领取暂存物资 <span>${inboxCount} 件</span></button>`);
      }
      stashList.innerHTML = rows.length
        ? rows.join("")
        : '<span class="expedition-empty-loot">仓库为空；成功撤离后，战利品会在这里保留。</span>';
    }

    const contractList = document.getElementById("battle-contract-list");
    if (contractList) {
      const contracts = metaState.contracts || {};
      const active = Array.isArray(contracts.active) ? contracts.active : [];
      const board = Array.isArray(contracts.board) ? contracts.board : [];
      const slots = contracts.slots || {};
      const formatReward = (reward = {}) => {
        const parts = [];
        if (reward.coins) parts.push(`${reward.coins} 金币`);
        if (reward.crystals) parts.push(`${reward.crystals} 水晶`);
        if (reward.rubies) parts.push(`${reward.rubies} 红宝石`);
        const itemCount = Array.isArray(reward.items) ? reward.items.length : 0;
        if (itemCount) parts.push(`${itemCount} 件物资`);
        return parts.join(" · ") || "无额外奖励";
      };
      const activeRows = active.map(contract => `
        <article class="expedition-contract-item">
          <strong>${contract.category === "main" ? "主线" : "支线"} · ${this.escapeHTML(contract.title)}</strong>
          <div class="expedition-contract-actions">
            <button type="button" data-contract-turn-in="${this.escapeHTML(contract.contractId)}"
              ${contract.status === "ready" && canManage ? "" : "disabled"}>${contract.status === "ready" ? "交付" : `${contract.progress}/${contract.target}`}</button>
            <button type="button" data-contract-abandon="${this.escapeHTML(contract.contractId)}" ${canManage ? "" : "disabled"}>放弃</button>
          </div>
          <small>${this.escapeHTML(contract.description)} · 奖励：${this.escapeHTML(formatReward(contract.reward))}</small>
        </article>
      `);
      const canAccept = canManage;
      const offerRows = board.map(offer => {
        const categoryFull = offer.category === "main"
          ? Number(slots.main || 0) >= Number(slots.mainMax || 1)
          : Number(slots.side || 0) >= Number(slots.sideMax || 2);
        return `
          <article class="expedition-contract-item">
            <strong>可接 · ${this.escapeHTML(offer.title)}</strong>
            <button type="button" data-contract-accept="${this.escapeHTML(offer.offerId)}" ${canAccept && !categoryFull ? "" : "disabled"}>${categoryFull ? "槽位已满" : "接受"}</button>
            <small>${this.escapeHTML(offer.description)} · 奖励：${this.escapeHTML(formatReward(offer.reward))}</small>
          </article>
        `;
      });
      contractList.innerHTML = [...activeRows, ...offerRows].join("")
        || '<span class="expedition-empty-loot">暂无可用合约</span>';
    }
  }

  handleMetaActionResult(result) {
    if (!result) return;
    if (result.success || result.changed) {
      const balance = this.expeditionMetaSystem?.claimBalances?.()
        || this.expeditionMetaSystem?.drainBalances?.()
        || {};
      this.resourceSystem?.addCoins?.(balance.coins || 0);
      this.resourceSystem?.addCrystals?.(balance.crystals || 0);
      this.resourceSystem?.addRubies?.(balance.rubies || 0);
      this.playerSystem?.addExperience?.(balance.exp || 0);
      void this.saveSystem?.saveGame?.(1);
    }
    this.renderMetaState(
      this.expeditionMetaSystem?.getState?.(),
      this.combatSystem?.getBattleState?.() || {}
    );
    this.uiSystem?.showToast?.(
      result.message || (result.success ? "远征仓库已更新" : "操作未完成"),
      result.success ? "success" : "info"
    );
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
      briefing: ["行动简报", "未知禁区", "撤离后才会结算全部收益", "侦察热点、绕开或解决威胁；觉得够了就返回入口撤离。"],
      route: [
        "大地图探索",
        state.interaction.location?.name || this.getNavigationLabel(state.world.navigationTarget) || "荒野行进",
        state.interaction.location ? "已进入交互范围" : "入口始终可以止损撤离",
        state.interaction.location
          ? state.interaction.location.description
          : "使用 WASD 或方向键移动；点击顶部目标条可轮换追踪地点。"
      ],
      "extraction-ready": ["最终目标", "选择撤离路线", "入口返程或深区应急撤离", "比较距离、守点时间、敌人规模与补给成本后再决定撤离路线。"],
      extracted: ["远征结算", "撤离成功", "背包战利品已入库", "战斗现金和经验已发放；物品需在仓库中出售、装备或用于委托。"],
      defeat: ["远征结算", "撤离失败", "未保护战利品与未保险配装会遗失", "只有到达撤离点才能带回完整收益；退出只保留安全袋。"],
    };
    const summary = summaries[state.phase] || ["行动状态", state.phaseLabel, "远征进行中", state.lastAction];
    setText("battle-room-kicker", summary[0]);
    setText("battle-room-name", summary[1]);
    setText("battle-room-risk", summary[2]);
    setText("battle-room-desc", summary[3]);
  }

  renderLoot(backpack = [], state = {}) {
    const list = document.getElementById("battle-loot-list");
    if (!list) return;
    const insuredCount = backpack.filter((loot) => loot.insured).length;
    const insuranceCapacity = Math.max(0, Number(state.insuredSlotCount) || 0);
    const insuranceDisplay = document.getElementById("battle-insurance-display");
    if (insuranceDisplay) {
      insuranceDisplay.textContent = `安全袋 ${insuredCount}/${insuranceCapacity}`;
      insuranceDisplay.title = "主动撤退或阵亡时，安全袋内的战利品仍可带回";
    }
    const canPackSafetyBag = Boolean(
      state.actions?.canAbandon
      && !(state.activeSearch || state.searchState)
      && state.phase !== "extracting"
      && !state.raidThreatActive
      && !state.pendingLootChoice
    );
    if (backpack.length === 0) {
      const empty = document.createElement("span");
      empty.className = "expedition-empty-loot";
      empty.textContent = "暂无战利品";
      list.replaceChildren(empty);
      return;
    }

    const items = [...backpack].reverse().map((loot) => {
      const item = document.createElement("div");
      item.className = `expedition-loot-item rarity-${loot.rarity}`;
      const copy = document.createElement("span");
      copy.className = "expedition-loot-item-copy";
      const name = document.createElement("span");
      const marker = loot.marker || (loot.locked ? "锁定" : loot.questItem ? "任务" : "");
      name.textContent = `${marker ? `[${marker}] ` : ""}${loot.icon || "◇"} ${loot.name}`;
      const use = document.createElement("small");
      use.textContent = loot.use || `${loot.rarityLabel || "普通"}战利品`;
      copy.append(name, use);
      const value = document.createElement("b");
      const singleValue = Math.max(
        0,
        Number(loot.score ?? ((Number(loot.coins) || 0) + (Number(loot.crystals) || 0))) || 0
      );
      value.textContent = `价值 ${singleValue}`;
      const insureButton = document.createElement("button");
      insureButton.type = "button";
      insureButton.className = "expedition-loot-insure";
      insureButton.dataset.lootInsure = loot.id;
      insureButton.setAttribute("aria-pressed", loot.insured ? "true" : "false");
      insureButton.disabled = !canPackSafetyBag;
      insureButton.textContent = loot.insured ? "已装袋" : "装入安全袋";
      insureButton.title = canPackSafetyBag
        ? (loot.insured ? "点击移出安全袋" : "失败时仍可带回此物品")
        : "被敌人发现、搜索和撤离期间无法整理安全袋";
      const markButton = document.createElement("button");
      markButton.type = "button";
      markButton.className = "expedition-loot-mark";
      markButton.dataset.lootMark = loot.id;
      markButton.setAttribute("aria-pressed", loot.locked ? "true" : "false");
      markButton.disabled = Boolean(loot.insured || !state.actions?.canAbandon || state.pendingLootChoice);
      markButton.textContent = loot.locked ? "已锁定" : "锁定";
      markButton.title = loot.locked ? "允许该物品被替换" : "阻止背包取舍时替换此物品";
      const actions = document.createElement("span");
      actions.className = "expedition-loot-actions";
      actions.append(markButton, insureButton);
      item.append(copy, value, actions);
      return item;
    });
    list.replaceChildren(...items);
  }

  renderLootChoice(choice = null) {
    const panel = document.getElementById("battle-loot-choice-panel");
    if (!panel) return;
    panel.hidden = !choice;
    if (!choice) {
      document.getElementById("battle-loot-replace-list")?.replaceChildren();
      return;
    }

    const incoming = choice.incoming || {};
    const name = document.getElementById("battle-loot-choice-name");
    if (name) {
      const value = (incoming.score || 0) > 0 ? ` · 价值 ${incoming.score}` : "";
      const marker = choice.marker || incoming.marker || (incoming.questItem ? "任务" : incoming.locked ? "锁定" : "");
      name.textContent = `${marker ? `[${marker}] ` : ""}${incoming.icon || "◇"} ${incoming.name || "新战利品"}${value}`;
    }
    const detail = document.getElementById("battle-loot-choice-detail");
    if (detail) {
      const purpose = incoming.purposeUse || incoming.use || "选择一件未装入安全袋的物品替换，或放弃新战利品。";
      detail.textContent = choice.marked ? `重要物资：${purpose}` : purpose;
    }

    const options = Array.isArray(choice.replaceOptions) ? choice.replaceOptions : [];
    const buttons = options.map((loot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.lootAction = "replace";
      button.dataset.lootItemId = loot.id;
      button.disabled = Boolean(loot.insured || loot.locked);
      button.textContent = loot.insured
        ? `🔒 ${loot.name} · 已装入安全袋，无法替换`
        : loot.locked
          ? `📌 ${loot.name} · 已锁定，无法替换`
        : `替换 ${loot.name}（价值 ${loot.score || 0}）`;
      return button;
    });
    document.getElementById("battle-loot-replace-list")?.replaceChildren(...buttons);
  }

  renderRiskPreview(state, formatNumber = String) {
    const preview = state.threatPreview || state.threatForecast || {};
    const multiplier = Number(
      preview.currentRewardMultiplier ?? preview.rewardMultiplier ?? state.rewardMultiplier ?? 1
    );
    const tierLabel = preview.label || preview.tierLabel || (
      state.threat >= 75 ? "封锁" : state.threat >= 50 ? "围猎" : state.threat >= 25 ? "追踪" : "警戒"
    );
    const nextThreshold = preview.nextThreshold ?? preview.nextTier ?? null;
    const threatToNext = preview.threatToNext ?? (
      nextThreshold === null ? 0 : Math.max(0, Number(nextThreshold) - Number(state.threat || 0))
    );
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    };
    setText("battle-threat-tier-label", `${tierLabel} · 收益 ×${multiplier.toFixed(2)}`);
    setText(
      "battle-threat-next",
      nextThreshold === null ? "已达最高档" : `${nextThreshold}（还差 ${threatToNext}）`
    );

    const rewards = state.rewards || {};
    const backpackRewards = state.backpackRewards || {};
    const successCoins = Math.max(0, Number(rewards.coins || 0));
    const backpackValue = Math.max(0, Number(backpackRewards.score || 0));
    const explicitlyInsured = (state.backpack || []).filter((loot) => loot.insured);
    const insuredValue = explicitlyInsured.reduce((total, loot) => total + (loot.score || 0), 0);
    const defeatedCoins = Math.floor(Number(rewards.coins || 0) * 0.1);
    const successValue = Math.max(0, Number(state.pendingValue) || successCoins + backpackValue);
    const dangerousExit = Boolean(
      state.phase === "combat"
      || state.phase === "extracting"
      || state.raidThreatActive
    );
    const failureValue = (dangerousExit ? defeatedCoins : 0) + insuredValue;
    setText("battle-success-preview", `总价值 ${formatNumber(successValue)}`);
    setText("battle-failure-preview-label", dangerousExit ? "战斗退出" : "主动退出");
    setText(
      "battle-failure-preview",
      dangerousExit
        ? `战败价值 ${formatNumber(failureValue)} · 安全袋 ${explicitlyInsured.length} 件`
        : `不保留战斗收益 · 安全袋 ${explicitlyInsured.length} 件`
    );
  }

  renderPetSkills(skills = [], combatActive = false) {
    const dock = document.getElementById("battle-skill-dock");
    if (!dock) return;
    const teamSkill = Array.isArray(skills) ? skills[0] : null;
    dock.hidden = !teamSkill;
    const buttons = teamSkill ? [teamSkill].map((skill) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "expedition-skill-btn expedition-team-skill-btn";
      button.dataset.petSkill = skill.instanceId;
      button.style.setProperty("--skill-color", skill.color);
      button.disabled = !skill.ready;
      button.title = `队伍技 · Q：${skill.name} · ${skill.skillName}`;

      const icon = document.createElement("span");
      icon.className = "skill-pet-icon";
      icon.textContent = skill.emoji;
      const label = document.createElement("span");
      label.className = "skill-name";
      label.textContent = `Q · ${skill.skillName}`;
      const cooldown = document.createElement("span");
      cooldown.className = "skill-cooldown";
      cooldown.textContent = combatActive
        ? skill.ready ? "READY" : `${skill.cooldownSeconds}s`
        : "待战";
      button.append(icon, label, cooldown);
      return button;
    }) : [];
    dock.replaceChildren(...buttons);
  }

  renderSearchBonuses(searchBonuses = {}, hasPets = false, profiles = {}, state = {}) {
    const fallbackProfiles = {
      quick: { name: "快速拿取", lootMin: 1, lootMax: 1, threat: 2, ambushChance: 0.04, durationSeconds: 2, supplyCost: 0, role: "低风险、快速离开" },
      thorough: { name: "彻底搜刮", lootMin: 2, lootMax: 3, threat: 10, ambushChance: 0.2, durationSeconds: 5, supplyCost: 0, role: "花费更多时间换取更高收益" },
    };
    document.querySelectorAll("[data-search-mode]").forEach((button) => {
      const mode = button.dataset.searchMode;
      const bonus = searchBonuses?.[mode] || {};
      const profile = profiles?.[mode] || fallbackProfiles[mode] || {};
      const countBonus = Math.max(0, Number(bonus.lootCountBonus) || 0);
      const minLoot = Math.max(0, Number(profile.lootMin) || 0) + countBonus;
      const maxLoot = Math.max(minLoot, Number(profile.lootMax) || minLoot) + countBonus;
      const lootLabel = minLoot === maxLoot ? `${minLoot}件` : `${minLoot}-${maxLoot}件`;
      const threat = Math.max(0, (Number(profile.threat) || 0) - (Number(bonus.threatReduction) || 0));
      const ambush = Math.max(0, (Number(profile.ambushChance) || 0) - (Number(bonus.ambushChanceReduction) || 0));
      const parts = [
        `${profile.durationSeconds || 0}秒`,
        `战利品 ${lootLabel}`,
        `威胁 +${threat}`,
        `伏击 ${Math.round(ambush * 100)}%`,
      ];
      if (profile.supplyCost > 0) parts.push(`补给 -${profile.supplyCost}`);
      if (bonus.qualityBonus > 0) parts.push(`品质 +${bonus.qualityBonus}`);
      if (bonus.supplyChanceBonus > 0) parts.push(`补给发现 +${Math.round(bonus.supplyChanceBonus * 100)}%`);
      const preview = button.querySelector("[data-search-preview]");
      if (preview) preview.textContent = parts.join(" · ");
      const contributors = Array.isArray(bonus.contributors) ? bonus.contributors : [];
      button.dataset.talentActive = contributors.length > 0 ? "true" : "false";
      button.disabled = Boolean(
        (profile.requiresPet && !hasPets) ||
        Number(profile.supplyCost || 0) > Number(state.supplies || 0) ||
        state.pendingLootChoice
      );
      button.title = contributors.length > 0
        ? `${profile.role || ""}；${contributors.map((item) => `${item.petName} · ${item.label}：${item.detail || "生效"}`).join("；")}`
        : (profile.role || "");
    });

    const petBonus = document.getElementById("battle-search-pet-bonus");
    if (petBonus) {
      const contributors = ["quick", "thorough"]
        .flatMap((mode) => Array.isArray(searchBonuses?.[mode]?.contributors)
          ? searchBonuses[mode].contributors
          : []);
      const labels = [...new Set(contributors.map((item) => item.label || item.petName).filter(Boolean))];
      petBonus.textContent = hasPets
        ? `宠物侦察被动：${labels.slice(0, 2).join("、") || "已生效"}`
        : "宠物侦察被动：未配置队长宠物";
      petBonus.dataset.active = hasPets ? "true" : "false";
      petBonus.title = contributors.length > 0
        ? contributors.map((item) => `${item.petName || "宠物"}：${item.detail || item.label || "搜索加成"}`).join("；")
        : "宠物会自动提供搜索加成，不再占用搜索选项。";
    }
  }

  getTip(state) {
    if (state.settlement) {
      const bondSummary = this.formatPetBondSummary(state.settlement.petBond);
      const bondSuffix = bondSummary
        ? `；宠物成长：${bondSummary}`
        : "";
      const rubySuffix = state.settlement.rubyReward > 0
        ? `、${state.settlement.rubyReward} 红宝石`
        : "";
      const loadoutLost = state.settlement.metaSettlement?.loadoutLost || [];
      const loadoutSuffix = loadoutLost.length > 0
        ? `；遗失配装：${loadoutLost.map((item) => item.name || "未命名装备").join("、")}`
        : "";
      return state.settlement.extracted
        ? `撤离成功：获得 ${state.settlement.coins} 金币、${state.settlement.crystals} 水晶、${state.settlement.exp} 经验${rubySuffix}${bondSuffix}。`
        : `本局结束：安全袋带回 ${state.settlement.insuredLootRecovered || 0} 件，未保护战利品遗失 ${state.settlement.lootLost} 件${loadoutSuffix}${bondSuffix}。`;
    }
    const tips = {
      briefing: "开始后用 WASD 或方向键探索 3000×1900 的远征地图。",
      route: state.interaction.location
        ? `${state.interaction.label}：按 E 或点击右下角交互键。`
        : (state.extraction.availability?.emergency?.canExtract
          ? "入口可随时止损；应急出口更近，但会消耗补给并暴露位置。"
          : "入口始终可以撤离；继续搜索前先判断弹药、生命和背包价值。"),
      search: state.activeSearch || state.searchState
        ? "搜索会持续一段时间；移动、受伤或点击取消都会中断，完成前不会获得战利品。"
        : "快速拿取风险最低；彻底搜刮收益更高，队长宠物的侦察效果会自动生效。",
      camp: "休整消耗 1 份补给并恢复 42% 生命、降低威胁；直接离开可保留补给并获得下一战隐蔽先手。",
      combat: "WASD 移动，鼠标瞄准并按住射击；R 换弹，4 使用补给，Q 队伍技。可以脱战，不必清空地图。",
      extracting: state.extraction.inZone
        ? `留在信标范围内守住 ${state.extraction.remainingSeconds} 秒。`
        : `已离开信标范围；撤离进度已暂停，返回信标后继续，增援仍会持续抵达。`,
      "extraction-ready": "最终区域已经清理：可返回西侧入口低压撤离，或前往深区应急点以补给换取更短路程。",
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
    const bondSummary = this.formatPetBondSummary(settlement.petBond);
    const bondMessage = bondSummary
      ? `，${bondSummary}`
      : "";
    this.uiSystem?.showToast(
      settlement.extracted
        ? `撤离成功，背包奖励已入库${bondMessage}`
        : `远征结束，已结算安全袋与战败结果${bondMessage}`,
      settlement.extracted ? "success" : "info"
    );
  }

  formatPetBondSummary(petBond = null) {
    if (!Array.isArray(petBond?.pets) || petBond.pets.length === 0) return "";
    return petBond.pets.map((pet) => (
      `${pet.petName} 经验 +${pet.experienceGain || 0}${pet.levelsGained > 0 ? `（升 ${pet.levelsGained} 级）` : ""}、${pet.gain > 0 ? `羁绊 +${pet.gain}` : "羁绊已满"}`
    )).join("、");
  }

  escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    }[character]));
  }
}
