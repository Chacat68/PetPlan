import {
  getFateShopDisplayOrder,
  rankFateRecommendationCandidates,
} from "../modules/fate-shop-rules.js";

const FATE_SHOP_FILTERS = new Set([
  "recommended",
  "fate",
  "auto",
  "growth",
]);

const FATE_SHOP_FILTER_LABELS = {
  recommended: "推荐",
  fate: "命运",
  auto: "自动",
  growth: "成长",
};

/**
 * Owns fate-shop recommendations, filters, next-goal copy, and growth-path hints.
 * Purchase execution and fate-table animation remain with FateSceneController.
 */
export class ShopRecommendationController {
  constructor({
    fateCoinSystem,
    playerSystem,
    petSystem,
    progressionSystem,
    formatNumber = (value) => String(Math.floor(Number(value) || 0)),
    getProgressionContext = () => ({}),
    onNavigate = null,
  } = {}) {
    this.fateCoinSystem = fateCoinSystem;
    this.playerSystem = playerSystem;
    this.petSystem = petSystem;
    this.progressionSystem = progressionSystem;
    this.formatNumber = formatNumber;
    this.getProgressionContext = getProgressionContext;
    this.onNavigate = typeof onNavigate === "function" ? onNavigate : null;
    this.filter = "recommended";
    this.listeners = [];
    this.latestRecommendation = null;
    this.latestGoal = null;
    this.committedPrimaryAction = "";
    this.committedSecondaryAction = "";
    this.pendingRecommendationCommit = false;
  }

  /** Bind fate-shop filter tabs once. */
  bind() {
    if (this.listeners.length > 0) return;

    document.querySelectorAll("[data-fate-shop-filter]").forEach((button) => {
      const handler = () => {
        this.setFateShopFilter(button.dataset.fateShopFilter);
      };
      button.addEventListener("click", handler);
      this.listeners.push({ button, handler });
    });

    const goalRoute = document.getElementById("fate-next-goal-route");
    if (goalRoute) {
      const handler = () => {
        const scene = goalRoute.dataset.scene;
        if (scene) this.onNavigate?.(scene);
      };
      goalRoute.addEventListener("click", handler);
      this.listeners.push({ button: goalRoute, handler });
    }

    const milestoneRoute = document.getElementById("fate-milestone-route");
    if (milestoneRoute) {
      const handler = () => {
        const scene = milestoneRoute.dataset.scene;
        if (scene) this.onNavigate?.(scene);
      };
      milestoneRoute.addEventListener("click", handler);
      this.listeners.push({ button: milestoneRoute, handler });
    }

    const goalToggle = document.getElementById("fate-next-goal-toggle");
    if (goalToggle) {
      const handler = () => {
        this.setGoalDetailsExpanded(
          goalToggle.getAttribute("aria-expanded") !== "true"
        );
      };
      goalToggle.addEventListener("click", handler);
      this.listeners.push({ button: goalToggle, handler });
      this.setGoalDetailsExpanded(false);
    }

    this.updateFateShopFilter();
  }

  /** Remove filter-tab listeners while retaining the selected filter. */
  destroy() {
    this.listeners.forEach(({ button, handler }) => {
      button.removeEventListener("click", handler);
    });
    this.listeners = [];
  }

  setGoalDetailsExpanded(expanded) {
    const panel = document.getElementById("fate-next-goal");
    const toggle = document.getElementById("fate-next-goal-toggle");
    const details = document.getElementById("fate-next-goal-more");
    if (!panel || !toggle || !details) return;

    const isExpanded = Boolean(expanded);
    panel.dataset.expanded = String(isExpanded);
    details.hidden = !isExpanded;
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.setAttribute(
      "aria-label",
      isExpanded ? "收起目标详情" : "展开目标详情"
    );
    toggle.title = isExpanded ? "收起目标详情" : "展开目标详情";
    const icon = toggle.querySelector("[aria-hidden='true']");
    if (icon) icon.textContent = isExpanded ? "−" : "＋";
  }

  /**
   * Refresh recommendation ranking and every shop-adjacent guidance surface.
   */
  update({
    data = this.fateCoinSystem?.getDisplayData?.() || {},
    territorySummary = null,
    progressionContext = null,
    pathSummary = null,
    commitRecommendation = false,
  } = {}) {
    const context = progressionContext || this.getProgressionContext(data) || {};
    const activePathSummary =
      pathSummary || this.progressionSystem?.getPathSummary?.(context) || null;
    const recommendation = this.getFateUpgradeRecommendation(
      data,
      territorySummary,
      activePathSummary
    );
    this.latestRecommendation = recommendation;
    const shouldCommitRecommendation =
      commitRecommendation ||
      this.pendingRecommendationCommit ||
      !this.committedPrimaryAction;
    this.pendingRecommendationCommit = false;
    if (shouldCommitRecommendation) {
      this.commitRecommendation(recommendation);
    }
    const activeRecommendation = this.getCommittedRecommendation(recommendation);

    this.updateFateShopRecommendation(activeRecommendation);
    this.updateFateNextGoal(data, territorySummary, activeRecommendation);
    this.updateFatePathSummary(activePathSummary);

    return activeRecommendation;
  }

  resetRecommendationStability() {
    this.latestRecommendation = null;
    this.latestGoal = null;
    this.committedPrimaryAction = "";
    this.committedSecondaryAction = "";
    this.pendingRecommendationCommit = false;
    this.updateFateMilestoneVisibility();
  }

  requestRecommendationCommit() {
    this.pendingRecommendationCommit = true;
  }

  cancelRecommendationCommit() {
    this.pendingRecommendationCommit = false;
  }

  commitRecommendation(recommendation) {
    this.committedPrimaryAction = recommendation?.primary?.action || "";
    this.committedSecondaryAction = recommendation?.secondary?.action || "";
  }

  getCommittedRecommendation(recommendation) {
    if (!recommendation) return recommendation;
    const candidates = recommendation.candidates || [];
    const primary =
      candidates.find(
        (candidate) => candidate.action === this.committedPrimaryAction
      ) || recommendation.primary;
    const secondary =
      candidates.find(
        (candidate) =>
          candidate.action === this.committedSecondaryAction &&
          candidate.action !== primary?.action
      ) ||
      candidates.find((candidate) => candidate.action !== primary?.action) ||
      null;
    return { ...recommendation, primary, secondary };
  }

  updateFatePathSummary(pathSummary) {
    const pathEl = document.getElementById("fate-path-summary");

    if (pathEl) {
      const leadingPath = pathSummary?.leadingPath;
      pathEl.textContent = leadingPath
        ? `倾向：${leadingPath.label}`
        : "倾向：自由探索";
      pathEl.dataset.path = leadingPath?.id || "neutral";
      pathEl.title = leadingPath?.detail || "先尝试不同成长项，再形成倾向";
    }
  }

  getFateAutoRatePreview(data, overrides = {}) {
    const assistants = overrides.assistants ?? data.assistants ?? 0;
    const assistantPower = overrides.assistantPower ?? data.assistantPower ?? 1;
    const autoInterval = overrides.autoInterval ?? data.autoInterval ?? 3000;

    if (assistants <= 0 || autoInterval <= 0) return 0;
    return (assistants * assistantPower) / (autoInterval / 1000);
  }

  formatFateRate(value) {
    return (Number(value) || 0).toFixed(1);
  }

  getFateHeroTrainingPreview() {
    const player = this.playerSystem?.player || {};
    const attack = Math.floor(player.attack || 20);
    const maxHp = Math.floor(player.maxHp || 100);
    return `攻 ${attack}->${attack + 5} / 命 ${maxHp}->${maxHp + 10}`;
  }

  getFateAssistantSpeedPreview(data) {
    if (data.assistants <= 0) return "需小助手";
    if (data.autoInterval <= 750) return "已达上限";

    return `自动 ${this.formatFateRate(
      data.autoFlipsPerSecond
    )} -> ${this.formatFateRate(
      this.getFateAutoRatePreview(data, {
        autoInterval: Math.max(750, data.autoInterval - 250),
      })
    )}/秒`;
  }

  getFateHeroTrainingCost() {
    const trainingLevel = Math.max(
      0,
      Math.floor(this.playerSystem?.fateTrainingLevel || 0)
    );

    return {
      heads: Math.floor(14 * Math.pow(1.32, trainingLevel)),
      tails: Math.floor(6 * Math.pow(1.24, trainingLevel)),
    };
  }

  getFatePetTrainingCost() {
    const equippedCount = this.petSystem?.equippedPets?.length || 0;
    const levelTotal =
      typeof this.petSystem?.getEquippedPetLevelTotal === "function"
        ? this.petSystem.getEquippedPetLevelTotal()
        : equippedCount;
    const trainingLevel = Math.max(0, levelTotal - equippedCount);

    return {
      heads: Math.floor(4 * Math.pow(1.18, trainingLevel)),
      tails: Math.floor(16 * Math.pow(1.34, trainingLevel)),
    };
  }

  getFateUpgradeRecommendation(data, territorySummary, pathSummary = null) {
    const activePathSummary =
      pathSummary ||
      this.progressionSystem?.getPathSummary?.(
        this.getProgressionContext(data)
      );
    const candidates = this.getFateUpgradeCandidates(data, territorySummary).map(
      (candidate) => {
        const gap = this.getFateCostGap(candidate.cost, data);
        const territoryScore = this.getFateTerritoryCandidateScore(
          candidate,
          territorySummary
        );
        const pathBoost =
          this.progressionSystem?.getRecommendationBoost?.(
            candidate.action,
            activePathSummary
          ) || 0;

        return {
          ...candidate,
          gap,
          territoryScore,
          pathBoost,
          reason: this.getFateRecommendationReason(
            candidate,
            gap,
            territoryScore,
            activePathSummary,
            pathBoost
          ),
        };
      }
    );

    return rankFateRecommendationCandidates(candidates);
  }

  getFateUpgradeCandidates(data = {}, territorySummary = null) {
    const currentAuto = data.autoFlipsPerSecond || 0;
    const equippedPetCount = this.petSystem?.equippedPets?.length || 0;
    const heroCost = this.getFateHeroTrainingCost();
    const petCost = this.getFatePetTrainingCost();
    const firstAssistant = data.assistants <= 0;
    const canUseAutomation = data.assistants > 0;
    const nextAssistantRate = this.getFateAutoRatePreview(data, {
      assistants: data.assistants + 1,
    });
    const nextChipRate = this.getFateAutoRatePreview(data, {
      assistantPower: data.assistantPower + 1,
    });
    const nextSpeedRate = this.getFateAutoRatePreview(data, {
      autoInterval: Math.max(750, data.autoInterval - 250),
    });

    const candidates = [
      {
        action: "assistant",
        title: firstAssistant ? "购买第 1 个助手" : "增加小助手",
        route: "反面路线",
        routeType: "tails",
        cost: data.costs.assistant,
        preview: `自动 ${this.formatFateRate(
          currentAuto
        )} -> ${this.formatFateRate(nextAssistantRate)}/秒`,
        baseScore: firstAssistant
          ? 174
          : data.assistants < data.fateCoins
          ? 84
          : 48,
        benefitScore: Math.min(
          74,
          Math.round((nextAssistantRate - currentAuto) * 44)
        ),
        pulseGain: 26,
      },
      {
        action: "gold",
        title: "扩充桌面硬币",
        route: "正面路线",
        routeType: "heads",
        cost: data.costs.goldCoin,
        preview: `硬币 ${this.formatFateNumber(
          data.fateCoins
        )} -> ${this.formatFateNumber(data.fateCoins + 1)}`,
        baseScore: data.fateCoins < 3 ? 104 : 58,
        benefitScore: data.fateCoins < 3 ? 28 : 14,
        pulseGain: 24,
      },
      {
        action: "assistantPower",
        title: "提升自动结算",
        route: "混合路线",
        routeType: "mixed",
        cost: data.costs.assistantPower,
        preview: canUseAutomation
          ? `自动 ${this.formatFateRate(
              currentAuto
            )} -> ${this.formatFateRate(nextChipRate)}/秒`
          : "需小助手",
        baseScore: canUseAutomation
          ? data.assistantPower < 2
            ? 98
            : 68
          : 0,
        benefitScore: canUseAutomation
          ? Math.min(80, Math.round((nextChipRate - currentAuto) * 64))
          : 0,
        pulseGain: 0,
      },
      {
        action: "manual",
        title: "强化手动点击",
        route: "正面路线",
        routeType: "heads",
        cost: data.costs.manual,
        preview: `点击 +${this.formatFateNumber(
          data.manualPower
        )} -> +${this.formatFateNumber(data.manualPower + 1)}`,
        baseScore:
          data.manualPower < data.assistantPower + 2 ? 60 : 38,
        benefitScore: 18,
        pulseGain: 0,
      },
      {
        action: "speed",
        title: "缩短助手间隔",
        route: "反面路线",
        routeType: "tails",
        cost: data.costs.assistantSpeed,
        preview: this.getFateAssistantSpeedPreview(data),
        baseScore:
          canUseAutomation && data.autoInterval > 750
            ? data.assistants >= 2 && data.assistantPower >= 2
              ? 64
              : 18
            : 0,
        benefitScore:
          canUseAutomation && data.autoInterval > 750
            ? Math.min(68, Math.round((nextSpeedRate - currentAuto) * 92))
            : 0,
        pulseGain: 0,
      },
      {
        action: "hero",
        title: "进行主角训练",
        route: "正面路线",
        routeType: "heads",
        cost: heroCost,
        preview: this.getFateHeroTrainingPreview(),
        baseScore: 58,
        benefitScore: this.fateCoinSystem.canAfford(heroCost) ? 18 : 8,
        pulseGain: 16,
      },
      {
        action: "pet",
        title: "训练上阵宠物",
        route: "反面路线",
        routeType: "tails",
        cost: petCost,
        preview:
          equippedPetCount > 0 ? `宠物 Lv +${equippedPetCount}` : "先装备宠物",
        baseScore: equippedPetCount > 0 ? 48 : 0,
        benefitScore: equippedPetCount > 0 ? 12 : 0,
        pulseGain: equippedPetCount * 6,
      },
    ];

    return candidates.filter((candidate) => candidate.baseScore > 0);
  }

  getFateCostGap(cost = {}, data = {}) {
    const headsCost = Math.max(0, cost.heads || 0);
    const tailsCost = Math.max(0, cost.tails || 0);
    const missingHeads = Math.max(0, headsCost - (data.heads || 0));
    const missingTails = Math.max(0, tailsCost - (data.tails || 0));
    const totalCost = headsCost + tailsCost;
    const totalMissing = missingHeads + missingTails;
    const progress =
      totalCost <= 0
        ? 1
        : Math.max(0, Math.min(1, 1 - totalMissing / totalCost));

    return {
      missingHeads,
      missingTails,
      totalMissing,
      progress,
      affordable: totalMissing <= 0,
      missingPenalty:
        totalCost <= 0 ? 0 : Math.round((1 - progress) * 52),
    };
  }

  getFateRecommendationReason(
    candidate,
    gap,
    territoryScore = 0,
    pathSummary = null,
    pathBoost = 0
  ) {
    if (candidate.action === "assistant" && candidate.title.includes("第 1 个")) {
      return "解锁自动化";
    }
    if (territoryScore >= 72) return "可推进领地";
    if (pathBoost > 0 && pathSummary?.leadingPath) {
      return `遵循${pathSummary.leadingPath.label}倾向`;
    }

    const reasons = {
      assistant: "提升自动频率",
      gold: "扩充桌面规模",
      assistantPower: "自动收益最高",
      manual: "强化手动收益",
      speed: "后期自动提速",
      hero: "提升战斗成长",
      pet: "提升宠物成长",
    };

    if (reasons[candidate.action]) return reasons[candidate.action];
    if (gap.affordable) return "现在可购买";
    if (gap.progress >= 0.75) return "最接近购买";

    return reasons[candidate.action] || "推荐路线";
  }

  getFateTerritoryCandidateScore(candidate, territorySummary) {
    const nextBuilding = territorySummary?.nextBuilding;
    const state = nextBuilding?.state;
    if (!state || state.unlocked || !candidate.pulseGain) return 0;

    const missingPulse = Math.max(0, state.requiredPulse - state.pulse);
    if (missingPulse <= 0) return 0;
    if (candidate.pulseGain >= missingPulse) return 72;
    if (candidate.pulseGain >= missingPulse * 0.65) return 42;
    if (missingPulse <= 24) return 24;
    return 0;
  }

  updateFateShopRecommendation(recommendation) {
    const primaryAction = recommendation?.primary?.action || "";
    const secondaryAction = recommendation?.secondary?.action || "";
    const reasonByAction = new Map(
      (recommendation?.candidates || []).map((candidate) => [
        candidate.action,
        candidate.reason || "",
      ])
    );
    const buttons = Array.from(
      document.querySelectorAll(".fate-upgrade[data-fate-action]")
    );

    buttons.forEach((button, index) => {
      if (!button.dataset.fateShopOrder) {
        button.dataset.fateShopOrder = String(index);
      }

      const action = button.dataset.fateAction;
      const isPrimary = action === primaryAction;
      const isSecondary = action === secondaryAction;

      button.classList.toggle("is-recommended", isPrimary);
      button.classList.toggle("is-secondary-recommendation", isSecondary);
      button.dataset.recommendation = isPrimary
        ? "primary"
        : isSecondary
        ? "secondary"
        : "none";
      button.dataset.recommendationReason =
        isPrimary || isSecondary ? reasonByAction.get(action) || "" : "";
      this.updateFateUpgradeReason(
        button,
        button.dataset.recommendationReason
      );
    });

    this.updateFateShopFilter();
  }

  updateFateUpgradeReason(button, reason = "") {
    if (!button) return;

    let reasonEl = button.querySelector(".upgrade-reason");
    if (!reasonEl) {
      reasonEl = document.createElement("span");
      reasonEl.className = "upgrade-reason";
      button.appendChild(reasonEl);
    }

    reasonEl.textContent = reason;
    reasonEl.hidden = !reason;
  }

  setFateShopFilter(filter) {
    this.filter = FATE_SHOP_FILTERS.has(filter) ? filter : "recommended";
    if (this.filter === "recommended" && this.latestRecommendation) {
      this.commitRecommendation(this.latestRecommendation);
      this.updateFateShopRecommendation(
        this.getCommittedRecommendation(this.latestRecommendation)
      );
      return;
    }
    this.updateFateShopFilter();
  }

  updateFateShopFilter() {
    const filter = this.filter || "recommended";

    document.querySelectorAll("[data-fate-shop-filter]").forEach((button) => {
      const active = button.dataset.fateShopFilter === filter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const cards = Array.from(
      document.querySelectorAll(".fate-upgrade[data-fate-action]")
    );

    cards.forEach((button) => {
      button.hidden = !this.isFateShopCardVisible(button, filter);
    });

    const list = document.querySelector(".fate-shop-list");
    if (list) {
      cards
        .sort(
          (a, b) =>
            this.getFateShopCardDisplayOrder(a, filter) -
            this.getFateShopCardDisplayOrder(b, filter)
        )
        .forEach((button) => list.appendChild(button));
    }

    const title = document.getElementById("fate-shop-title");
    if (title) title.textContent = FATE_SHOP_FILTER_LABELS[filter] || "推荐";
    this.updateFateMilestoneVisibility();
  }

  updateFateMilestoneVisibility() {
    const card = document.getElementById("fate-milestone-card");
    if (!card) return;
    const visibleRecommendations = Array.from(
      document.querySelectorAll(".fate-upgrade[data-fate-action]")
    ).filter((button) => !button.hidden).length;
    card.hidden = !(
      this.filter === "recommended" &&
      this.latestGoal &&
      visibleRecommendations <= 2
    );
  }

  updateFateMilestoneCard(goal = null, recommendation = null) {
    this.latestGoal = goal;
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value || "";
    };
    const primaryReason = recommendation?.primary?.reason
      || recommendation?.primary?.preview
      || "优先补齐当前成长缺口";

    setText("fate-milestone-title", goal?.title || "下一里程碑");
    setText("fate-milestone-detail", goal?.detail || "继续成长以解锁下一阶段。");
    setText("fate-milestone-reason", `推荐理由：${primaryReason}`);
    setText("fate-milestone-alt", goal?.alt ? `备选：${goal.alt}` : "备选：自由成长");

    const route = document.getElementById("fate-milestone-route");
    if (route) {
      route.dataset.scene = goal?.scene || "";
      route.textContent = goal?.ctaLabel || (goal?.scene ? `前往${goal.route || "目标"}` : "");
      route.hidden = !goal?.scene;
    }
    this.updateFateMilestoneVisibility();
  }

  getFateShopCardDisplayOrder(button, filter) {
    const originalOrder = Number(button.dataset.fateShopOrder || 0);
    return getFateShopDisplayOrder(
      button.dataset.recommendation,
      originalOrder,
      filter
    );
  }

  isFateShopCardVisible(button, filter) {
    if (filter === "recommended") {
      return (
        button.dataset.recommendation === "primary" ||
        button.dataset.recommendation === "secondary"
      );
    }

    return button.dataset.fateShopCategory === filter;
  }

  updateFateNextGoal(
    data,
    territorySummary,
    recommendation = null
  ) {
    const goalEl = document.getElementById("fate-next-goal-text");
    const goalTitleEl = document.getElementById("fate-next-goal-title");
    const goalDetailEl = document.getElementById("fate-next-goal-detail");
    const routeEl = document.getElementById("fate-next-goal-route");
    const altEl = document.getElementById("fate-next-goal-alt");
    if (!goalEl) return;

    const goal = this.getFateNextGoal(
      data,
      territorySummary,
      recommendation
    );
    if (goalTitleEl && goalDetailEl) {
      goalTitleEl.textContent = goal.title;
      goalDetailEl.textContent = goal.detail || "";
      goalEl.title = goal.detail
        ? `${goal.title} · ${goal.detail}`
        : goal.title;
    } else {
      goalEl.textContent = goal.detail
        ? `${goal.title} · ${goal.detail}`
        : goal.title;
    }
    if (routeEl) {
      routeEl.textContent = goal.ctaLabel || goal.route || "命运路线";
      routeEl.dataset.route = goal.routeType || "neutral";
      routeEl.dataset.scene = goal.scene || "";
      routeEl.disabled = !goal.scene;
      routeEl.title = goal.scene ? `前往${goal.route || "目标场景"}` : "当前目标无需切换场景";
    }
    if (altEl) {
      altEl.textContent = goal.alt ? `备选：${goal.alt}` : "";
    }
    this.updateFateMilestoneCard(goal, recommendation);
  }

  getFateNextGoal(
    data,
    territorySummary,
    recommendation = null
  ) {
    const activeRecommendation =
      recommendation ||
      this.getFateUpgradeRecommendation(data, territorySummary);
    const primary = activeRecommendation?.primary;
    const secondary = activeRecommendation?.secondary;
    const territoryGoal = territorySummary?.nextGoal;

    if (territoryGoal?.title) {
      return {
        title: territoryGoal.title,
        detail: territoryGoal.detail || "",
        route: territoryGoal.route || "领地目标",
        routeType: territoryGoal.routeType || "territory",
        scene: territoryGoal.scene || "",
        action: territoryGoal.action || "",
        status: territoryGoal.status || "in_progress",
        blockers: territoryGoal.blockers || [],
        ctaLabel: territoryGoal.ctaLabel || "",
        alt: primary?.title || secondary?.title || "",
      };
    }

    if (primary) {
      const costText = this.formatFateGoalCost(primary.cost, data);
      return {
        title: primary.title,
        detail: primary.preview ? `${costText} · ${primary.preview}` : costText,
        route: primary.route,
        routeType: primary.routeType,
        alt: secondary ? secondary.title : "",
      };
    }

    return {
      title: "继续翻动命运桌",
      detail: "积累正面与反面",
      route: "命运路线",
      routeType: "neutral",
      alt: "",
    };
  }

  formatFateGoalCost(cost = {}, data = {}) {
    const missingHeads = Math.max(0, (cost.heads || 0) - (data.heads || 0));
    const missingTails = Math.max(0, (cost.tails || 0) - (data.tails || 0));
    const parts = [];

    if (missingHeads > 0) {
      parts.push(`还差 ${this.formatFateNumber(missingHeads)} 正面`);
    }
    if (missingTails > 0) {
      parts.push(`还差 ${this.formatFateNumber(missingTails)} 反面`);
    }

    return parts.join(" / ") || "现在可购买";
  }

  formatFateNumber(value) {
    return this.fateCoinSystem?.formatNumber?.(value) ?? this.formatNumber(value);
  }
}
