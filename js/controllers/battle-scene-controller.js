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
    getCurrentScene,
  }) {
    this.canvas = canvas;
    this.combatSystem = combatSystem;
    this.expeditionMetaSystem = expeditionMetaSystem;
    this.resourceSystem = resourceSystem;
    this.playerSystem = playerSystem;
    this.saveSystem = saveSystem;
    this.uiSystem = uiSystem;
    this.getCurrentScene = getCurrentScene;
    this.lastSettlementKey = null;
    this.abandonArmedUntil = 0;
    this.pressedMovementKeys = new Set();
    this.pointerDirections = new Map();
    this.firingPointerIds = new Set();
    this.lastWorldRevision = -1;
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
      ["battle-interact-btn", () => this.combatSystem.interactWithNearbyLocation()],
      ["battle-reload-btn", () => this.combatSystem.reloadWeapon?.()],
      ["battle-cancel-search-btn", () => this.combatSystem.cancelSearch?.("manual")],
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
      this.handleBattleActionResult(this.combatSystem.trackLocation(button.dataset.routeId));
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
      const button = event.target.closest("[data-loot-insure]");
      if (!button) return;
      const result = this.combatSystem.toggleLootInsurance?.(button.dataset.lootInsure);
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
      const button = event.target.closest("[data-loadout-unequip]");
      if (!button) return;
      this.handleMetaActionResult(this.expeditionMetaSystem?.unequipItem?.(
        button.dataset.loadoutUnequip,
        { consumableIndex: Number(button.dataset.consumableIndex) || 0 }
      ));
    }, { signal });

    document.getElementById("battle-contract-list")?.addEventListener("click", (event) => {
      const acceptButton = event.target.closest("[data-contract-accept]");
      const turnInButton = event.target.closest("[data-contract-turn-in]");
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
      }
      this.handleMetaActionResult(result);
    }, { signal });

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
      if (event.code === "KeyR" && !event.repeat) {
        event.preventDefault();
        this.handleBattleActionResult(this.combatSystem.reloadWeapon?.());
        return;
      }
      if (/^Digit[123]$/.test(event.code) && !event.repeat) {
        event.preventDefault();
        const weaponIndex = Number(event.code.slice(-1)) - 1;
        this.handleBattleActionResult(this.combatSystem.switchWeapon?.(weaponIndex));
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

    document.querySelectorAll("[data-move-direction]").forEach((button) => {
      const release = (event) => {
        this.pointerDirections.delete(event.pointerId);
        this.applyMovementInput();
      };
      button.addEventListener("pointerdown", (event) => {
        if (this.getCurrentScene() !== "dungeon") return;
        event.preventDefault();
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
        this.pointerDirections.set(event.pointerId, button.dataset.moveDirection);
        button.setAttribute("aria-pressed", "true");
        this.applyMovementInput();
      }, { signal });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
        button.addEventListener(type, (event) => {
          release(event);
          if (![...this.pointerDirections.values()].includes(button.dataset.moveDirection)) {
            button.setAttribute("aria-pressed", "false");
          }
        }, { signal });
      });
    });
  }

  applyMovementInput() {
    let x = 0;
    let y = 0;
    const directions = new Set(this.pointerDirections.values());
    if (this.pressedMovementKeys.has("KeyA") || this.pressedMovementKeys.has("ArrowLeft") || directions.has("left")) x -= 1;
    if (this.pressedMovementKeys.has("KeyD") || this.pressedMovementKeys.has("ArrowRight") || directions.has("right")) x += 1;
    if (this.pressedMovementKeys.has("KeyW") || this.pressedMovementKeys.has("ArrowUp") || directions.has("up")) y -= 1;
    if (this.pressedMovementKeys.has("KeyS") || this.pressedMovementKeys.has("ArrowDown") || directions.has("down")) y += 1;
    this.combatSystem.setMovementInput(x, y);
  }

  hasOpenModal() {
    return Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'))
      .some((dialog) => dialog.getClientRects().length > 0);
  }

  clearMovementInput() {
    this.pressedMovementKeys.clear();
    this.pointerDirections.clear();
    document.querySelectorAll("[data-move-direction]").forEach((button) => {
      button.setAttribute("aria-pressed", "false");
    });
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

  setSceneActive(active) {
    if (!active) this.clearControlInput();
  }

  destroy() {
    this.clearControlInput();
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
    setText("battle-depth-display", `${state.world.explorationPercent}%`);
    setText("battle-hp-display", `${state.hp}/${state.maxHp}`);
    setText("battle-threat-display", `${state.threat}%`);
    setText("battle-bag-display", `${state.backpackCount}/${state.backpackCapacity}`);
    setText(
      "battle-guard-display",
      `${Math.ceil(state.petGuard?.hp || 0)}/${Math.ceil(state.petGuard?.maxHp || 0)}${state.petGuard?.rescueReady ? " +救援" : ""}`
    );
    setText("battle-enemy-display", state.activeEnemies + state.queuedEnemies);
    setText("battle-rooms-display", `${state.depth} / ${state.maxDepth}`);
    setText("battle-extractions-display", state.meta.extractions);
    setText("battle-kills-display", state.rewards.kills);
    setText("battle-reward-coins", formatNumber(state.pendingValue));
    setText("battle-supplies-display", `补给 ${state.supplies}`);
    setText("battle-event-feed", state.lastAction);
    setText(
      "battle-location-display",
      state.world.navigationTarget
        ? `${state.world.navigationTarget.name} · ${state.world.navigationTarget.distance}m`
        : "自由探索"
    );
    setText("battle-interact-label", state.interaction.label);
    setText("battle-interact-detail", state.interaction.detail);
    setText(
      "battle-nearby-prompt",
      state.interaction.location ? `${state.interaction.label} · E 交互` : ""
    );

    const battleScene = document.getElementById("battle-scene");
    if (battleScene) {
      battleScene.dataset.phase = state.phase;
      battleScene.dataset.moving = state.world.player.moving ? "true" : "false";
    }

    const status = document.querySelector(".extraction-run-status");
    if (status) status.dataset.threat = state.threat >= 70 ? "high" : state.threat >= 40 ? "medium" : "low";

    this.renderCurrentRoom(state);
    this.renderRouteChoices(state.routeChoices, state.world, state);
    this.renderLoot(state.backpack, state);
    this.renderLootChoice(state.pendingLootChoice);
    this.renderRiskPreview(state, formatNumber);
    this.renderPetSkills(state.petSkills, state.isWaveActive);
    this.renderSearchBonuses(
      state.searchBonuses,
      state.petSkills.length > 0,
      state.searchProfiles || state.run?.searchProfiles || {},
      state
    );
    this.renderWeaponState(state.weapon || this.combatSystem.getWeaponState?.(), state);
    this.renderSearchProgress(state.activeSearch || state.searchState || null);
    this.renderMetaState(state.raidMeta || this.expeditionMetaSystem?.getState?.(), state);

    setHidden("battle-route-panel", !state.actions.canTrackMap);
    setHidden("battle-search-actions", !state.actions.canSearch);
    setHidden("battle-camp-actions", !state.actions.canRest);
    setHidden("battle-use-supply-btn", !state.actions.canHeal);
    setHidden("battle-extract-btn", !state.actions.canExtract);
    setHidden("battle-abandon-btn", !state.actions.canAbandon);
    setHidden("battle-restart-btn", !(state.phase === "extracted" || state.phase === "defeat"));
    setHidden("battle-start-expedition-btn", state.phase !== "briefing");
    setHidden("battle-world-controls", !state.actions.canAbandon);
    setHidden("battle-weapon-hud", !state.actions.canAbandon);
    setHidden("battle-nearby-prompt", !state.interaction.location);

    const startButton = document.getElementById("battle-start-expedition-btn");
    if (startButton) startButton.disabled = !state.actions.canStart;
    const healButton = document.getElementById("battle-use-supply-btn");
    if (healButton) healButton.disabled = !state.actions.canHeal;
    const extractButton = document.getElementById("battle-extract-btn");
    if (extractButton) extractButton.disabled = !state.actions.canExtract;
    const interactButton = document.getElementById("battle-interact-btn");
    if (interactButton) interactButton.disabled = !state.actions.canInteract;
    const reloadButton = document.getElementById("battle-reload-btn");
    const fireButton = document.getElementById("battle-fire-btn");
    if (reloadButton) reloadButton.disabled = !state.actions.canAbandon;
    if (fireButton) fireButton.disabled = !state.actions.canAbandon;
    document.querySelectorAll("[data-move-direction]").forEach((button) => {
      button.disabled = !state.actions.canMove;
    });
    setText(
      "battle-extract-label",
      state.extraction?.nearType === "emergency"
        ? "消耗 1 补给 · 高压守点"
        : state.threat >= 70 ? "高危守点" : state.depth >= state.maxDepth ? "最终撤离" : "低压返程撤离"
    );

    setText("battle-command-tip", this.getTip(state));
    this.handleSettlement(state);
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
      slotContainer.innerHTML = weaponState.weapons.map((weapon, index) => `
        <button type="button" class="expedition-weapon-slot" data-weapon-id="${this.escapeHTML(weapon.id)}"
          aria-pressed="${weapon.active ? "true" : "false"}"
          ${weapon.available !== false && (state.actions?.canStart || state.actions?.canAbandon) ? "" : "disabled"}>
          ${index + 1} · ${this.escapeHTML(weapon.name)}
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
      quick: "快速搜索",
      thorough: "仔细搜刮",
      pet: "宠物侦察",
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

    const loadout = metaState.loadout || {};
    const consumables = (loadout.consumables || []).filter(Boolean).length;
    const canManage = Boolean(state.actions?.canStart && !metaState.activeRaid);
    setText(
      "battle-loadout-summary",
      `${loadout.mainWeapon?.name || "制式训练武器组"} · ${loadout.armor?.name || "无护甲"} · ${loadout.petLinker?.name || "无宠物链接器"} · 消耗品 ${consumables}/4。出发后锁定配装；基础武器不会遗失。`
    );

    const equippedItems = document.getElementById("battle-equipped-items");
    if (equippedItems) {
      const activeWeapon = state.weapon?.weapons?.find(weapon => weapon.id === loadout.mainWeapon?.combatWeaponId);
      const cards = [
        `<div class="expedition-equipped-item permanent"><span>主武器</span><b>${this.escapeHTML(activeWeapon?.name || loadout.mainWeapon?.name || "制式武器")}</b></div>`,
        `<div class="expedition-equipped-item"><span>护甲</span><b>${this.escapeHTML(loadout.armor?.name || "空")}</b>${loadout.armor ? `<button type="button" data-loadout-unequip="armor" ${canManage ? "" : "disabled"}>卸下</button>` : ""}</div>`,
        `<div class="expedition-equipped-item"><span>宠物链接</span><b>${this.escapeHTML(loadout.petLinker?.name || "空")}</b>${loadout.petLinker ? `<button type="button" data-loadout-unequip="petLinker" ${canManage ? "" : "disabled"}>卸下</button>` : ""}</div>`,
        ...(loadout.consumables || []).map((item, index) => `
          <div class="expedition-equipped-item compact"><span>补给 ${index + 1}</span><b>${this.escapeHTML(item?.name || "空")}${item ? ` ×${Math.max(1, Number(item.quantity) || 1)}` : ""}</b>
            ${item ? `<button type="button" data-loadout-unequip="consumable" data-consumable-index="${index}" ${canManage ? "" : "disabled"}>卸下</button>` : ""}
          </div>
        `),
      ];
      equippedItems.innerHTML = cards.join("");
    }

    const stashList = document.getElementById("battle-stash-list");
    if (stashList) {
      const items = Array.isArray(metaState.warehouse) ? metaState.warehouse : [];
      const rows = items.map(item => {
        const equipSlot = this.expeditionMetaSystem?.expectedEquipSlot?.(item);
        return `
          <div class="expedition-stash-item rarity-${this.escapeHTML(item.rarity || "common")}">
            <span title="${this.escapeHTML(item.use || item.description || "")}">${this.escapeHTML(item.name)} ×${Math.max(1, Number(item.quantity) || 1)}</span>
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
      const activeRows = active.map(contract => `
        <article class="expedition-contract-item">
          <strong>${contract.category === "main" ? "主线" : "支线"} · ${this.escapeHTML(contract.title)}</strong>
          <button type="button" data-contract-turn-in="${this.escapeHTML(contract.contractId)}"
            ${contract.status === "ready" && canManage ? "" : "disabled"}>${contract.status === "ready" ? "交付" : `${contract.progress}/${contract.target}`}</button>
          <small>${this.escapeHTML(contract.description)}</small>
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
            <small>${this.escapeHTML(offer.description)}</small>
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
      briefing: ["行动简报", "未知禁区", "撤离后才会结算全部收益", "选择路线，搜索物资，击败阻拦者，并判断何时收手。"],
      route: [
        "大地图探索",
        state.interaction.location?.name || state.world.navigationTarget?.name || "荒野行进",
        state.interaction.location ? "已进入交互范围" : state.extraction.unlocked ? "入口撤离点已解锁" : "继续探索以定位撤离点",
        state.interaction.location
          ? state.interaction.location.description
          : "使用 WASD、方向键或屏幕方向键移动；右侧地点卡用于切换追踪目标。"
      ],
      "extraction-ready": ["最终目标", "选择撤离路线", "入口返程或深区应急撤离", "入口信标不耗补给但要原路折返；深区应急点耗 1 补给，守点更久、增援更密。"],
      extracted: ["远征结算", "撤离成功", "战利品已入库", "本局携带的金币、水晶和经验已经发放。"],
      defeat: ["远征结算", "撤离失败", "未保险战利品已遗失", "保险格物品与少量战斗收益会保留，主动放弃的保底低于战败。"],
    };
    const summary = summaries[state.phase] || ["行动状态", state.phaseLabel, "远征进行中", state.lastAction];
    setText("battle-room-kicker", summary[0]);
    setText("battle-room-name", summary[1]);
    setText("battle-room-risk", summary[2]);
    setText("battle-room-desc", summary[3]);
  }

  renderRouteChoices(choices = [], world = {}, state = {}) {
    const list = document.getElementById("battle-route-list");
    if (!list) return;
    const buttons = choices.map((node) => {
      const location = world.locations?.find((item) => item.nodeId === node.id);
      const isTracking = world.navigationTarget?.nodeId === node.id;
      const isKnown = !location || Boolean(location.known || location.discovered);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `expedition-route-choice route-${isKnown ? node.type : "unknown"}${isTracking ? " tracking" : ""}`;
      button.dataset.routeId = node.id;
      button.setAttribute("aria-pressed", isTracking ? "true" : "false");

      const icon = document.createElement("span");
      icon.className = "route-choice-icon";
      icon.textContent = isKnown ? (node.icon || "◇") : "?";
      const copy = document.createElement("span");
      copy.className = "route-choice-copy";
      const name = document.createElement("strong");
      name.textContent = isKnown ? node.name : "未知信号";
      const danger = document.createElement("small");
      const distance = location
        ? Math.round(Math.hypot(location.x - world.player.x, location.y - world.player.y))
        : null;
      danger.textContent = `${isKnown ? node.danger : "风险待侦察"}${distance === null ? "" : ` · ${distance}m`} · ${isTracking ? "追踪中" : "点击追踪"}`;
      copy.append(name, danger);
      button.append(icon, copy);
      return button;
    });
    const discoveredEvents = (world.locations || []).filter((location) => (
      location.kind === "world-event" &&
      location.state === "available" &&
      (location.known || location.discovered)
    ));
    discoveredEvents.forEach((eventLocation) => {
      const isTracking = world.navigationTarget?.id === eventLocation.id;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `expedition-route-choice route-event${isTracking ? " tracking" : ""}`;
      button.dataset.routeId = eventLocation.id;
      button.setAttribute("aria-pressed", isTracking ? "true" : "false");
      const icon = document.createElement("span");
      icon.className = "route-choice-icon";
      icon.textContent = eventLocation.icon || "!";
      const copy = document.createElement("span");
      copy.className = "route-choice-copy";
      const name = document.createElement("strong");
      name.textContent = eventLocation.name;
      const detail = document.createElement("small");
      const distance = Math.round(Math.hypot(
        eventLocation.x - world.player.x,
        eventLocation.y - world.player.y
      ));
      detail.textContent = `可选支线 · ${distance}m · ${isTracking ? "追踪中" : "点击追踪"}`;
      copy.append(name, detail);
      button.append(icon, copy);
      buttons.push(button);
    });
    const extractionLocations = (world.extractionLocations || world.locations || [])
      .filter((location) => location.kind === "extraction" && ["unlocked", "engaged"].includes(location.state));
    extractionLocations.forEach((extraction) => {
      const isTracking = world.navigationTarget?.id === extraction.id;
      const extractionType = extraction.extractionType || "entry";
      const rule = state.extraction?.rules?.[extractionType] || world.extractionRules?.[extractionType] || {};
      const button = document.createElement("button");
      button.type = "button";
      button.className = `expedition-route-choice route-extraction${isTracking ? " tracking" : ""}`;
      button.dataset.routeId = extraction.id;
      button.setAttribute("aria-pressed", isTracking ? "true" : "false");

      const icon = document.createElement("span");
      icon.className = "route-choice-icon";
      icon.textContent = extraction.icon || "⇥";
      const copy = document.createElement("span");
      copy.className = "route-choice-copy";
      const name = document.createElement("strong");
      name.textContent = extraction.name;
      const detail = document.createElement("small");
      const distance = Math.round(Math.hypot(
        extraction.x - world.player.x,
        extraction.y - world.player.y
      ));
      const cost = Number(rule.supplyCost) > 0 ? ` · 补给 -${rule.supplyCost}` : "";
      detail.textContent = `${extractionType === "emergency" ? "应急撤离" : "入口撤离"}${cost} · ${distance}m · ${isTracking ? "追踪中" : "点击追踪"}`;
      copy.append(name, detail);
      button.append(icon, copy);
      buttons.push(button);
    });
    list.replaceChildren(...buttons);
  }

  renderLoot(backpack = [], state = {}) {
    const list = document.getElementById("battle-loot-list");
    if (!list) return;
    const insuredCount = backpack.filter((loot) => loot.insured).length;
    const insuranceCapacity = Math.max(0, Number(state.insuredSlotCount) || 0);
    const insuranceDisplay = document.getElementById("battle-insurance-display");
    if (insuranceDisplay) {
      insuranceDisplay.textContent = `保险 ${insuredCount}/${insuranceCapacity}`;
      insuranceDisplay.title = "远征失败时，保险格内的战利品仍可带回";
    }
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
      name.textContent = `${loot.icon || "◇"} ${loot.name}`;
      const use = document.createElement("small");
      use.textContent = loot.use || `${loot.rarityLabel || "普通"}战利品`;
      copy.append(name, use);
      const value = document.createElement("b");
      const valueParts = [];
      if (loot.coins > 0) valueParts.push(`${loot.coins}¤`);
      if (loot.crystals > 0) valueParts.push(`${loot.crystals}◆`);
      value.textContent = valueParts.join(" · ") || `${loot.score || 0}价值`;
      const insureButton = document.createElement("button");
      insureButton.type = "button";
      insureButton.className = "expedition-loot-insure";
      insureButton.dataset.lootInsure = loot.id;
      insureButton.setAttribute("aria-pressed", loot.insured ? "true" : "false");
      insureButton.textContent = loot.insured ? "已保险" : "保险";
      insureButton.title = loot.insured ? "点击解除保险" : "失败时优先带回此物品";
      item.append(copy, value, insureButton);
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
      name.textContent = `${incoming.icon || "◇"} ${incoming.name || "新战利品"}${value}`;
    }
    const detail = document.getElementById("battle-loot-choice-detail");
    if (detail) detail.textContent = incoming.use || "选择一件未保险物品替换，或放弃新战利品。";

    const options = Array.isArray(choice.replaceOptions) ? choice.replaceOptions : [];
    const buttons = options.map((loot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.lootAction = "replace";
      button.dataset.lootItemId = loot.id;
      button.disabled = Boolean(loot.insured);
      button.textContent = loot.insured
        ? `🔒 ${loot.name} · 已保险，无法替换`
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
      nextThreshold === null ? `已达最高档${state.overpressure ? ` · 超限 ${state.overpressure}` : ""}` : `${nextThreshold}（还差 ${threatToNext}）`
    );

    const pressure = state.returnPressure;
    const pressureValue = typeof pressure === "number"
      ? pressure
      : Number(pressure?.value ?? pressure?.current ?? pressure?.level ?? 0);
    const pressureLabel = pressure?.label || (pressureValue > 0 ? `${Math.round(pressureValue)}%` : "未启动");
    setText("battle-return-pressure", pressureLabel);

    const rewards = state.rewards || {};
    const backpackRewards = state.backpackRewards || {};
    const successCoins = Math.max(0, Number(rewards.coins || 0));
    const backpackValue = Math.max(0, Number(backpackRewards.score || 0));
    const explicitlyInsured = (state.backpack || []).filter((loot) => loot.insured);
    const insuredValue = explicitlyInsured.reduce((total, loot) => total + (loot.score || 0), 0);
    const failureCoins = Math.floor(Number(rewards.coins || 0) * 0.3);
    setText("battle-success-preview", `现金 ${formatNumber(successCoins)} / 入库估值 ${formatNumber(backpackValue)}`);
    setText("battle-failure-preview", `现金 ${formatNumber(failureCoins)} / 保险 ${explicitlyInsured.length} 件（${formatNumber(insuredValue)}）`);
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

  renderSearchBonuses(searchBonuses = {}, hasPets = false, profiles = {}, state = {}) {
    const fallbackProfiles = {
      quick: { name: "快速搜索", lootMin: 1, lootMax: 1, threat: 3, ambushChance: 0.04, durationSeconds: 3, supplyCost: 0, role: "低暴露、快速脱离" },
      thorough: { name: "仔细搜刮", lootMin: 2, lootMax: 3, threat: 14, ambushChance: 0.3, durationSeconds: 12, supplyCost: 1, role: "消耗补给换取最大产量" },
      pet: { name: "宠物侦察", lootMin: 2, lootMax: 2, threat: 7, ambushChance: 0.1, durationSeconds: 7, supplyCost: 0, role: "稳定品质与较低伏击率", requiresPet: true },
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
        : profile.requiresPet && !hasPets ? "需要至少上阵一只宠物" : (profile.role || "");
    });
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
      return state.settlement.extracted
        ? `撤离成功：获得 ${state.settlement.coins} 金币、${state.settlement.crystals} 水晶、${state.settlement.exp} 经验${rubySuffix}${bondSuffix}。`
        : `本局结束：保留 ${state.settlement.coins} 金币和 ${state.settlement.exp} 经验，保险带回 ${state.settlement.insuredLootRecovered || 0} 件、遗失 ${state.settlement.lootLost} 件${bondSuffix}。`;
    }
    const tips = {
      briefing: "开始后用 WASD、方向键或屏幕方向键探索 3000×1900 的远征地图。",
      route: state.interaction.location
        ? `${state.interaction.label}：按 E 或点击右下角交互键。`
        : state.extraction.unlocked
          ? (state.extraction.availability?.emergency?.canExtract
            ? "两条撤离路线均已解锁：入口不耗补给，应急点路近但守点压力更高。"
            : "入口撤离信标已解锁；可现在返程，也可继续深入以激活应急撤离点。")
          : `探索地图并清理地点；再完成 ${Math.max(0, 3 - state.depth)} 个区域即可解锁撤离信标。`,
      search: state.activeSearch || state.searchState
        ? "搜索会持续一段时间；移动、受伤或点击取消都会中断，完成前不会获得战利品。"
        : "快速搜索风险最低；仔细搜刮收益更高；宠物侦察需要上阵宠物。",
      camp: "休整消耗 1 份补给并恢复 42% 生命、降低威胁；直接离开可保留补给并获得下一战隐蔽先手。",
      combat: "WASD 移动，鼠标或触摸画布瞄准并按住射击；R 换弹，数字 1–3 切换武器，注意躲开敌方弹道。",
      extracting: state.extraction.inZone
        ? `留在信标范围内守住 ${state.extraction.remainingSeconds} 秒。`
        : `已离开信标范围；超过短暂宽限后进度会回退，增援仍会持续抵达。`,
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
        : `远征结束，已结算保底收益${bondMessage}`,
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
