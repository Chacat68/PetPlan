const PLAYER_ATTRIBUTES = [
  "attack",
  "maxHp",
  "hpRegen",
  "critDamage",
  "attackSpeed",
  "crit",
  "multiShot",
];

/**
 * Owns the player modal and attribute-upgrade interactions.
 * Cross-system UI refreshes after successful upgrades are delegated to onChanged.
 */
export class PlayerModalController {
  constructor({
    playerSystem,
    resourceSystem,
    uiSystem,
    modalFocusManager,
    onChanged,
  } = {}) {
    this.playerSystem = playerSystem;
    this.resourceSystem = resourceSystem;
    this.uiSystem = uiSystem;
    this.modalFocusManager = modalFocusManager;
    this.onChanged = typeof onChanged === "function" ? onChanged : () => {};

    this.listeners = [];
    this.isBound = false;
  }

  bindEvents() {
    if (this.isBound) return;

    this.isBound = true;

    document.querySelectorAll(".player-info, #game-player-btn").forEach((button) => {
      this.listen(button, "click", () => {
        this.open();
      });
    });

    const overlay = document.getElementById("player-modal-overlay");
    this.listen(overlay, "click", (event) => {
      const closeTrigger = event.target?.closest?.("#player-modal-close");
      if (closeTrigger || event.target === overlay) {
        this.close();
      }
    });

    document.querySelectorAll(".upgrade-btn[data-attr]").forEach((button) => {
      this.listen(button, "click", (event) => {
        this.handleUpgrade(event.currentTarget.dataset.attr);
      });
    });

  }

  destroy() {
    this.listeners.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    this.listeners = [];
    this.isBound = false;
  }

  listen(target, type, handler, options) {
    if (!target) return;

    target.addEventListener(type, handler, options);
    this.listeners.push({ target, type, handler, options });
  }

  open() {
    const overlay = document.getElementById("player-modal-overlay");
    if (!overlay) return;

    this.update();
    overlay.classList.add("active");
    this.modalFocusManager?.activate?.(overlay, "#player-modal-close");
  }

  close() {
    const overlay = document.getElementById("player-modal-overlay");
    if (!overlay) return;

    overlay.classList.remove("active");
    this.modalFocusManager?.release?.(overlay);
  }

  update() {
    const player = this.playerSystem?.player;
    if (!player || !this.resourceSystem) {
      console.warn("[Game] 玩家或资源系统尚未初始化");
      return;
    }

    this.playerSystem.updateDisplay();
    this.updateSummary();
    this.updateUpgradeControls();
  }

  updateSummary() {
    const player = this.playerSystem?.player;
    if (!player) return;

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    const formatNumber = (value) =>
      this.resourceSystem?.formatNumber?.(value) ?? String(value ?? 0);
    const currentExp = Math.max(0, Number(player.exp) || 0);
    const expToNext = Math.max(1, Number(player.expToNext) || 1);
    const expPercent = Math.min(100, (currentExp / expToNext) * 100);

    setText("player-modal-level", `Lv.${player.level || 1}`);
    setText(
      "player-modal-power",
      formatNumber(this.playerSystem.calculateTotalPower?.() || 0)
    );
    setText("player-modal-coins", formatNumber(this.resourceSystem?.coins || 0));
    setText(
      "player-modal-exp",
      `${formatNumber(currentExp)} / ${formatNumber(expToNext)}`
    );

    const expBar = document.getElementById("player-modal-exp-bar");
    if (expBar) expBar.style.width = `${expPercent}%`;
  }

  handleUpgrade(attr) {
    const result = this.playerSystem.upgradeAttribute(attr);
    if (result.success) {
      this.uiSystem?.showToast?.(result.message, "success");
      this.onChanged({ attr, result });
      this.updateSummary();
      this.updateUpgradeControls();
    } else {
      this.uiSystem?.showToast?.(result.message, "error");
    }
    return result;
  }

  updateUpgradeControls() {
    if (!this.playerSystem || !this.resourceSystem) return;

    PLAYER_ATTRIBUTES.forEach((attr) => {
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

          const card = button.closest(".player-upgrade-card");
          if (card) {
            const state = atLimit ? "max" : canAfford ? "ready" : "locked";
            card.dataset.upgradeState = state;
            const stateLabel = card.querySelector("[data-upgrade-state-label]");
            if (stateLabel) {
              stateLabel.textContent =
                state === "max" ? "已满级" : state === "locked" ? "金币不足" : "可强化";
            }
          }
        });
    });
  }

  openPlayerModal() {
    return this.open();
  }

  closePlayerModal() {
    return this.close();
  }

  updatePlayerModalInfo() {
    return this.update();
  }

  updatePlayerUpgradeControls() {
    return this.updateUpgradeControls();
  }
}
