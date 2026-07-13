import { ACHIEVEMENT_CATEGORIES } from "../modules/achievement-config.js?v=achievement-v2-20260714a";

/**
 * Owns the milestone modal and HUD feedback. Achievement definitions,
 * completion latching, rewards, and persistence data live in AchievementSystem.
 */
export class AchievementController {
  constructor({
    achievementSystem,
    saveSystem,
    uiSystem,
    modalFocusManager,
    getContext = () => ({}),
    escapeHTML = (value) => String(value ?? ""),
    formatNumber = (value) => String(Math.floor(Number(value) || 0)),
    onBeforeOpen = () => {},
    onRewardClaimed = () => {},
  } = {}) {
    this.achievementSystem = achievementSystem;
    this.saveSystem = saveSystem;
    this.uiSystem = uiSystem;
    this.modalFocusManager = modalFocusManager;
    this.getContext = getContext;
    this.escapeHTML = escapeHTML;
    this.formatNumber = formatNumber;
    this.onBeforeOpen = onBeforeOpen;
    this.onRewardClaimed = onRewardClaimed;
    this.activeTab = "all";
  }

  open(activeTab = this.activeTab) {
    this.onBeforeOpen();
    this.activeTab = this.isKnownCategory(activeTab) ? activeTab : "all";
    this.refreshProgress({ announce: false });
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
    let modal = document.getElementById("achievement-modal");
    if (!modal) {
      modal = this.createModal();
      document.body.appendChild(modal);
      this.modalFocusManager?.activate(modal, ".achievement-close-btn");
    }
    this.renderView(modal);
    this.updateBadge();
  }

  createModal() {
    const modal = document.createElement("div");
    modal.id = "achievement-modal";
    modal.className = "achievement-modal-overlay show";
    modal.innerHTML = `
      <div class="achievement-modal" role="dialog" aria-modal="true" aria-labelledby="achievement-modal-title">
        <div class="achievement-header">
          <div>
            <h2 id="achievement-modal-title">里程碑</h2>
            <p class="achievement-header-summary" id="achievement-header-summary"></p>
          </div>
          <button class="achievement-close-btn" type="button" aria-label="关闭里程碑页面" data-achievement-close>×</button>
        </div>
        <div class="achievement-tabs" role="tablist" aria-label="里程碑分类">
          ${ACHIEVEMENT_CATEGORIES.map((category) =>
            this.renderTabButton(category.id, category.label)
          ).join("")}
        </div>
        <div class="achievement-toolbar">
          <span id="achievement-overview" role="status" aria-live="polite"></span>
          <button class="achievement-claim-all-btn" type="button" data-achievement-claim-all>全部领取</button>
        </div>
        <div class="achievement-content" id="achievement-panel" role="tabpanel" aria-labelledby="achievement-tab-all"></div>
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

      if (target.closest("[data-achievement-claim-all]")) {
        void this.claimAllRewards();
        return;
      }

      const claimButton = target.closest("[data-achievement-claim]");
      if (claimButton) {
        void this.claimReward(claimButton.dataset.achievementClaim);
        return;
      }

      const tabButton = target.closest("[data-achievement-tab]");
      if (tabButton) {
        this.selectTab(tabButton.dataset.achievementTab, { focus: true });
      }
    });

    modal.addEventListener("keydown", (event) => {
      const tabButton =
        event.target instanceof Element
          ? event.target.closest("[data-achievement-tab]")
          : null;
      if (!tabButton) return;

      const tabs = ACHIEVEMENT_CATEGORIES.map((category) => category.id);
      const currentIndex = tabs.indexOf(tabButton.dataset.achievementTab);
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
      if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex === currentIndex) return;

      event.preventDefault();
      this.selectTab(tabs[nextIndex], { focus: true });
    });

    return modal;
  }

  renderTabButton(tab, label) {
    return `
      <button class="achievement-tab" id="achievement-tab-${this.escapeHTML(
        tab
      )}" type="button" role="tab" aria-controls="achievement-panel" aria-selected="false" tabindex="-1" data-achievement-tab="${this.escapeHTML(
        tab
      )}">${this.escapeHTML(label)}</button>
    `;
  }

  selectTab(tab, { focus = false } = {}) {
    if (!this.isKnownCategory(tab)) return;
    this.activeTab = tab;
    const modal = document.getElementById("achievement-modal");
    if (!modal) return;
    this.renderView(modal);
    if (focus) {
      modal
        .querySelector(`[data-achievement-tab="${tab}"]`)
        ?.focus({ preventScroll: true });
    }
  }

  renderView(modal = document.getElementById("achievement-modal")) {
    if (!modal || !this.achievementSystem) return;
    const content = modal.querySelector(".achievement-content");
    const previousScrollTop = content?.scrollTop || 0;
    const focusedClaimId =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.achievementClaim
        : null;

    modal.querySelectorAll("[data-achievement-tab]").forEach((button) => {
      const selected = button.dataset.achievementTab === this.activeTab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.setAttribute("tabindex", selected ? "0" : "-1");
    });

    const panel = modal.querySelector("#achievement-panel");
    if (panel) {
      panel.setAttribute("aria-labelledby", `achievement-tab-${this.activeTab}`);
      panel.innerHTML = this.renderContent();
      panel.scrollTop = previousScrollTop;
    }

    const summary = this.achievementSystem.getSummary();
    const summaryElement = modal.querySelector("#achievement-header-summary");
    if (summaryElement) {
      summaryElement.textContent = `已完成 ${summary.completed} / ${summary.total}`;
    }
    const overview = modal.querySelector("#achievement-overview");
    if (overview) {
      overview.textContent = summary.claimable > 0
        ? `${summary.claimable} 项奖励等待领取`
        : "所有已达成奖励均已领取";
    }
    const claimAllButton = modal.querySelector("[data-achievement-claim-all]");
    if (claimAllButton) {
      claimAllButton.disabled = summary.claimable === 0;
      claimAllButton.textContent = summary.claimable > 0
        ? `全部领取（${summary.claimable}）`
        : "全部领取";
    }

    if (focusedClaimId) {
      modal
        .querySelector(`[data-achievement-claim="${focusedClaimId}"]`)
        ?.focus({ preventScroll: true });
    }
  }

  renderContent() {
    const items = this.achievementSystem?.getItems(this.activeTab) || [];
    if (items.length === 0) return `<div class="modal-empty">暂无里程碑</div>`;
    return items.map((item) => this.renderItem(item)).join("");
  }

  renderItem(item) {
    const current = Math.max(0, Number(item.current) || 0);
    const target = Math.max(1, Number(item.target) || 1);
    const displayedCurrent = Math.min(current, target);
    const percent = Math.min(100, Math.round((current / target) * 100));
    const status = item.claimed
      ? "已领取"
      : item.claimable
        ? "可领取"
        : "进行中";
    const categoryLabel =
      ACHIEVEMENT_CATEGORIES.find((category) => category.id === item.category)
        ?.label || "里程碑";

    return `
      <article class="achievement-item ${item.completed ? "completed" : ""} ${
        item.claimed ? "claimed" : ""
      }" data-achievement-id="${this.escapeHTML(item.id)}" data-achievement-category="${this.escapeHTML(
        item.category
      )}">
        <div class="achievement-icon" aria-hidden="true">${this.escapeHTML(item.icon)}</div>
        <div class="achievement-info">
          <div class="achievement-title-row">
            <span class="achievement-title">${this.escapeHTML(item.title)}</span>
            <span class="achievement-category">${this.escapeHTML(categoryLabel)}</span>
          </div>
          <div class="achievement-desc">${this.escapeHTML(item.desc)}</div>
          <div class="achievement-progress" role="progressbar" aria-label="${this.escapeHTML(
            item.title
          )}进度" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${displayedCurrent}">
            <div class="achievement-progress-bar ${item.completed ? "complete" : ""}" style="width: ${percent}%"></div>
          </div>
          <div class="achievement-progress-text">
            ${this.formatNumber(displayedCurrent)} / ${this.formatNumber(target)}
            ${
              current > target
                ? `<span class="achievement-overflow">累计 ${this.formatNumber(current)}</span>`
                : ""
            }
          </div>
        </div>
        <div class="achievement-reward">
          <span>${this.escapeHTML(this.formatReward(item.reward))}</span>
          <span class="achievement-status ${item.claimable ? "is-complete" : ""}">${this.escapeHTML(
            status
          )}</span>
          <button class="achievement-claim-btn" type="button" data-achievement-claim="${this.escapeHTML(
            item.id
          )}" ${item.claimable ? "" : "disabled"}>${item.claimed ? "已领取" : "领取"}</button>
        </div>
      </article>
    `;
  }

  refreshProgress({ announce = true } = {}) {
    return this.achievementSystem?.updateProgress(this.getContext(), {
      notify: true,
      announce,
    });
  }

  handleSystemChange(event = {}) {
    this.updateBadge(event.summary);
    if (document.getElementById("achievement-modal")) this.renderView();

    if (event.type === "progress" && event.newCompletions?.length > 0) {
      if (event.announce) {
        const titles = event.newCompletions.map((item) => item.title).join("、");
        this.uiSystem?.showToast(`里程碑达成：${titles}`, "success");
      }
      void this.saveSystem?.saveGame(1);
    }
  }

  updateBadge(summary = this.achievementSystem?.getSummary()) {
    const trigger = document.querySelector('.nav-btn[data-tab="achievement"]');
    const badge = document.getElementById("achievement-claimable-badge");
    if (!trigger || !badge || !summary) return;

    const count = Math.max(0, Number(summary.claimable) || 0);
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? "99+" : String(count);
    trigger.setAttribute(
      "aria-label",
      count > 0 ? `成就，${count} 项奖励可领取` : "成就"
    );
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
        .join(" / ") || "纪念奖励"
    );
  }

  async claimReward(id) {
    this.refreshProgress({ announce: false });
    const result = this.achievementSystem?.claimReward(id);
    if (!result?.success) {
      const messages = {
        not_found: "里程碑不存在",
        incomplete: "里程碑尚未达成",
        claimed: "奖励已领取",
      };
      this.uiSystem?.showToast(messages[result?.reason] || "无法领取奖励", "info");
      return result;
    }

    this.onRewardClaimed();
    const saved = (await this.saveSystem?.saveGame(1)) ?? true;
    const rewardText = this.formatReward(result.reward);
    this.uiSystem?.showToast(
      saved ? `领取奖励：${rewardText}` : `已领取 ${rewardText}，但自动保存失败`,
      saved ? "success" : "warning"
    );
    return result;
  }

  async claimAllRewards() {
    this.refreshProgress({ announce: false });
    const result = this.achievementSystem?.claimAllRewards();
    if (!result?.success) {
      this.uiSystem?.showToast("暂无可领取奖励", "info");
      return result;
    }

    this.onRewardClaimed();
    const saved = (await this.saveSystem?.saveGame(1)) ?? true;
    const rewardText = this.formatReward(result.reward);
    this.uiSystem?.showToast(
      saved
        ? `已领取 ${result.claimedItems.length} 项奖励：${rewardText}`
        : `奖励已领取，但自动保存失败`,
      saved ? "success" : "warning"
    );
    return result;
  }

  isKnownCategory(category) {
    return ACHIEVEMENT_CATEGORIES.some((entry) => entry.id === category);
  }
}
