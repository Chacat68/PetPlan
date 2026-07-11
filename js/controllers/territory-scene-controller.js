/**
 * Owns the territory scene grid, progression feedback, building modals, and
 * territory actions. Persistence remains delegated to TerritorySystem.
 */
export class TerritorySceneController {
  constructor({
    territorySystem,
    resourceSystem,
    uiSystem,
    escapeHTML,
    formatNumber,
    getProgressionContext,
  }) {
    this.territorySystem = territorySystem;
    this.resourceSystem = resourceSystem;
    this.uiSystem = uiSystem;
    this.escapeHTML = escapeHTML;
    this.formatNumber = formatNumber;
    this.getProgressionContext = getProgressionContext;
    this.seenUnlocks = new Set();
    this.selectedSlot = null;
    this.abortController = null;
  }

  /**
   * Render the initial grid and bind the expansion action exactly once.
   */
  bind() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    const { signal } = this.abortController;
    this.renderGrid();

    const grid = document.getElementById("territory-grid");
    grid?.addEventListener(
      "click",
      (event) => {
        const slot = event.target?.closest?.(".territory-slot");
        if (!(slot instanceof HTMLButtonElement)) return;

        const slotIndex = Number(slot.dataset.slot);
        const state = this.territorySystem.getSlotState(slotIndex);
        if (state === "empty") {
          this.openBuildModal(slotIndex);
        } else if (state === "built") {
          this.openBuildingInfoModal(slotIndex);
        }
      },
      { signal }
    );

    const expandButton = document.getElementById("expand-territory-btn");
    expandButton?.addEventListener("click", () => this.handleExpand(), {
      signal,
    });
  }

  destroy() {
    this.abortController?.abort();
    this.abortController = null;
    this.selectedSlot = null;
    document.getElementById("build-modal")?.remove();
    document.getElementById("building-info-modal")?.remove();
  }

  syncProgress({ silent = false } = {}) {
    if (!this.territorySystem) return null;

    const summary = this.territorySystem.setProgressContext(
      this.getProgressionContext()
    );
    const unlockedTypes = summary.unlockedBuildingTypes || [];

    if (silent || this.seenUnlocks.size === 0) {
      this.seenUnlocks = new Set(unlockedTypes);
      return summary;
    }

    const newlyUnlocked = unlockedTypes.filter(
      (type) => !this.seenUnlocks.has(type)
    );
    this.seenUnlocks = new Set(unlockedTypes);

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

  renderGrid() {
    const grid = document.getElementById("territory-grid");
    if (!grid || !this.territorySystem) return;

    grid.innerHTML = "";

    const maxSlots = this.territorySystem.slotConfig.maxSlots;

    for (let i = 0; i < maxSlots; i++) {
      const state = this.territorySystem.getSlotState(i);
      const building = this.territorySystem.getBuildingAt(i);
      const slot = document.createElement(state === "locked" ? "div" : "button");
      slot.className = "territory-slot";
      slot.dataset.slot = i;
      if (slot instanceof HTMLButtonElement) slot.type = "button";

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
        slot.setAttribute("aria-label", `空地块 ${i + 1}，建造建筑`);
        slot.innerHTML = `
          <div class="slot-content">
            <div class="slot-empty">+</div>
            <div class="slot-name">Build</div>
          </div>
        `;
      } else if (state === "built" && building) {
        slot.classList.add("built");
        const data = this.territorySystem.buildingData[building.type];
        slot.setAttribute(
          "aria-label",
          `${data.name}，等级 ${building.level}，查看建筑详情`
        );
        slot.innerHTML = `
          <div class="slot-content">
            <div class="slot-icon">${data.icon}</div>
            <div class="slot-name">${data.name}</div>
            <div class="slot-level">Lv.${building.level}</div>
          </div>
        `;
      }

      grid.appendChild(slot);
    }
  }

  updateDisplay() {
    if (!this.territorySystem || !this.resourceSystem) return;
    const summary =
      this.syncProgress() || this.territorySystem.getProgressSummary();

    // Collect once before updating either territory resource value.
    const collected = this.territorySystem.collectResources();
    if (collected.coins > 0 || collected.crystals > 0) {
      this.resourceSystem.updateDisplay();
    }

    const goldElement = document.getElementById("territory-gold");
    const crystalElement = document.getElementById("territory-crystal");

    if (goldElement) {
      goldElement.textContent = this.formatNumber(this.resourceSystem.coins);
    }
    if (crystalElement) {
      crystalElement.textContent = this.formatNumber(
        this.resourceSystem.crystals
      );
    }

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
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
    this.renderPulseBreakdown(summary.pulseBreakdown || []);

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
    setText("territory-production-rate", this.formatProductionRate());
    this.renderUnlockList(summary);

    const progressElement = document.getElementById("expansion-progress");
    if (progressElement) {
      progressElement.textContent = `${summary.unlockedSlots}/${summary.maxSlots}`;
    }
    const slotCountElement = document.getElementById("territory-slot-count");
    if (slotCountElement) {
      slotCountElement.textContent = `${summary.unlockedSlots}/${summary.maxSlots}`;
    }

    this.renderGrid();
  }

  renderPulseBreakdown(breakdown) {
    const container = document.getElementById("territory-pulse-breakdown");
    if (!container) return;

    const contributions = breakdown.filter(
      (contribution) => (contribution.value || 0) > 0
    );
    container.replaceChildren();

    if (contributions.length === 0) {
      container.textContent = "翻转后将显示脉冲构成";
      return;
    }

    contributions.forEach((contribution) => {
      const item = document.createElement("span");
      item.className = "territory-pulse-item is-active";
      item.textContent = `${contribution.label} +${this.formatNumber(
        contribution.value
      )}`;
      container.appendChild(item);
    });
  }

  formatProductionRate() {
    if (!this.territorySystem || !this.resourceSystem) return "0";

    let coinsPerMinute = 0;
    let crystalsPerMinute = 0;
    this.territorySystem.buildings.forEach((building) => {
      const data = this.territorySystem.buildingData[building.type];
      if (
        !data ||
        data.effects?.type !== "production" ||
        data.productionInterval <= 0
      ) {
        return;
      }

      const amountPerMinute =
        (data.effects.value * building.level * 60000) /
        data.productionInterval;
      if (data.effects.resource === "coins") {
        coinsPerMinute += amountPerMinute;
      } else if (data.effects.resource === "crystals") {
        crystalsPerMinute += amountPerMinute;
      }
    });

    const parts = [];
    if (coinsPerMinute > 0) {
      parts.push(`💰${this.formatNumber(coinsPerMinute)}`);
    }
    if (crystalsPerMinute > 0) {
      parts.push(`💎${this.formatNumber(crystalsPerMinute)}`);
    }

    return parts.join(" / ") || "0";
  }

  renderUnlockList(summary) {
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

  openBuildModal(slotIndex) {
    this.selectedSlot = slotIndex;

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

      modal.addEventListener("click", (event) => {
        if (event.target === modal) modal.classList.remove("show");
      });
    }

    const optionsElement = document.getElementById("building-options");
    optionsElement.innerHTML = "";

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
          ${cost.coins > 0 ? `💰${this.formatNumber(cost.coins)}` : ""}
          ${
            cost.crystals > 0
              ? ` 💎${this.formatNumber(cost.crystals)}`
              : ""
          }
          ${
            !unlockState.unlocked
              ? `<span class="building-lock-cost">脉冲 ${unlockState.requiredPulse}</span>`
              : ""
          }
        </div>
      `;

      option.addEventListener("click", () => this.handleBuild(type));
      optionsElement.appendChild(option);
    }

    modal.classList.add("show");
  }

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
      this.updateDisplay();
      this.resourceSystem.updateDisplay();
      document.getElementById("build-modal")?.classList.remove("show");
    } else {
      this.uiSystem.showToast(`❌ ${result.reason}`, "error");
    }
  }

  openBuildingInfoModal(slotIndex) {
    const building = this.territorySystem.getBuildingAt(slotIndex);
    if (!building) return;

    const data = this.territorySystem.buildingData[building.type];
    const canUpgrade = this.territorySystem.canUpgrade(slotIndex);
    const upgradeCost = this.territorySystem.calculateUpgradeCost(
      building.type,
      building.level
    );

    let modal = document.getElementById("building-info-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "building-info-modal";
      modal.className = "territory-modal";
      document.getElementById("territory-scene")?.appendChild(modal);
    }

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
        case "production": {
          const amount = data.effects.value * building.level;
          effectText = `每${data.productionInterval / 1000}秒产出 ${amount} ${
            data.effects.resource === "coins" ? "💰" : "💎"
          }`;
          break;
        }
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
                <span class="building-stat-value">💰${this.formatNumber(
                  upgradeCost.coins
                )} 💎${this.formatNumber(upgradeCost.crystals)}</span>
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

    modal.onclick = (event) => {
      if (event.target === modal) modal.classList.remove("show");
    };

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

  handleUpgradeBuilding(slotIndex) {
    const result = this.territorySystem.upgradeBuilding(slotIndex);

    if (result.success) {
      const data = this.territorySystem.buildingData[result.building.type];
      this.uiSystem.showToast(
        `✅ ${data.name} 升级至 Lv.${result.building.level}`,
        "success"
      );
      this.updateDisplay();
      this.resourceSystem.updateDisplay();
      document.getElementById("building-info-modal")?.classList.remove("show");
    } else {
      this.uiSystem.showToast(`❌ ${result.reason}`, "error");
    }
  }

  handleDemolish(slotIndex) {
    if (!confirm("确定要拆除这个建筑吗？将返还50%的建造成本。")) return;

    const result = this.territorySystem.demolishBuilding(slotIndex);

    if (result.success) {
      this.uiSystem.showToast(
        `✅ 拆除成功，返还 💰${result.refund.coins} 💎${result.refund.crystals}`,
        "success"
      );
      this.updateDisplay();
      this.resourceSystem.updateDisplay();
      document.getElementById("building-info-modal")?.classList.remove("show");
    } else {
      this.uiSystem.showToast(`❌ ${result.reason}`, "error");
    }
  }

  handleExpand() {
    const canExpand = this.territorySystem.canExpand();

    if (!canExpand.success) {
      this.uiSystem.showToast(`❌ ${canExpand.reason}`, "error");
      return;
    }

    const cost = this.territorySystem.getNextExpansionCost();
    if (
      !confirm(
        `确定扩张领地吗？\n费用: 💰${cost.coins} 💎${cost.crystals}`
      )
    ) {
      return;
    }

    const result = this.territorySystem.expandTerritory();

    if (result.success) {
      this.uiSystem.showToast(
        `✅ 领地扩张成功！当前地块: ${result.unlockedSlots}`,
        "success"
      );
      this.updateDisplay();
      this.resourceSystem.updateDisplay();
    }
  }
}
