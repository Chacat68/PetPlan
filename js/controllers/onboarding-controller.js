const STEP_LABELS = Object.freeze([
  "命运",
  "扩桌",
  "自动",
  "探索",
  "撤离",
  "领地",
]);

/**
 * A lightweight, non-blocking coach layer for the first complete growth loop.
 * Progress remains derived from gameplay systems; this controller only explains
 * the current decision and points to a real, still-interactive control.
 */
export class OnboardingController {
  constructor({
    progressionSystem,
    saveSystem = null,
    getProgressionContext = () => ({}),
    getCurrentScene = () => "fate",
    getBattleState = () => null,
    onNavigate = null,
  } = {}) {
    this.progressionSystem = progressionSystem;
    this.saveSystem = saveSystem;
    this.getProgressionContext = getProgressionContext;
    this.getCurrentScene = getCurrentScene;
    this.getBattleState = getBattleState;
    this.onNavigate = typeof onNavigate === "function" ? onNavigate : null;
    this.abortController = null;
    this.resizeObserver = null;
    this.updateFrame = 0;
    this.positionFrame = 0;
    this.currentPresentation = null;
    this.currentTarget = null;
    this.previousDescribedBy = null;
  }

  bind() {
    if (this.abortController || typeof document === "undefined") return;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    document.getElementById("onboarding-replay-btn")?.addEventListener(
      "click",
      () => this.start(),
      { signal }
    );
    document.getElementById("onboarding-skip-btn")?.addEventListener(
      "click",
      () => this.dismiss(),
      { signal }
    );
    document.getElementById("onboarding-primary-btn")?.addEventListener(
      "click",
      () => this.handlePrimaryAction(),
      { signal }
    );

    window.addEventListener("resize", () => this.schedulePosition(), { signal });
    document.addEventListener("click", () => this.scheduleUpdate(), {
      capture: true,
      signal,
    });
    const gameArea = document.querySelector(".game-area");
    if (gameArea && typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => this.schedulePosition());
      this.resizeObserver.observe(gameArea);
    }
  }

  destroy() {
    this.clearTargetDescription();
    this.abortController?.abort();
    this.abortController = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.updateFrame) window.cancelAnimationFrame(this.updateFrame);
    if (this.positionFrame) window.cancelAnimationFrame(this.positionFrame);
    this.updateFrame = 0;
    this.positionFrame = 0;
  }

  initialize() {
    const context = this.getProgressionContext() || {};
    const state = this.progressionSystem?.getOnboardingState?.();
    if (state?.status === "new") {
      const hasLegacyProgress =
        (Number(context.totalFlips) || 0) > 0 ||
        (Number(context.buildings) || 0) > 0 ||
        (Number(context.extractions) || 0) > 0;
      if (hasLegacyProgress) this.progressionSystem?.completeOnboarding?.();
      else this.progressionSystem?.startOnboarding?.();
      this.persist();
    }
    this.update();
  }

  isActive() {
    return this.progressionSystem?.getOnboardingState?.().active === true;
  }

  start() {
    this.progressionSystem?.startOnboarding?.();
    this.persist();
    this.update();
  }

  dismiss() {
    this.progressionSystem?.dismissOnboarding?.();
    this.persist();
    this.update();
  }

  complete() {
    this.progressionSystem?.completeOnboarding?.();
    this.persist();
    this.update();
  }

  persist() {
    void this.saveSystem?.saveGame?.(1);
  }

  scheduleUpdate() {
    if (this.updateFrame || typeof window === "undefined") return;
    this.updateFrame = window.requestAnimationFrame(() => {
      this.updateFrame = 0;
      this.update();
    });
  }

  update() {
    if (typeof document === "undefined") return null;
    const layer = document.getElementById("onboarding-layer");
    const launcher = document.getElementById("onboarding-replay-btn");
    const state = this.progressionSystem?.getOnboardingState?.() || {};
    if (launcher) launcher.dataset.onboardingState = state.status || "new";

    if (!layer || !state.active || this.hasOpenModal()) {
      if (layer) layer.hidden = true;
      this.clearTargetDescription();
      return null;
    }

    const context = this.getProgressionContext() || {};
    const guide = this.progressionSystem?.getFirstSessionGuide?.(context);
    const scene = this.getCurrentScene();
    const battleState = this.getBattleState?.() || null;
    const presentation = this.getPresentation({
      guide,
      scene,
      context,
      battleState,
    });
    this.currentPresentation = presentation;
    layer.hidden = false;
    layer.dataset.step = guide?.complete ? "complete" : guide?.id || "intro";
    this.render(presentation, guide);
    this.schedulePosition();
    return presentation;
  }

  hasOpenModal() {
    return Array.from(
      document.querySelectorAll('[role="dialog"][aria-modal="true"]')
    ).some((dialog) => dialog.getClientRects().length > 0);
  }

  render(presentation, guide) {
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value || "";
    };
    setText(
      "onboarding-kicker",
      guide?.complete
        ? "成长闭环已建立"
        : `新手引导 · ${guide?.current || 1}/${guide?.total || STEP_LABELS.length}`
    );
    setText("onboarding-title", presentation.title);
    setText("onboarding-body", presentation.body);
    setText("onboarding-insight", presentation.insight);
    setText("onboarding-hint", presentation.hint);

    const primary = document.getElementById("onboarding-primary-btn");
    if (primary) {
      primary.hidden = !presentation.cta;
      primary.textContent = presentation.cta?.label || "";
    }

    const stepper = document.getElementById("onboarding-stepper");
    if (stepper) {
      const activeIndex = guide?.complete
        ? STEP_LABELS.length
        : Math.max(0, (guide?.current || 1) - 1);
      stepper.replaceChildren(
        ...STEP_LABELS.map((label, index) => {
          const item = document.createElement("span");
          item.className =
            index < activeIndex
              ? "is-complete"
              : index === activeIndex
                ? "is-active"
                : "";
          item.textContent = label;
          return item;
        })
      );
    }
  }

  handlePrimaryAction() {
    const cta = this.currentPresentation?.cta;
    if (!cta) return;
    if (cta.action === "complete") {
      this.complete();
      return;
    }
    if (cta.action === "navigate") {
      this.onNavigate?.(cta.scene);
      return;
    }
    if (cta.action === "focus") {
      const target = this.resolveTarget(this.currentPresentation);
      target?.focus?.({ preventScroll: true });
      this.schedulePosition();
    }
  }

  getPresentation({ guide, scene = "fate", battleState = null } = {}) {
    if (!guide || guide.complete) {
      return {
        title: "现在，你已经走通一次成长循环",
        body: "命运桌提供选择，助手建立自动收益，远征把战力变成战利品，领地再把战利品沉淀为永久能力。",
        insight: "之后只需看“下一目标”：缺资源就回命运或远征，资源到位就建设与训练。",
        hint: "三条倾向只是推荐，不会锁住你的选择。",
        targetSelector: "#fate-next-goal, #territory-objective-hud",
        cta: { label: "开始自由成长", action: "complete" },
      };
    }

    if (["flip", "table", "assistant"].includes(guide.id) && scene !== "fate") {
      return {
        title: "先回命运桌建立基础循环",
        body: "当前阶段需要继续积累正面、反面，或购买命运桌上的关键成长项。",
        insight: "命运桌是所有长期成长的起点。",
        hint: "点击下方按钮返回命运场景。",
        targetSelector: '.nav-btn[data-tab="fate"]',
        cta: { label: "回到命运", action: "navigate", scene: "fate" },
      };
    }

    if (guide.id === "flip") {
      return {
        title: "先掌握一个核心动作：翻转",
        body: `点击桌面硬币，把当前显示的面结算为资源。已完成 ${guide.value}/${guide.target} 次。`,
        insight: "正面偏向扩桌与主角，反面偏向助手与宠物；两者都会有用。",
        hint: "高亮硬币仍可直接点击，引导不会阻断操作。",
        targetSelector: ".fate-table-coin",
        fallbackTarget: "#fate-coin-drop-layer",
        cta: { label: "定位硬币", action: "focus" },
      };
    }

    if (guide.id === "table") {
      const canBuy =
        typeof document === "undefined" ||
        document.getElementById("fate-buy-gold-btn")?.disabled === false;
      return {
        title: canBuy
          ? "把收益变成更高的手动效率"
          : "继续翻转，凑够扩桌所需的正面",
        body: `用正面购买第 2 枚桌面硬币。当前 ${guide.value}/${guide.target} 枚。`,
        insight: "扩桌不是单纯加数值，而是让每轮可操作、可结算的目标更多。",
        hint: canBuy
          ? "资源已经满足，购买高亮的金色硬币。"
          : "商店卡片会显示精确缺口，先继续点击高亮硬币。",
        targetSelector: canBuy
          ? "#fate-buy-gold-btn"
          : ".fate-table-coin",
        fallbackTarget: canBuy ? "" : "#fate-coin-drop-layer",
        cta: {
          label: canBuy ? "定位扩桌" : "定位硬币",
          action: "focus",
        },
      };
    }

    if (guide.id === "assistant") {
      const canBuy =
        typeof document === "undefined" ||
        document.getElementById("fate-buy-assistant-btn")?.disabled === false;
      return {
        title: canBuy
          ? "让成长从手动进入自动"
          : "继续翻转，积累招募助手所需的反面",
        body: `用反面招募第 1 个小助手。当前 ${guide.value}/${guide.target} 个。`,
        insight: "助手会持续结算命运资源，让你离开命运桌后仍在成长。",
        hint: canBuy
          ? "先买助手，再考虑结算芯片与加速。"
          : "商店卡片会显示反面缺口，先继续点击高亮硬币。",
        targetSelector: canBuy
          ? "#fate-buy-assistant-btn"
          : ".fate-table-coin",
        fallbackTarget: canBuy ? "" : "#fate-coin-drop-layer",
        cta: {
          label: canBuy ? "定位助手" : "定位硬币",
          action: "focus",
        },
      };
    }

    if (guide.id === "expedition") {
      return this.getExpeditionPresentation({ scene, battleState, extraction: false });
    }

    if (guide.id === "extraction") {
      return this.getExpeditionPresentation({ scene, battleState, extraction: true });
    }

    return this.getTerritoryPresentation(scene);
  }

  getExpeditionPresentation({ scene, battleState = null, extraction = false }) {
    if (scene !== "dungeon") {
      return {
        title: extraction ? "把临时战利品真正带回来" : "让刚才的成长进入实战",
        body: extraction
          ? "返回远征，探索至少 3 个区域后回到西侧入口，启动并守住撤离信标。"
          : "进入远征，选择地点、实际移动到目标附近，并完成第 1 个区域。",
        insight: extraction
          ? "只有成功撤离，背包收益才会进入永久资源。"
          : "战力的意义要在风险、路线和收益选择中被感知。",
        hint: "远征会保留在当前页面会话中，切换场景只会暂停。",
        targetSelector: '.nav-btn[data-tab="dungeon"]',
        cta: { label: "前往远征", action: "navigate", scene: "dungeon" },
      };
    }

    const state = battleState || {};
    const phase = state.phase || "briefing";
    const depth = Number(state.depth) || 0;
    if (phase === "briefing" || phase === "defeat" || phase === "extracted") {
      return {
        title: extraction ? "开始一局并把收益带回" : "开启第一次远征",
        body: extraction
          ? "失败只损失背包并保留少量战斗收益；重新出发，目标是完成一次撤离。"
          : "开始后先选择追踪地点，再用 WASD、方向键或屏幕方向键移动。",
        insight: "远征不是挂机战斗：路线、风险和何时撤离都是成长决策。",
        hint: "点击“开始远征”。",
        targetSelector:
          phase === "briefing" ? "#battle-start-expedition-btn" : "#battle-restart-btn",
        cta: { label: "定位出发", action: "focus" },
      };
    }

    if (phase === "search") {
      return {
        title: extraction ? "选择搜索方式，继续积累区域" : "第一次搜索：收益与风险二选一",
        body: "快速搜索最稳，仔细搜刮收益更高，宠物侦察会调用当前编队天赋。",
        insight: "搜索方式把宠物编队从战斗数值延伸成探索策略。",
        hint: "选择一种搜索方式完成当前区域。",
        targetSelector: "#battle-search-actions",
        cta: { label: "定位搜索", action: "focus" },
      };
    }

    if (phase === "camp") {
      return {
        title: "安全屋是风险调节器",
        body: "休整会回血、降低威胁并补充物资；状态良好时也可以直接离开。",
        insight: "成长体验不只来自变强，也来自更有把握地承担风险。",
        hint: "根据当前生命与威胁做决定。",
        targetSelector: "#battle-camp-actions",
        cta: { label: "定位休整", action: "focus" },
      };
    }

    if (phase === "combat") {
      return {
        title: extraction ? `清理威胁，已探索 ${depth}/3` : "战斗会自动攻击，走位由你决定",
        body: "主角和宠物会自动攻击附近目标；你负责移动躲避、点击锁敌和释放宠物技能。",
        insight: "命运训练、宠物等级与基地加成都会在这里转化为可感知战力。",
        hint: "保持移动，必要时使用补给或宠物技能。",
        targetSelector: "#gameCanvas",
        fallbackTarget: "#battle-world-controls",
        cta: null,
      };
    }

    if (phase === "extracting") {
      const inZone = state.extraction?.inZone !== false;
      return {
        title: inZone ? "守住信标，直到倒计时结束" : "返回信标圈，倒计时才会继续",
        body: inZone
          ? `剩余约 ${state.extraction?.remainingSeconds ?? "--"} 秒；无需清空所有追兵，但必须活着留在圈内。`
          : "离开信标范围不会重置进度，但会暂停倒计时。",
        insight: "撤离把“继续贪收益”转化成一次明确的风险兑现。",
        hint: "在信标圈内走位并使用技能。",
        targetSelector: "#gameCanvas",
        fallbackTarget: "#battle-world-controls",
        cta: null,
      };
    }

    if (extraction && (state.extraction?.unlocked || phase === "extraction-ready")) {
      return {
        title: "返程到西侧入口，启动撤离",
        body: "点击路线中的撤离信标进行追踪，实际走回出生点附近后交互。",
        insight: "背包中的收益仍是临时的，成功守住信标后才会入库。",
        hint: state.actions?.canInteract ? "已经靠近信标，现在可以交互。" : "沿目标方向返回西侧。",
        targetSelector: state.actions?.canInteract
          ? "#battle-interact-btn"
          : "#battle-route-panel",
        fallbackTarget: "#battle-world-controls",
        cta: { label: "定位撤离", action: "focus" },
      };
    }

    return {
      title: extraction ? `再完成 ${Math.max(0, 3 - depth)} 个区域解锁撤离` : "选择地点，并实际走到那里",
      body: state.actions?.canInteract
        ? "你已经进入地点交互范围，按 E 或点击交互按钮。"
        : "右侧地点卡只负责追踪；需要用方向键或 WASD 穿过地图。",
      insight: extraction
        ? "越深入，背包价值和威胁都会提高；第 3 个区域后即可选择撤离。"
        : "远征的成长感来自探索、战斗和路线判断，而不是自动跳关。",
      hint: state.actions?.canInteract ? "与当前地点交互。" : "选择追踪目标，然后移动。",
      targetSelector: state.actions?.canInteract
        ? "#battle-interact-btn"
        : "#battle-route-panel",
      fallbackTarget: "#battle-world-controls",
      cta: { label: state.actions?.canInteract ? "定位交互" : "定位路线", action: "focus" },
    };
  }

  getTerritoryPresentation(scene) {
    if (scene !== "territory") {
      return {
        title: "把远征收益沉淀为永久基地",
        body: "前往领地，走到主基地遗迹附近并完成免费修复。",
        insight: "领地把命运、远征与宠物投入汇总成永久建设进度。",
        hint: "修复后会开放三条基地建设路线。",
        targetSelector: '.nav-btn[data-tab="territory"]',
        cta: { label: "前往领地", action: "navigate", scene: "territory" },
      };
    }

    const buildButton = document.querySelector(
      '[data-territory-action="build"]:not([hidden])'
    );
    if (buildButton) {
      return {
        title: "修复主基地，建立永久成长锚点",
        body: "主基地修复免费，完成后领地永久达到 R1，并开放训练、伙伴与生产路线。",
        insight: "这是第一次把局内行动转化成不会回退的长期进度。",
        hint: "点击“修复主基地”。",
        targetSelector: '[data-territory-action="build"]:not([hidden])',
        cta: { label: "定位修复", action: "focus" },
      };
    }

    const interact = document.getElementById("territory-interact-btn");
    if (interact && !interact.disabled) {
      return {
        title: "你已经到达主基地遗迹",
        body: "打开设施操作面板，查看修复条件与完成后的永久效果。",
        insight: "领地的所有建设都发生在实际基地位置，而不是抽象列表。",
        hint: "按 E 或点击交互按钮。",
        targetSelector: "#territory-interact-btn",
        cta: { label: "定位交互", action: "focus" },
      };
    }

    return {
      title: "走到主基地遗迹附近",
      body: "使用 A/D、左右方向键、屏幕按钮，或直接点击基地地面移动。",
      insight: "目标 HUD 说明要做什么，场景中的移动与交互负责让基地真正可感知。",
      hint: "主基地位于初始营地中央区域。",
      targetSelector: ".territory-world-controls",
      fallbackTarget: "#territoryCanvas",
      cta: { label: "定位控制", action: "focus" },
    };
  }

  resolveTarget(presentation = this.currentPresentation) {
    if (!presentation || typeof document === "undefined") return null;
    const selectors = [presentation.targetSelector, presentation.fallbackTarget]
      .filter(Boolean);
    for (const selectorGroup of selectors) {
      const target = selectorGroup
        .split(",")
        .map((selector) => document.querySelector(selector.trim()))
        .find((element) => element && element.getClientRects().length > 0);
      if (target) return target;
    }
    return null;
  }

  schedulePosition() {
    if (this.positionFrame || typeof window === "undefined") return;
    this.positionFrame = window.requestAnimationFrame(() => {
      this.positionFrame = 0;
      this.position();
    });
  }

  position() {
    const layer = document.getElementById("onboarding-layer");
    const ring = document.getElementById("onboarding-focus-ring");
    const gameArea = document.querySelector(".game-area");
    if (!layer || !ring || !gameArea || layer.hidden) return;

    this.clearTargetDescription();
    const target = this.resolveTarget();
    this.currentTarget = target;
    if (!target) {
      ring.hidden = true;
      layer.dataset.placement = "center";
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const areaRect = gameArea.getBoundingClientRect();
    const padding = 8;
    const left = Math.max(4, targetRect.left - areaRect.left - padding);
    const top = Math.max(4, targetRect.top - areaRect.top - padding);
    const width = Math.min(
      areaRect.width - left - 4,
      targetRect.width + padding * 2
    );
    const height = Math.min(
      areaRect.height - top - 4,
      targetRect.height + padding * 2
    );
    ring.hidden = false;
    ring.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    ring.style.width = `${Math.max(24, Math.round(width))}px`;
    ring.style.height = `${Math.max(24, Math.round(height))}px`;
    layer.dataset.placement =
      targetRect.top - areaRect.top < areaRect.height * 0.54 ? "bottom" : "top";

    this.previousDescribedBy = target.getAttribute("aria-describedby");
    const descriptions = new Set(
      (this.previousDescribedBy || "").split(/\s+/).filter(Boolean)
    );
    descriptions.add("onboarding-body");
    target.setAttribute("aria-describedby", Array.from(descriptions).join(" "));
  }

  clearTargetDescription() {
    if (!this.currentTarget) return;
    if (this.previousDescribedBy) {
      this.currentTarget.setAttribute("aria-describedby", this.previousDescribedBy);
    } else {
      this.currentTarget.removeAttribute("aria-describedby");
    }
    this.currentTarget = null;
    this.previousDescribedBy = null;
  }
}
