/**
 * Owns the achievement/task modal, reward claiming, and modal-local state.
 * Cross-system refreshes stay delegated to the Game coordinator.
 */
export class AchievementController {
  constructor({
    fateCoinSystem,
    playerSystem,
    petSystem,
    territorySystem,
    resourceSystem,
    progressionSystem,
    saveSystem,
    uiSystem,
    modalFocusManager,
    escapeHTML = (value) => String(value ?? ""),
    formatNumber = (value) => String(Math.floor(Number(value) || 0)),
    onBeforeOpen = () => {},
    onRewardClaimed = () => {},
  } = {}) {
    this.fateCoinSystem = fateCoinSystem;
    this.playerSystem = playerSystem;
    this.petSystem = petSystem;
    this.territorySystem = territorySystem;
    this.resourceSystem = resourceSystem;
    this.progressionSystem = progressionSystem;
    this.saveSystem = saveSystem;
    this.uiSystem = uiSystem;
    this.modalFocusManager = modalFocusManager;
    this.escapeHTML = escapeHTML;
    this.formatNumber = formatNumber;
    this.onBeforeOpen = onBeforeOpen;
    this.onRewardClaimed = onRewardClaimed;
    this.activeTab = "achievements";
  }

  open(activeTab = this.activeTab) {
    this.onBeforeOpen();
    this.activeTab = activeTab || "achievements";
    this.render();
  }

  close() {
    const modal = document.getElementById("achievement-modal");
    if (modal) {
      modal.remove();
      this.modalFocusManager?.release(modal);
    }
  }

  render() {
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
          ${this.renderTabButton("achievements", "成就")}
          ${this.renderTabButton("tasks", "任务")}
        </div>
        <div class="achievement-content">
          ${this.renderContent()}
        </div>
      </div>
    `;

    modal.addEventListener("click", (event) => {
      const target =
        event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target) return;

      if (target === modal || target.closest("[data-achievement-close]")) {
        this.close();
        return;
      }

      const claimButton = target.closest("[data-achievement-claim]");
      if (claimButton) {
        this.claimReward(claimButton.dataset.achievementClaim);
        return;
      }

      const tabButton = target.closest("[data-achievement-tab]");
      if (tabButton) {
        this.activeTab = tabButton.dataset.achievementTab || "achievements";
        this.render();
      }
    });

    document.body.appendChild(modal);
    this.modalFocusManager?.activate(modal, ".achievement-close-btn");
  }

  renderTabButton(tab, label) {
    const active = this.activeTab === tab ? "active" : "";
    const selected = this.activeTab === tab ? "true" : "false";
    return `
      <button class="achievement-tab ${active}" type="button" role="tab" aria-selected="${selected}" data-achievement-tab="${this.escapeHTML(
      tab
    )}">
        ${this.escapeHTML(label)}
      </button>
    `;
  }

  renderContent() {
    const items = this.getDefinitions().filter(
      (item) => item.group === this.activeTab
    );

    if (items.length === 0) {
      return `<div class="modal-empty">暂无目标</div>`;
    }

    return items.map((item) => this.renderItem(item)).join("");
  }

  getDefinitions() {
    const fate = this.fateCoinSystem?.getDisplayData?.() || {};
    const totalFlips = fate.totalFlips || 0;
    const fateCoins = fate.fateCoins || 0;
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
        reward: { coins: 80 },
      },
      {
        id: "fate_100",
        group: "achievements",
        icon: "◎",
        title: "命运轮转",
        desc: "累计翻面 100 次",
        current: totalFlips,
        target: 100,
        reward: { coins: 500 },
      },
      {
        id: "table_coin_2",
        group: "achievements",
        icon: "G",
        title: "桌面扩充",
        desc: "桌面硬币达到 2 枚",
        current: fateCoins,
        target: 2,
        reward: { rubies: 20 },
      },
      {
        id: "pet_first",
        group: "achievements",
        icon: "P",
        title: "第一位伙伴",
        desc: "解锁 1 只宠物",
        current: unlockedPets,
        target: 1,
        reward: { coins: 120 },
      },
      {
        id: "pet_team",
        group: "achievements",
        icon: "P",
        title: "完整小队",
        desc: "同时上阵 3 只宠物",
        current: equippedPets,
        target: 3,
        reward: { rubies: 50 },
      },
      {
        id: "territory_first",
        group: "achievements",
        icon: "T",
        title: "落脚之地",
        desc: "建造 1 座领地建筑",
        current: buildings,
        target: 1,
        reward: { crystals: 80 },
      },
      {
        id: "hero_level_5",
        group: "achievements",
        icon: "Lv",
        title: "训练有素",
        desc: "角色等级达到 Lv.5",
        current: playerLevel,
        target: 5,
        reward: { coins: 800 },
      },
      {
        id: "task_flip_30",
        group: "tasks",
        icon: "◎",
        title: "翻面练习",
        desc: "累计翻面达到 30 次",
        current: totalFlips,
        target: 30,
        reward: { coins: 150 },
      },
      {
        id: "task_power_200",
        group: "tasks",
        icon: "ATK",
        title: "战力校准",
        desc: "战力达到 200",
        current: battlePower,
        target: 200,
        reward: { coins: 300 },
      },
      {
        id: "task_pet_level",
        group: "tasks",
        icon: "P",
        title: "伙伴训练",
        desc: "上阵宠物等级合计达到 3",
        current: petLevelTotal,
        target: 3,
        reward: { rubies: 15 },
      },
      {
        id: "task_coins_1000",
        group: "tasks",
        icon: "C",
        title: "金币储备",
        desc: "当前金币达到 1000",
        current: coins,
        target: 1000,
        reward: { crystals: 60 },
      },
      {
        id: "task_fate_coins",
        group: "tasks",
        icon: "◎",
        title: "扩充硬币",
        desc: "命运硬币达到 3 枚",
        current: fateCoins,
        target: 3,
        reward: { coins: 240 },
      },
    ];
  }

  formatReward(reward = {}) {
    const labels = [
      ["coins", "金币"],
      ["rubies", "红宝石"],
      ["crystals", "水晶"],
    ];
    return (
      labels
        .filter(([key]) => (reward[key] || 0) > 0)
        .map(([key, label]) => `${label} ${this.formatNumber(reward[key])}`)
        .join(" / ") || "无奖励"
    );
  }

  claimReward(id) {
    const item = this.getDefinitions().find(
      (definition) => definition.id === id
    );
    const { progressionSystem, resourceSystem, uiSystem } = this;
    if (!item || !resourceSystem || !progressionSystem) return;

    const complete = (item.current || 0) >= (item.target || 1);
    if (!complete) {
      uiSystem?.showToast("目标尚未完成", "info");
      return;
    }
    if (!progressionSystem.claimAchievement(id)) {
      uiSystem?.showToast("奖励已领取", "info");
      return;
    }

    const reward = item.reward || {};
    if (reward.coins) resourceSystem.addCoins(reward.coins);
    if (reward.rubies) resourceSystem.addRubies(reward.rubies);
    if (reward.crystals) resourceSystem.addCrystals(reward.crystals);

    resourceSystem.updateDisplay();
    this.onRewardClaimed();
    this.saveSystem?.saveGame(1);
    uiSystem?.showToast(`领取奖励：${this.formatReward(reward)}`, "success");
    this.render();
  }

  renderItem(item) {
    const current = Math.max(0, Number(item.current) || 0);
    const target = Math.max(1, Number(item.target) || 1);
    const percent = Math.min(100, Math.round((current / target) * 100));
    const complete = current >= target;
    const claimed =
      this.progressionSystem?.isAchievementClaimed(item.id) || false;
    const claimable = complete && !claimed;
    const status = claimed ? "已领取" : claimable ? "可领取" : "进行中";

    return `
      <article class="achievement-item ${complete ? "completed" : ""} ${
        claimed ? "claimed" : ""
      }" data-achievement-id="${this.escapeHTML(item.id)}">
        <div class="achievement-icon">${this.escapeHTML(item.icon)}</div>
        <div class="achievement-info">
          <div class="achievement-title">${this.escapeHTML(item.title)}</div>
          <div class="achievement-desc">${this.escapeHTML(item.desc)}</div>
          <div class="achievement-progress" aria-label="${this.escapeHTML(
            item.title
          )}进度">
            <div class="achievement-progress-bar ${
              complete ? "complete" : ""
            }" style="width: ${percent}%"></div>
          </div>
          <div class="achievement-progress-text">${this.formatNumber(
            current
          )} / ${this.formatNumber(target)}</div>
        </div>
        <div class="achievement-reward">
          <span>${this.escapeHTML(this.formatReward(item.reward))}</span>
          <span class="achievement-status ${
            claimable ? "is-complete" : ""
          }">${this.escapeHTML(status)}</span>
          <button class="achievement-claim-btn" type="button" data-achievement-claim="${this.escapeHTML(
            item.id
          )}" ${claimable ? "" : "disabled"}>${claimed ? "已领取" : "领取"}</button>
        </div>
      </article>
    `;
  }

}
