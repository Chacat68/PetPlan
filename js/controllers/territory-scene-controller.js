import { CameraSystem } from "../modules/camera-system.js?v=expedition-simplification-20260723b";
import { TerritoryWorldSystem } from "../modules/territory-world-system.js?v=petplan-sync-20260724d";
import {
  TERRITORY_BUILDING_ART_SOURCES,
  TERRITORY_BUILDING_RENDER_SIZES,
  TERRITORY_SCENE_ART_SOURCES,
} from "../modules/territory-art-config.js?v=territory-assets-lazy-20260724a";

const PATH_COLORS = Object.freeze({
  core: "#f7b62f",
  hero: "#ff7046",
  companion: "#72d7ff",
  territory: "#8dca86",
  gate: "#c38cff",
});

const BUILDING_THEMES = Object.freeze({
  main_base: Object.freeze({
    body: "#4a3030",
    bodyShade: "#17171d",
    panel: "#8f3039",
    accent: "#f7b62f",
    glass: "#235c72",
    glassGlow: "#83dcf5",
    symbol: "♡",
  }),
  training_ground: Object.freeze({
    body: "#523027",
    bodyShade: "#1e191a",
    panel: "#c44c32",
    accent: "#ffd167",
    glass: "#294957",
    glassGlow: "#72d7ff",
    symbol: "✦",
  }),
  temple: Object.freeze({
    body: "#263c3d",
    bodyShade: "#151f23",
    panel: "#327778",
    accent: "#72d7ff",
    glass: "#225a68",
    glassGlow: "#b7f5ec",
    symbol: "♥",
  }),
  workshop: Object.freeze({
    body: "#44312a",
    bodyShade: "#1d1918",
    panel: "#865238",
    accent: "#f7b62f",
    glass: "#4f3732",
    glassGlow: "#ff8a62",
    symbol: "✧",
  }),
  barracks: Object.freeze({
    body: "#303541",
    bodyShade: "#171a22",
    panel: "#525f78",
    accent: "#ff8a62",
    glass: "#253d54",
    glassGlow: "#72d7ff",
    symbol: "★",
  }),
  library: Object.freeze({
    body: "#332e42",
    bodyShade: "#191722",
    panel: "#65517e",
    accent: "#72d7ff",
    glass: "#302d57",
    glassGlow: "#c38cff",
    symbol: "✦",
  }),
  crystal_mine: Object.freeze({
    body: "#293a35",
    bodyShade: "#15221f",
    panel: "#3f7468",
    accent: "#8dca86",
    glass: "#245c5d",
    glassGlow: "#72d7ff",
    symbol: "◆",
  }),
});

/**
 * Playable territory world: movement, camera, in-world building interaction and
 * compact HUD. Persistent rules remain delegated to TerritorySystem.
 */
export class TerritorySceneController {
  constructor({
    canvas = null,
    territorySystem,
    resourceSystem,
    playerSystem = null,
    petSystem = null,
    combatSystem = null,
    saveSystem = null,
    uiSystem,
    formatNumber = (value) => String(Math.floor(Number(value) || 0)),
    getProgressionContext = () => ({}),
    getCurrentScene = () => "territory",
    onNavigate = null,
    onChanged = null,
  }) {
    this.canvas = canvas || document.getElementById("territoryCanvas");
    this.ctx = this.canvas?.getContext?.("2d", { alpha: false }) || null;
    this.territorySystem = territorySystem;
    this.resourceSystem = resourceSystem;
    this.playerSystem = playerSystem;
    this.petSystem = petSystem;
    this.combatSystem = combatSystem;
    this.saveSystem = saveSystem;
    this.uiSystem = uiSystem;
    this.formatNumber = formatNumber;
    this.getProgressionContext = getProgressionContext;
    this.getCurrentScene = getCurrentScene;
    this.onNavigate = onNavigate;
    this.onChanged = typeof onChanged === "function" ? onChanged : null;

    this.world = new TerritoryWorldSystem();
    this.camera = new CameraSystem({
      worldWidth: this.world.width,
      worldHeight: this.world.height,
      viewportWidth: this.canvas?.width || 1280,
      viewportHeight: this.canvas?.height || 720,
      smoothing: 0.11,
    });
    this.abortController = null;
    this.resizeObserver = null;
    this.animationFrame = 0;
    this.lastFrameTime = 0;
    this.isSceneActive = false;
    this.pressedKeys = new Set();
    this.pointerDirections = new Map();
    this.selectedSiteType = null;
    this.lastNearbySiteId = null;
    this.lastHudUpdate = 0;
    this.lastSettlementKey = "";
    this.sceneImages = {};
    this.buildingImages = {};
    this.assetLoadPromises = new Map();
    this.reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
  }

  loadImageAsset(type, sourceList, { building = false } = {}) {
    if (this.assetLoadPromises.has(type)) return this.assetLoadPromises.get(type);
    if (typeof Image !== "function") return Promise.resolve(null);

    const candidates = (Array.isArray(sourceList) ? sourceList : [sourceList]).filter(Boolean);
    const image = new Image();
    image.decoding = "async";
    this.sceneImages[type] = image;
    if (building) this.buildingImages[type] = image;

    const promise = new Promise((resolve) => {
      let candidateIndex = 0;
      image.onload = () => {
        image.onload = null;
        image.onerror = null;
        if (this.isSceneActive) this.render();
        resolve(image);
      };
      image.onerror = () => {
        const nextSource = candidates[candidateIndex];
        candidateIndex += 1;
        if (nextSource) {
          image.src = nextSource;
          return;
        }
        image.onload = null;
        image.onerror = null;
        resolve(null);
      };
      image.onerror();
    });
    this.assetLoadPromises.set(type, promise);
    return promise;
  }

  ensureAssetsForRank(rank = this.territorySystem?.rank || 0) {
    if (!this.isSceneActive) return Promise.resolve([]);
    const safeRank = Math.max(0, Math.floor(Number(rank) || 0));
    const loads = Object.entries(TERRITORY_SCENE_ART_SOURCES).map(([type, sourceList]) => (
      this.loadImageAsset(type, sourceList)
    ));

    for (const [type, sourceList] of Object.entries(TERRITORY_BUILDING_ART_SOURCES)) {
      const requiredRank = type === "expedition_gate"
        ? 0
        : this.world.getSite(type)?.requiredRank ?? 0;
      if (requiredRank <= safeRank) {
        loads.push(this.loadImageAsset(type, sourceList, { building: true }));
      }
    }
    return Promise.all(loads);
  }

  bind() {
    if (this.abortController) return;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.canvas = this.canvas || document.getElementById("territoryCanvas");
    this.ctx = this.canvas?.getContext?.("2d", { alpha: false }) || this.ctx;
    this.canvas?.addEventListener("click", (event) => this.handleCanvasClick(event), { signal });
    this.canvas?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });

    window.addEventListener("keydown", (event) => this.handleKeyDown(event), { signal });
    window.addEventListener("keyup", (event) => this.handleKeyUp(event), { signal });
    window.addEventListener("blur", () => this.clearMovementInput(), { signal });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.clearMovementInput();
    }, { signal });

    document.querySelectorAll("[data-territory-direction]").forEach((button) => {
      const release = (event) => {
        this.pointerDirections.delete(event.pointerId);
        if (![...this.pointerDirections.values()].includes(button.dataset.territoryDirection)) {
          button.setAttribute("aria-pressed", "false");
        }
        this.applyMovementInput();
      };
      button.addEventListener("pointerdown", (event) => {
        if (!this.isSceneActive) return;
        event.preventDefault();
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
        this.pointerDirections.set(event.pointerId, button.dataset.territoryDirection);
        button.setAttribute("aria-pressed", "true");
        this.applyMovementInput();
      }, { signal });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
        button.addEventListener(type, release, { signal });
      });
    });

    document.getElementById("territory-interact-btn")?.addEventListener(
      "click",
      () => this.openNearbyContext(),
      { signal }
    );
    document.getElementById("territory-objective-toggle")?.addEventListener(
      "click",
      () => {
        const toggle = document.getElementById("territory-objective-toggle");
        this.setObjectiveDetailsExpanded(
          toggle?.getAttribute("aria-expanded") !== "true"
        );
      },
      { signal }
    );
    this.setObjectiveDetailsExpanded(false);
    document.getElementById("territory-context-panel")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-territory-action]");
      if (!button) return;
      this.handleContextAction(button.dataset.territoryAction);
    }, { signal });

    const resizeTarget = this.canvas?.parentElement;
    if (typeof ResizeObserver === "function" && resizeTarget) {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(resizeTarget);
    } else {
      window.addEventListener("resize", () => this.resizeCanvas(), { signal });
    }
    this.updateDisplay();
  }

  destroy() {
    this.setSceneActive(false);
    this.abortController?.abort();
    this.abortController = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.closeContextPanel();
  }

  setObjectiveDetailsExpanded(expanded) {
    const panel = document.getElementById("territory-objective-hud");
    const toggle = document.getElementById("territory-objective-toggle");
    const details = document.getElementById("territory-objective-more");
    if (!panel || !toggle || !details) return;

    const isExpanded = Boolean(expanded);
    panel.dataset.expanded = String(isExpanded);
    details.hidden = !isExpanded;
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.setAttribute(
      "aria-label",
      isExpanded ? "收起庭院目标详情" : "展开庭院目标详情"
    );
    toggle.title = isExpanded ? "收起庭院目标详情" : "展开庭院目标详情";
    const icon = toggle.querySelector("[aria-hidden='true']");
    if (icon) icon.textContent = isExpanded ? "−" : "＋";
  }

  setSceneActive(active) {
    this.isSceneActive = Boolean(active);
    if (!this.isSceneActive) {
      this.clearMovementInput();
      this.closeContextPanel();
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
      return;
    }

    this.syncProgress({ silent: true });
    this.world.setRank(this.territorySystem.rank);
    this.world.syncFollowers(this.petSystem?.equippedPets || []);
    const settlement = this.combatSystem?.lastSettlement;
    const settlementKey = settlement
      ? `${settlement.runId || "run"}-${settlement.extracted}-${settlement.depth}-${settlement.coins}`
      : "";
    const returning = Boolean(settlementKey && settlementKey !== this.lastSettlementKey);
    if (returning) {
      this.lastSettlementKey = settlementKey;
      const message = settlement.extracted
        ? `远征队已返航：带回 ${this.formatNumber(settlement.coins)} 金币与 ${this.formatNumber(settlement.crystals)} 水晶。`
        : "远征队返回庭院休整，本次只保留了部分收益。";
      this.uiSystem?.showToast(message, "info");
    }
    this.world.resetPosition({ fromExpedition: returning });
    this.resizeCanvas();
    const playerCenter = this.getWorldPlayerCenter();
    this.camera.snapTo(playerCenter.x, this.world.groundY - 170);
    this.updateDisplay();
    this.startLoop();
  }

  startLoop() {
    if (!this.isSceneActive || this.animationFrame) return;
    this.lastFrameTime = performance.now();
    const frame = (time) => {
      if (!this.isSceneActive) {
        this.animationFrame = 0;
        return;
      }
      const deltaTime = Math.min(100, Math.max(0, time - this.lastFrameTime));
      this.lastFrameTime = time;
      this.updateWorld(deltaTime);
      this.render();
      this.animationFrame = requestAnimationFrame(frame);
    };
    this.animationFrame = requestAnimationFrame(frame);
  }

  resizeCanvas() {
    if (!this.canvas?.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const width = Math.max(640, Math.floor(rect.width));
    const height = Math.max(360, Math.floor(rect.height));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.camera.setViewportSize(width, height);
    this.camera.setWorldSize(this.world.width, this.world.height);
  }

  syncProgress() {
    if (!this.territorySystem) return null;
    const summary = this.territorySystem.setProgressContext(this.getProgressionContext() || {});
    this.world.setRank(summary.rank);
    this.camera.setWorldSize(summary.worldWidth, this.world.height);
    if (this.isSceneActive) this.ensureAssetsForRank(summary.rank);
    return summary;
  }

  updateWorld(deltaTime) {
    this.world.syncFollowers(this.petSystem?.equippedPets || []);
    const state = this.world.update(deltaTime);
    const completed = this.world.consumeCompletedActivity();
    if (completed) {
      const petSupport = this.petSystem?.getBaseSupport?.(completed.buildingType) || null;
      const result = this.territorySystem.performActivity(
        completed.buildingType,
        Date.now(),
        { petSupport },
      );
      this.handleActionResult(result);
      this.updateDisplay();
      if (result?.success) this.onChanged?.(result);
    }
    const center = this.getWorldPlayerCenter();
    this.camera.follow(center.x, this.world.groundY - 170, deltaTime);
    if (state.nearbySite?.id !== this.lastNearbySiteId) {
      this.lastNearbySiteId = state.nearbySite?.id || null;
      this.updateInteractionPrompt(state.nearbySite);
      if (!state.nearbySite) this.closeContextPanel();
    }
    this.lastHudUpdate += deltaTime;
    if (this.lastHudUpdate >= 500) {
      this.lastHudUpdate = 0;
      this.updateHudValues();
    }
  }

  handleKeyDown(event) {
    if (!this.isSceneActive || this.getCurrentScene() !== "territory") return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    ) return;
    if (["KeyA", "ArrowLeft", "KeyD", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
      this.pressedKeys.add(event.code);
      this.applyMovementInput();
      return;
    }
    if (event.code === "KeyE" && !event.repeat) {
      event.preventDefault();
      this.openNearbyContext();
      return;
    }
    if (event.code === "Escape") this.closeContextPanel();
  }

  handleKeyUp(event) {
    if (!["KeyA", "ArrowLeft", "KeyD", "ArrowRight"].includes(event.code)) return;
    this.pressedKeys.delete(event.code);
    this.applyMovementInput();
  }

  applyMovementInput() {
    let direction = 0;
    const pointer = new Set(this.pointerDirections.values());
    if (this.pressedKeys.has("KeyA") || this.pressedKeys.has("ArrowLeft") || pointer.has("left")) direction -= 1;
    if (this.pressedKeys.has("KeyD") || this.pressedKeys.has("ArrowRight") || pointer.has("right")) direction += 1;
    this.world.setMovementInput(direction);
    if (direction !== 0) this.closeContextPanel();
  }

  clearMovementInput() {
    this.pressedKeys.clear();
    this.pointerDirections.clear();
    document.querySelectorAll("[data-territory-direction]").forEach((button) => {
      button.setAttribute("aria-pressed", "false");
    });
    this.world.clearMovement();
  }

  handleCanvasClick(event) {
    if (!this.isSceneActive || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const screenX = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
    const screenY = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
    const point = this.camera.screenToWorld(screenX, screenY);
    const site = this.world.getVisibleSites()
      .map((candidate) => ({ candidate, distance: Math.abs(candidate.x - point.x) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (site && site.distance <= 92 && point.y <= this.world.groundY + 30) {
      this.world.setMoveTarget(site.candidate.x);
      this.selectedSiteType = site.candidate.type;
    } else {
      this.world.setMoveTarget(point.x);
      this.selectedSiteType = null;
    }
    this.closeContextPanel();
  }

  updateInteractionPrompt(site = this.world.getNearbySite()) {
    const interact = document.getElementById("territory-interact-btn");
    const label = document.getElementById("territory-interact-label");
    const detail = document.getElementById("territory-interact-detail");
    if (!site) {
      if (interact) interact.disabled = true;
      if (label) label.textContent = "靠近设施后互动";
      if (detail) detail.textContent = "A/D、方向键或点击地面移动";
      return;
    }
    const name = site.type === "expedition_gate"
      ? "次元探索门"
      : this.territorySystem.buildingData[site.type]?.name || "庭院设施";
    if (interact) interact.disabled = false;
    if (label) label.textContent = `和${name}互动`;
    if (detail) detail.textContent = "按 E 或点击查看";
  }

  openNearbyContext() {
    const site = this.world.getNearbySite();
    if (!site) {
      this.uiSystem?.showToast("再靠近一点，就能与庭院设施互动啦。", "info");
      return;
    }
    this.clearMovementInput();
    this.selectedSiteType = site.type;
    this.renderContextPanel(site.type);
  }

  closeContextPanel() {
    const panel = document.getElementById("territory-context-panel");
    if (panel) panel.hidden = true;
  }

  renderContextPanel(type) {
    const panel = document.getElementById("territory-context-panel");
    if (!panel) return;
    const title = document.getElementById("territory-context-title");
    const detail = document.getElementById("territory-context-detail");
    const kicker = document.getElementById("territory-context-kicker");
    const stats = document.getElementById("territory-context-stats");
    const actions = Array.from(panel.querySelectorAll("[data-territory-action]"));
    actions.forEach((button) => {
      const action = button.dataset.territoryAction;
      if (action !== "close") button.hidden = true;
      button.disabled = false;
    });

    if (type === "expedition_gate") {
      if (kicker) kicker.textContent = "次元探索门";
      if (title) title.textContent = "开启宠物远征";
      if (detail) detail.textContent = "带上庭院准备效果，和宠物伙伴一起进入可自由探索的异世界。";
      if (stats) stats.innerHTML = this.getPreparedBonusRows();
      this.showContextAction("depart", "进入远征");
      panel.hidden = false;
      return;
    }

    const data = this.territorySystem.buildingData[type];
    const building = this.territorySystem.getBuildingByType(type);
    const unlock = this.territorySystem.getBuildingUnlockState(type);
    if (!data) return;
    if (kicker) kicker.textContent = this.getPathLabel(data.site?.path);
    if (title) title.textContent = `${data.icon} ${data.name}`;
    if (detail) detail.textContent = data.description;

    const rows = [];
    if (building) {
      rows.push(["建筑等级", `Lv.${building.level} / ${this.territorySystem.getBuildingLevelCap(type)}`]);
      rows.push(["当前效果", this.getBuildingEffectText(type, building.level)]);
      if (data.effects?.type === "production") {
        const item = this.territorySystem.getProductionSnapshot().buildings.find((entry) => entry.type === type);
        rows.push(["待收取", `${this.formatNumber(item?.amount || 0)} ${data.effects.resource === "coins" ? "金币" : "水晶"}`]);
      }
      if (data.activity) {
        const support = this.petSystem?.getBaseSupport?.(type);
        if (support) {
          const effect = this.territorySystem.getActivitySupportBonus(type, support);
          rows.push([
            "宠物岗位",
            `${support.petName} · ${support.roleLabel} / ${support.tierLabel}`,
          ]);
          if (effect) rows.push(["岗位效果", effect.detail]);
        }
      }
    } else {
      const cost = this.territorySystem.calculateBuildCost(type);
      rows.push(["蓝图状态", unlock.unlocked ? "可以建设" : unlock.reason]);
      rows.push(["建造费用", `${this.formatNumber(cost.coins)} 金币 / ${this.formatNumber(cost.crystals)} 水晶`]);
    }
    if (stats) stats.innerHTML = rows.map(([label, value]) => (
      `<div class="territory-context-stat"><span>${label}</span><b>${value}</b></div>`
    )).join("");

    if (!building) {
      const canBuild = this.territorySystem.canBuild(type, data.site.slotIndex);
      const button = this.showContextAction("build", type === "main_base" ? "启用星愿屋" : "开始布置");
      if (button) {
        button.disabled = !canBuild.success;
        if (!canBuild.success) button.title = canBuild.reason;
      }
    } else if (type === "main_base") {
      const canPromote = this.territorySystem.canExpand();
      const button = this.showContextAction("promote", canPromote.next ? `升阶为 R${canPromote.next.rank}` : "领地升阶");
      if (button) {
        button.disabled = !canPromote.success;
        if (!canPromote.success) button.title = canPromote.reason;
      }
      const requirementState = this.territorySystem.getRankRequirementState();
      if (stats && requirementState.config) {
        stats.innerHTML += requirementState.checks.map((check) => (
          `<div class="territory-context-stat"><span>${check.met ? "✓" : "○"} ${check.label}</span><b>${this.formatNumber(check.value)} / ${this.formatNumber(check.target)}</b></div>`
        )).join("");
      }
    } else {
      const canUpgrade = this.territorySystem.canUpgrade(building.slotIndex);
      const upgrade = this.showContextAction("upgrade", "升级建筑");
      if (upgrade) {
        upgrade.disabled = !canUpgrade.success;
        upgrade.title = canUpgrade.success
          ? `${this.formatNumber(canUpgrade.cost.coins)}金币 / ${this.formatNumber(canUpgrade.cost.crystals)}水晶`
          : canUpgrade.reason;
      }
      if (data.activity) {
        const activity = this.territorySystem.canPerformActivity(type);
        const activityButton = this.showContextAction("activity", this.territorySystem.getActivityDefinition(data.activity)?.label || "庭院活动");
        if (activityButton) {
          activityButton.disabled = !activity.success;
          if (!activity.success) activityButton.title = activity.reason;
        }
      }
      if (data.effects?.type === "production") {
        const amount = this.territorySystem.getProductionSnapshot().buildings.find((entry) => entry.type === type)?.amount || 0;
        const collect = this.showContextAction("collect", "收取储备");
        if (collect) collect.disabled = amount <= 0;
      }
    }
    panel.hidden = false;
  }

  showContextAction(action, label) {
    const button = document.querySelector(`[data-territory-action="${action}"]`);
    if (!button) return null;
    button.hidden = false;
    button.textContent = label;
    return button;
  }

  handleContextAction(action) {
    if (action === "close") {
      this.closeContextPanel();
      return;
    }
    const type = this.selectedSiteType;
    if (action === "depart") {
      this.closeContextPanel();
      this.onNavigate?.("dungeon");
      return;
    }
    if (!type || type === "expedition_gate") return;
    const data = this.territorySystem.buildingData[type];
    let result = null;
    if (action === "build") result = this.territorySystem.buildBuilding(type, data.site.slotIndex);
    if (action === "upgrade") result = this.territorySystem.upgradeBuilding(data.site.slotIndex);
    if (action === "promote") result = this.territorySystem.expandTerritory();
    if (action === "collect") {
      const collected = this.territorySystem.collectResources();
      result = {
        success: collected.coins > 0 || collected.crystals > 0,
        message: collected.coins > 0 || collected.crystals > 0
          ? `收取 ${this.formatNumber(collected.coins)} 金币 / ${this.formatNumber(collected.crystals)} 水晶`
          : "当前没有可收取储备",
      };
    }
    if (action === "activity") {
      const activity = this.territorySystem.canPerformActivity(type);
      if (!activity.success) result = activity;
      else if (this.world.startActivity(type, activity.definition)) {
        result = { success: true, message: `${activity.definition.label}开始` };
        this.closeContextPanel();
      }
    }
    this.handleActionResult(result);
    this.syncProgress();
    this.world.setRank(this.territorySystem.rank);
    this.updateDisplay();
    if (result?.success) this.onChanged?.(result);
    if (!this.world.activity && type) this.renderContextPanel(type);
  }

  handleActionResult(result) {
    if (!result) return;
    if (result.message) {
      this.uiSystem?.showToast(result.message, result.success ? "success" : "info");
    }
    this.resourceSystem?.updateDisplay?.();
  }

  updateDisplay() {
    if (!this.territorySystem || !this.resourceSystem) return;
    const summary = this.syncProgress() || this.territorySystem.getProgressSummary();
    this.world.syncFollowers(this.petSystem?.equippedPets || []);
    this.updateHudValues(summary);
    this.updateObjective(summary);
    this.updateInteractionPrompt();
    if (this.isSceneActive) this.render();
  }

  updateHudValues(summary = this.territorySystem.getProgressSummary()) {
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    };
    setText("territory-rank-badge", `R${summary.rank} · ${summary.rankName}`);
    setText("territory-gold", this.formatNumber(this.resourceSystem.coins));
    setText("territory-crystal", this.formatNumber(this.resourceSystem.crystals));
    setText("territory-construction-score", this.formatNumber(summary.constructionScore));
    setText("territory-resonance", this.formatNumber(summary.pulse));
  }

  updateObjective(summary = this.territorySystem.getProgressSummary()) {
    const title = document.getElementById("territory-objective-title");
    const detail = document.getElementById("territory-objective-detail");
    if (!title || !detail) return;
    const goal = summary.nextGoal || this.territorySystem.getNextProgressionGoal(summary.production);
    title.textContent = goal.title;
    detail.textContent = goal.detail || "";
  }

  getPreparedBonusRows() {
    const prepared = this.territorySystem.getPreparedBonuses();
    const rows = [
      ["临时攻击", `+${prepared.attack || 0}`],
      ["临时防御", `+${prepared.defense || 0}`],
      ["额外补给", `+${prepared.supplies || 0}`],
      ["结算经验", `+${prepared.expBonus || 0}%`],
    ];
    return rows.map(([label, value]) => (
      `<div class="territory-context-stat"><span>${label}</span><b>${value}</b></div>`
    )).join("");
  }

  getBuildingEffectText(type, level) {
    const effects = {
      main_base: `庭院 R${this.territorySystem.rank}`,
      training_ground: `主角攻击 +${level * 4}`,
      temple: `远征防御 +${level * 3} · 宠物冷却 -${Math.min(20, level * 2)}%`,
      workshop: `金币储备 ${level * 45}/分钟 · 远征金币 +${level * 3}%`,
      barracks: `攻击/防御 +${level * 3}`,
      library: `远征经验 +${Math.min(30, level * 4)}%`,
      crystal_mine: `水晶储备 ${level * 4}/2分钟`,
    };
    return effects[type] || "庭院增益";
  }

  getPathLabel(path) {
    const labels = { core: "星愿广场", hero: "闪耀训练区", companion: "萌宠疗愈区", territory: "梦工坊街区", gate: "次元探索区" };
    return labels[path] || "庭院设施";
  }

  getWorldPlayerCenter() {
    return {
      x: this.world.player.x + this.world.player.width / 2,
      y: this.world.player.y + this.world.player.height / 2,
    };
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);
    this.renderSky(ctx, width, height);
    const camera = this.camera.getState();
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    this.renderWorldScenery(ctx);
    this.renderSites(ctx);
    this.renderFollowers(ctx);
    this.renderPlayer(ctx);
    ctx.restore();
    this.renderWorldOverlay(ctx);
  }

  renderSky(ctx, width, height) {
    const rank = this.territorySystem.rank;
    const sky = this.sceneImages.sky;
    const camera = this.camera.getState();
    if (sky?.complete && sky.naturalWidth > 0) {
      const scale = Math.max(height / sky.naturalHeight, (width + 520) / sky.naturalWidth);
      const drawWidth = sky.naturalWidth * scale;
      const drawHeight = sky.naturalHeight * scale;
      const maxCameraX = Math.max(1, this.world.width - width);
      const panRange = Math.max(0, drawWidth - width);
      const offset = -(Math.max(0, Math.min(1, camera.x / maxCameraX)) * panRange);
      const y = height - drawHeight;
      ctx.drawImage(sky, offset, y, drawWidth, drawHeight);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#111b35");
      gradient.addColorStop(0.52, "#3f3549");
      gradient.addColorStop(1, "#c06a48");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.fillStyle = `rgba(8, 10, 18, ${Math.max(0, 0.08 - rank * 0.01)})`;
    ctx.fillRect(0, 0, width, height);
  }

  renderWorldScenery(ctx) {
    const groundY = this.world.groundY;
    const camera = this.camera.getState();
    const overscan = Math.max(640, camera.width, this.canvas?.width || 0);
    const sceneryLeft = -overscan;
    const sceneryWidth = this.world.width + overscan * 2;

    const terraceGradient = ctx.createLinearGradient(0, groundY - 26, 0, this.world.height);
    terraceGradient.addColorStop(0, "rgba(111, 72, 55, 0.44)");
    terraceGradient.addColorStop(0.18, "rgba(91, 58, 48, 0.9)");
    terraceGradient.addColorStop(1, "#291b1b");
    ctx.fillStyle = terraceGradient;
    ctx.fillRect(sceneryLeft, groundY - 26, sceneryWidth, this.world.height - groundY + 30);

    const routeGradient = ctx.createLinearGradient(0, groundY - 22, 0, groundY + 46);
    routeGradient.addColorStop(0, "rgba(172, 55, 56, 0.82)");
    routeGradient.addColorStop(1, "rgba(104, 31, 43, 0.9)");
    ctx.fillStyle = routeGradient;
    ctx.fillRect(sceneryLeft, groundY - 19, sceneryWidth, 60);

    this.renderR2RegionSign(ctx);
  }

  renderR2RegionSign(ctx) {
    if (this.territorySystem.rank < 1) return;

    const groundY = this.world.groundY;
    const r1Boundary = this.territorySystem.getRankConfig(1)?.worldWidth || 2180;
    const signX = r1Boundary - 112;
    const isOpen = this.territorySystem.rank >= 2;
    const requirementState = this.territorySystem.getRankRequirementState(2);
    const missing = requirementState.checks.find((check) => !check.met);
    const status = isOpen
      ? "已开放 · 向右探索"
      : missing
        ? `未开放 · ${missing.label} ${this.formatNumber(missing.value)}/${this.formatNumber(missing.target)}`
        : "待升阶 · 返回星愿屋";

    ctx.save();
    ctx.translate(signX, groundY);

    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 1, 91, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    const poleGradient = ctx.createLinearGradient(-50, -132, 50, 0);
    poleGradient.addColorStop(0, "#694436");
    poleGradient.addColorStop(0.52, "#d48a54");
    poleGradient.addColorStop(1, "#4d3030");
    ctx.strokeStyle = poleGradient;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-60, 0);
    ctx.lineTo(-60, -112);
    ctx.moveTo(60, 0);
    ctx.lineTo(60, -112);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 213, 143, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-57, -5);
    ctx.lineTo(-57, -107);
    ctx.moveTo(63, -5);
    ctx.lineTo(63, -107);
    ctx.stroke();

    const panelX = -108;
    const panelY = -152;
    const panelWidth = 216;
    const panelHeight = 82;
    ctx.shadowColor = isOpen ? "rgba(247, 182, 47, 0.44)" : "rgba(0, 0, 0, 0.56)";
    ctx.shadowBlur = isOpen ? 16 : 9;
    ctx.fillStyle = "rgba(14, 15, 21, 0.97)";
    this.roundRectPath(ctx, panelX, panelY, panelWidth, panelHeight, 9);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = isOpen ? "#f7b62f" : "#aa684a";
    ctx.lineWidth = 3;
    this.roundRectPath(ctx, panelX, panelY, panelWidth, panelHeight, 9);
    ctx.stroke();

    ctx.fillStyle = isOpen ? "#8f3039" : "#533238";
    this.roundRectPath(ctx, panelX + 6, panelY + 6, 43, panelHeight - 12, 5);
    ctx.fill();
    ctx.fillStyle = "#ffd167";
    ctx.font = "900 17px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("R2", panelX + 28, panelY + 37);
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.fillText("区域", panelX + 28, panelY + 56);

    ctx.textAlign = "left";
    ctx.fillStyle = "#fff0cd";
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.fillText("萌宠乐园", panelX + 60, panelY + 31);
    ctx.fillStyle = isOpen ? "#72d7ff" : "#d9a17a";
    ctx.font = "bold 10px Arial, sans-serif";
    ctx.fillText(status, panelX + 60, panelY + 51);

    ctx.fillStyle = isOpen ? "#ffd167" : "#9b6553";
    ctx.beginPath();
    ctx.moveTo(panelX + 178, panelY + 62);
    ctx.lineTo(panelX + 199, panelY + 62);
    ctx.lineTo(panelX + 199, panelY + 56);
    ctx.lineTo(panelX + 207, panelY + 67);
    ctx.lineTo(panelX + 199, panelY + 78);
    ctx.lineTo(panelX + 199, panelY + 72);
    ctx.lineTo(panelX + 178, panelY + 72);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  roundRectPath(ctx, x, y, width, height, radius = 12) {
    const safeRadius = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  }

  renderModernBuilding(ctx, type, width, height, level = 1) {
    const theme = BUILDING_THEMES[type] || BUILDING_THEMES.main_base;
    const massesByType = {
      main_base: [
        { x: -0.47, y: -0.53, w: 0.29, h: 0.46, rows: 3, cols: 2 },
        { x: -0.2, y: -0.84, w: 0.41, h: 0.77, glass: true, rows: 5, cols: 4 },
        { x: 0.21, y: -0.61, w: 0.26, h: 0.54, rows: 4, cols: 2 },
      ],
      training_ground: [
        { x: -0.47, y: -0.53, w: 0.94, h: 0.46, rows: 3, cols: 7 },
        { x: -0.3, y: -0.73, w: 0.6, h: 0.24, glass: true, rows: 1, cols: 6 },
      ],
      temple: [
        { x: -0.42, y: -0.84, w: 0.4, h: 0.77, glass: true, rows: 5, cols: 3 },
        { x: -0.02, y: -0.56, w: 0.46, h: 0.49, rows: 3, cols: 4 },
      ],
      workshop: [
        { x: -0.47, y: -0.58, w: 0.58, h: 0.51, rows: 3, cols: 4 },
        { x: 0.11, y: -0.77, w: 0.34, h: 0.7, glass: true, rows: 5, cols: 3 },
      ],
      barracks: [
        { x: -0.43, y: -0.81, w: 0.32, h: 0.74, rows: 5, cols: 2 },
        { x: -0.08, y: -0.63, w: 0.51, h: 0.56, glass: true, rows: 4, cols: 4 },
      ],
      library: [
        { x: -0.47, y: -0.51, w: 0.94, h: 0.44, rows: 2, cols: 6 },
        { x: -0.27, y: -0.84, w: 0.6, h: 0.37, glass: true, rows: 2, cols: 5 },
      ],
      crystal_mine: [
        { x: -0.47, y: -0.48, w: 0.31, h: 0.41, rows: 3, cols: 2 },
        { x: -0.16, y: -0.76, w: 0.33, h: 0.69, glass: true, rows: 5, cols: 3 },
        { x: 0.17, y: -0.54, w: 0.3, h: 0.47, rows: 3, cols: 2 },
      ],
    };
    const masses = massesByType[type] || massesByType.main_base;

    ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
    ctx.beginPath();
    ctx.ellipse(0, 1, width * 0.46, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#12141a";
    this.roundRectPath(ctx, -width * 0.49, -height * 0.1, width * 0.98, height * 0.1, 4);
    ctx.fill();
    ctx.fillStyle = theme.panel;
    ctx.fillRect(-width * 0.47, -height * 0.105, width * 0.94, height * 0.025);
    ctx.fillStyle = "rgba(247, 182, 47, 0.68)";
    ctx.fillRect(-width * 0.47, -height * 0.075, width * 0.94, 2);

    masses.forEach((mass, index) => {
      this.renderUrbanMass(
        ctx,
        {
          x: mass.x * width,
          y: mass.y * height,
          width: mass.w * width,
          height: mass.h * height,
          rows: mass.rows,
          cols: mass.cols,
          glass: mass.glass,
          accentOnLeft: index % 2 === 0,
        },
        theme
      );
    });

    this.renderModernBuildingDetails(ctx, type, width, height, theme);

    if (level > 1) {
      const stars = Math.min(5, level);
      ctx.fillStyle = "#ffd85c";
      ctx.font = `bold ${Math.max(10, width * 0.04)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText("✦".repeat(stars), 0, -height - 7);
    }
  }

  renderUrbanMass(ctx, mass, theme) {
    const {
      x,
      y,
      width,
      height,
      rows = 3,
      cols = 3,
      glass = false,
      accentOnLeft = true,
    } = mass;
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, glass ? theme.glass : theme.body);
    gradient.addColorStop(0.58, glass ? theme.bodyShade : theme.bodyShade);
    gradient.addColorStop(1, "#101217");
    ctx.fillStyle = gradient;
    this.roundRectPath(ctx, x, y, width, height, Math.min(7, width * 0.045));
    ctx.fill();
    ctx.strokeStyle = "rgba(215, 164, 95, 0.72)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = theme.panel;
    const accentWidth = Math.max(4, width * 0.045);
    ctx.fillRect(accentOnLeft ? x : x + width - accentWidth, y + 3, accentWidth, height - 6);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x, y, width, Math.max(3, height * 0.025));

    const insetX = x + width * 0.12;
    const insetY = y + height * 0.14;
    const insetWidth = width * 0.76;
    const insetHeight = height * 0.68;
    if (glass) {
      const glassGradient = ctx.createLinearGradient(insetX, insetY, insetX + insetWidth, insetY + insetHeight);
      glassGradient.addColorStop(0, "rgba(114, 215, 255, 0.58)");
      glassGradient.addColorStop(0.45, theme.glass);
      glassGradient.addColorStop(1, "rgba(16, 20, 31, 0.92)");
      ctx.fillStyle = glassGradient;
      ctx.fillRect(insetX, insetY, insetWidth, insetHeight);
    }

    const gapX = insetWidth / Math.max(1, cols);
    const gapY = insetHeight / Math.max(1, rows);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cols; column += 1) {
        const windowX = insetX + column * gapX + gapX * 0.16;
        const windowY = insetY + row * gapY + gapY * 0.17;
        ctx.fillStyle = glass
          ? "rgba(139, 225, 248, 0.24)"
          : (row + column) % 3 === 0
            ? theme.glassGlow
            : theme.glass;
        ctx.globalAlpha = glass ? 0.7 : (row + column) % 3 === 0 ? 0.88 : 0.55;
        ctx.fillRect(windowX, windowY, gapX * 0.64, Math.max(3, gapY * 0.44));
      }
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255, 240, 205, 0.18)";
    ctx.lineWidth = 1;
    for (let column = 1; column < cols; column += 1) {
      const lineX = insetX + column * gapX;
      ctx.beginPath();
      ctx.moveTo(lineX, insetY);
      ctx.lineTo(lineX, insetY + insetHeight);
      ctx.stroke();
    }
  }

  renderModernBuildingDetails(ctx, type, width, height, theme) {
    const sign = (x, y, label = theme.symbol, signWidth = width * 0.16) => {
      ctx.fillStyle = "rgba(15, 16, 22, 0.96)";
      this.roundRectPath(ctx, x - signWidth / 2, y - height * 0.055, signWidth, height * 0.11, 4);
      ctx.fill();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = theme.accent;
      ctx.font = `bold ${Math.max(14, width * 0.065)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y + 1);
      ctx.textBaseline = "alphabetic";
    };
    const rooftopUnit = (x, y, unitWidth = width * 0.12) => {
      ctx.fillStyle = "#20232b";
      ctx.fillRect(x, y, unitWidth, height * 0.07);
      ctx.fillStyle = "rgba(255, 240, 205, 0.38)";
      ctx.fillRect(x + 3, y + 3, unitWidth - 6, 2);
    };

    if (type === "main_base") {
      ctx.fillStyle = "rgba(18, 20, 26, 0.96)";
      ctx.fillRect(-width * 0.42, -height * 0.34, width * 0.84, height * 0.075);
      ctx.fillStyle = theme.accent;
      ctx.fillRect(-width * 0.42, -height * 0.34, width * 0.84, 3);
      sign(0, -height * 0.71, "♡", width * 0.14);
      rooftopUnit(-width * 0.4, -height * 0.6);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width * 0.08, -height * 0.84);
      ctx.lineTo(width * 0.08, -height * 0.96);
      ctx.stroke();
      ctx.fillStyle = theme.glassGlow;
      ctx.beginPath();
      ctx.arc(width * 0.08, -height * 0.98, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (type === "training_ground") {
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 5;
      [-0.35, -0.12, 0.12, 0.35].forEach((offset) => {
        ctx.beginPath();
        ctx.moveTo(width * (offset - 0.07), -height * 0.1);
        ctx.lineTo(width * (offset + 0.07), -height * 0.52);
        ctx.stroke();
      });
      ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
      this.roundRectPath(ctx, -width * 0.22, -height * 0.64, width * 0.44, height * 0.11, 3);
      ctx.fill();
      ctx.fillStyle = theme.accent;
      ctx.font = `bold ${Math.max(11, width * 0.05)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText("SPORTS / PET LAB", 0, -height * 0.57);
    }

    if (type === "temple") {
      sign(-width * 0.21, -height * 0.69, "♥", width * 0.15);
      ctx.fillStyle = theme.accent;
      ctx.fillRect(width * 0.05, -height * 0.42, width * 0.34, height * 0.028);
      ctx.fillStyle = "#456d53";
      [0.08, 0.17, 0.27, 0.36].forEach((offset, index) => {
        ctx.beginPath();
        ctx.arc(width * offset, -height * (0.18 + (index % 2) * 0.04), width * 0.055, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "rgba(183, 245, 236, 0.88)";
      ctx.fillRect(width * 0.04, -height * 0.14, width * 0.36, height * 0.07);
    }

    if (type === "workshop") {
      rooftopUnit(-width * 0.38, -height * 0.65, width * 0.16);
      rooftopUnit(-width * 0.17, -height * 0.65, width * 0.11);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width * 0.28, -height * 0.77);
      ctx.lineTo(width * 0.28, -height * 0.94);
      ctx.lineTo(width * 0.37, -height * 0.94);
      ctx.stroke();
      sign(width * 0.28, -height * 0.59);
      ctx.fillStyle = "rgba(255, 138, 98, 0.52)";
      ctx.fillRect(-width * 0.41, -height * 0.19, width * 0.44, height * 0.1);
    }

    if (type === "barracks") {
      sign(-width * 0.27, -height * 0.69, "★", width * 0.15);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(-width * 0.02, -height * 0.5, width * 0.37, height * 0.26);
      ctx.setLineDash([]);
      rooftopUnit(width * 0.14, -height * 0.7, width * 0.15);
    }

    if (type === "library") {
      ctx.fillStyle = "rgba(16, 18, 26, 0.92)";
      ctx.fillRect(-width * 0.39, -height * 0.23, width * 0.78, height * 0.12);
      ctx.fillStyle = theme.accent;
      ctx.font = `bold ${Math.max(10, width * 0.045)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText("MEDIA ARCHIVE · 24H", 0, -height * 0.15);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width * 0.22, -height * 0.84);
      ctx.lineTo(width * 0.31, -height * 0.96);
      ctx.stroke();
      ctx.fillStyle = "#151821";
      ctx.beginPath();
      ctx.ellipse(width * 0.34, -height * 0.97, width * 0.09, height * 0.035, -0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    if (type === "crystal_mine") {
      sign(0, -height * 0.61, "◆", width * 0.14);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-width * 0.42, -height * 0.41);
      ctx.lineTo(-width * 0.3, -height * 0.57);
      ctx.lineTo(-width * 0.18, -height * 0.41);
      ctx.moveTo(width * 0.2, -height * 0.48);
      ctx.lineTo(width * 0.32, -height * 0.64);
      ctx.lineTo(width * 0.43, -height * 0.48);
      ctx.stroke();
      ctx.fillStyle = "rgba(141, 202, 134, 0.46)";
      ctx.fillRect(-width * 0.43, -height * 0.18, width * 0.86, height * 0.09);
    }
  }

  renderSites(ctx) {
    const nearbyId = this.world.nearbySiteId;
    for (const site of this.world.getVisibleSites()) {
      const isNearby = site.id === nearbyId;
      if (site.type === "expedition_gate") {
        this.renderGate(ctx, site, isNearby);
        continue;
      }
      const data = this.territorySystem.buildingData[site.type];
      const building = this.territorySystem.getBuildingByType(site.type);
      const unlocked = this.territorySystem.getBuildingUnlockState(site.type).unlocked;
      if (building) this.renderBuilding(ctx, site, data, building, isNearby);
      else this.renderConstructionSite(ctx, site, data, unlocked, isNearby);
    }
  }

  renderGate(ctx, site, nearby) {
    const y = this.world.groundY;
    const size = TERRITORY_BUILDING_RENDER_SIZES.expedition_gate;
    const image = this.buildingImages.expedition_gate;
    ctx.save();
    ctx.translate(site.x, y);
    ctx.fillStyle = nearby ? `${PATH_COLORS.gate}4d` : "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(0, -3, size.width * 0.43, nearby ? 17 : 12, 0, 0, Math.PI * 2);
    ctx.fill();
    if (nearby) {
      ctx.shadowColor = PATH_COLORS.gate;
      ctx.shadowBlur = 20;
    }
    if (image?.complete && image.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(image, -size.width / 2, -size.height, size.width, size.height);
    } else {
      ctx.fillStyle = "#1b1b22";
      this.roundRectPath(ctx, -size.width / 2, -size.height, size.width, size.height, 6);
      ctx.fill();
      ctx.strokeStyle = "#d7a45f";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    this.renderSiteNameplate(
      ctx,
      "次元探索门",
      "和宠物一起去冒险",
      PATH_COLORS.gate,
      -size.height - 48
    );
    ctx.restore();
  }

  renderConstructionSite(ctx, site, data, unlocked, nearby) {
    const y = this.world.groundY;
    const color = PATH_COLORS[data.site.path] || "#ffd167";
    ctx.save();
    ctx.translate(site.x, y);
    ctx.globalAlpha = unlocked ? 0.92 : 0.38;
    if (nearby) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = "rgba(15, 14, 19, 0.92)";
    ctx.beginPath();
    ctx.ellipse(0, -4, 104, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.ellipse(0, -8, 73, 21, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.18;
    ctx.beginPath();
    ctx.moveTo(-54, -18);
    ctx.lineTo(-40, -101);
    ctx.quadraticCurveTo(0, -132, 40, -101);
    ctx.lineTo(54, -18);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = unlocked ? 0.92 : 0.38;
    ctx.fillStyle = "#17151b";
    ctx.beginPath();
    ctx.arc(0, -58, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "center";
    ctx.fillText(unlocked ? "＋" : "♡", 0, -49);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    this.renderSiteNameplate(
      ctx,
      unlocked ? `布置${data.name}` : "灵感还未解锁",
      unlocked ? "点击开启梦幻设施" : `庭院需要 R${data.site.requiredRank}`,
      color,
      -178
    );
    ctx.restore();
  }

  renderSiteNameplate(ctx, title, detail, color, anchorY = 7) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.48)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(13, 13, 18, 0.94)";
    this.roundRectPath(ctx, -78, anchorY, 156, 42, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `${color}b8`;
    ctx.lineWidth = 2;
    this.roundRectPath(ctx, -78, anchorY, 156, 42, 14);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff0cd";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText(title, 0, anchorY + 17);
    ctx.fillStyle = color;
    ctx.font = "bold 9px Arial, sans-serif";
    ctx.fillText(detail, 0, anchorY + 33);
  }

  renderBuilding(ctx, site, data, building, nearby) {
    const y = this.world.groundY;
    const color = PATH_COLORS[data.site.path] || "#ffd167";
    const baseSize = TERRITORY_BUILDING_RENDER_SIZES[site.type] || { width: 180, height: 170 };
    const levelScale = site.type === "main_base"
      ? 1 + Math.min(0.08, Math.max(0, this.territorySystem.rank - 1) * 0.016)
      : 1 + Math.min(0.12, Math.max(0, building.level - 1) * 0.03);
    const width = baseSize.width * levelScale;
    const height = baseSize.height * levelScale;
    const pulse = nearby ? 1 + Math.sin(performance.now() / 180) * 0.025 : 1;
    ctx.save();
    ctx.translate(site.x, y);
    ctx.scale(pulse, pulse);

    ctx.fillStyle = nearby ? `${color}4d` : "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(0, -3, width * 0.43, nearby ? 17 : 12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (nearby) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
    }
    const image = this.buildingImages[site.type];
    if (image?.complete && image.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(image, -width / 2, -height, width, height);
      if (building.level > 1) {
        const stars = Math.min(5, building.level);
        ctx.fillStyle = "#ffd85c";
        ctx.font = `bold ${Math.max(10, width * 0.04)}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText("✦".repeat(stars), 0, -height - 7);
      }
    } else {
      this.renderModernBuilding(ctx, site.type, width, height, building.level);
    }
    ctx.shadowBlur = 0;

    this.renderSiteNameplate(
      ctx,
      data.name,
      site.type === "main_base" ? `庭院 R${this.territorySystem.rank}` : `设施 Lv.${building.level}`,
      color,
      -height - 48
    );

    if (data.effects?.type === "production") {
      const pending = this.territorySystem.getProductionSnapshot().buildings.find((item) => item.type === site.type)?.amount || 0;
      if (pending > 0) {
        ctx.fillStyle = "#ffd167";
        ctx.beginPath();
        ctx.arc(width / 2 - 13, -height + 14, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#17120a";
        ctx.font = "bold 11px Arial";
        ctx.fillText(this.formatNumber(pending), width / 2 - 13, -height + 18);
      }
    }
    ctx.restore();
  }

  renderPlayer(ctx) {
    const player = this.world.player;
    const state = this.world.activity ? "attack" : player.moving ? "move" : "idle";
    const sprite = this.playerSystem?.playerSprites?.[state] || this.playerSystem?.playerSprites?.idle;
    const image = sprite?.image;
    const frameCount = sprite?.frameCount || this.playerSystem?.spriteFrameCount || 12;
    const frameSize = sprite?.frameSize || this.playerSystem?.spriteFrameSize || 256;
    const frameIndex = Math.floor(performance.now() / (sprite?.frameDuration || 150)) % frameCount;
    const renderWidth = 88;
    const renderHeight = 88;
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.beginPath();
    ctx.ellipse(0, 25, 25, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (player.facing < 0) ctx.scale(-1, 1);
    if (image?.complete && image.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = "rgba(247, 182, 47, 0.28)";
      ctx.shadowBlur = 6;
      ctx.drawImage(
        image,
        frameIndex * frameSize,
        0,
        frameSize,
        frameSize,
        -renderWidth / 2,
        -renderHeight / 2 - 10,
        renderWidth,
        renderHeight
      );
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = "#f7b62f";
      ctx.fillRect(-20, -40, 40, 60);
    }
    ctx.restore();
  }

  renderFollowers(ctx) {
    for (const follower of this.world.followers) {
      const state = this.world.player.moving ? "move" : "idle";
      const sheet = this.petSystem?.petAnimationSheets?.[follower.templateId]?.[state]
        || this.petSystem?.petAnimationSheets?.[follower.templateId]?.idle;
      const frameDuration = this.petSystem?.getPetFrameDuration?.(state) || 100;
      const frameCount = this.petSystem?.spriteFrameCount || 12;
      const frameSize = this.petSystem?.spriteFrameSize || 256;
      const frameIndex = Math.floor(
        (performance.now() + follower.phase * frameDuration * 1.6) / frameDuration
      ) % frameCount;
      ctx.save();
      ctx.translate(follower.x + follower.width / 2, follower.y + follower.height / 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
      ctx.beginPath();
      ctx.ellipse(0, 15, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (follower.facing < 0) ctx.scale(-1, 1);
      if (sheet?.complete && sheet.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sheet, frameIndex * frameSize, 0, frameSize, frameSize, -30, -34, 60, 60);
      } else {
        const fallbackImage = this.petSystem?.petImages?.[follower.templateId];
        if (fallbackImage?.complete && fallbackImage.naturalWidth > 0) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(fallbackImage, -30, -34, 60, 60);
        } else {
          const template = this.petSystem?.getTemplate?.(follower.templateId);
          ctx.font = "30px Arial";
          ctx.textAlign = "center";
          ctx.fillText(template?.emoji || "●", 0, 8);
        }
      }
      ctx.restore();
    }
  }

  renderWorldOverlay(ctx) {
    if (this.world.activity) {
      const activity = this.world.activity;
      const ratio = 1 - activity.remainingMs / activity.durationMs;
      const width = Math.min(420, this.canvas.width * 0.46);
      const x = (this.canvas.width - width) / 2;
      const y = this.canvas.height * 0.18;
      ctx.fillStyle = "rgba(10, 10, 14, 0.92)";
      this.roundRectPath(ctx, x - 12, y - 30, width + 24, 62, 20);
      ctx.fill();
      ctx.fillStyle = "#2d2424";
      this.roundRectPath(ctx, x, y, width, 11, 6);
      ctx.fill();
      const progress = ctx.createLinearGradient(x, 0, x + width, 0);
      progress.addColorStop(0, "#bd2d32");
      progress.addColorStop(1, "#f7b62f");
      ctx.fillStyle = progress;
      this.roundRectPath(ctx, x, y, width * ratio, 11, 6);
      ctx.fill();
      ctx.fillStyle = "#fff0cd";
      ctx.font = "bold 15px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${activity.label} ${Math.ceil(activity.remainingMs / 1000)}秒`, this.canvas.width / 2, y - 9);
    }
    this.renderMinimap(ctx);
  }

  renderMinimap(ctx) {
    const layout = this.getMinimapLayout();
    const { x, y, width, height, frameX, frameY, frameWidth, frameHeight } = layout;
    const scale = width / this.world.width;
    ctx.save();
    ctx.fillStyle = "rgba(9, 9, 13, 0.92)";
    this.roundRectPath(ctx, frameX, frameY, frameWidth, frameHeight, 14);
    ctx.fill();
    ctx.strokeStyle = "#f2a546";
    ctx.lineWidth = 2;
    this.roundRectPath(ctx, frameX, frameY, frameWidth, frameHeight, 14);
    ctx.stroke();
    ctx.fillStyle = "#fff0cd";
    ctx.font = "bold 10px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`R${this.territorySystem.rank} 梦幻庭院`, x, y - 7);
    const mapGradient = ctx.createLinearGradient(0, y, 0, y + height);
    mapGradient.addColorStop(0, "#4a3029");
    mapGradient.addColorStop(1, "#24191a");
    ctx.fillStyle = mapGradient;
    this.roundRectPath(ctx, x, y, width, height, 9);
    ctx.fill();
    for (const site of this.world.getVisibleSites()) {
      const built = site.type === "expedition_gate" || this.territorySystem.getBuildingByType(site.type);
      ctx.fillStyle = built ? (PATH_COLORS[site.path] || "#fff0cd") : "#69636a";
      ctx.beginPath();
      ctx.arc(x + site.x * scale, y + height / 2, built ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const center = this.getWorldPlayerCenter();
    ctx.fillStyle = "#fff0cd";
    ctx.strokeStyle = "#111116";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + center.x * scale, y + height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  getMinimapLayout() {
    const width = Math.min(220, this.canvas.width * 0.19);
    const height = 42;
    const framePaddingX = 8;
    const frameHeaderHeight = 20;
    const frameFooterPadding = 10;
    const rightInset = Math.max(24, Math.round(this.canvas.width * 0.025));
    const topInset = Math.max(12, Math.round(this.canvas.height * 0.015));
    const x = this.canvas.width - width - framePaddingX - rightInset;
    const y = topInset + frameHeaderHeight;
    return {
      x,
      y,
      width,
      height,
      frameX: x - framePaddingX,
      frameY: y - frameHeaderHeight,
      frameWidth: width + framePaddingX * 2,
      frameHeight: height + frameHeaderHeight + frameFooterPadding,
      rightInset,
      topInset,
    };
  }

  // Compatibility entry points retained for controller-contract and legacy calls.
  renderGrid() {
    this.render();
  }

  handleBuild(buildingType) {
    const data = this.territorySystem.buildingData[buildingType];
    if (!data) return { success: false, reason: "无效建筑" };
    const result = this.territorySystem.buildBuilding(buildingType, data.site.slotIndex);
    this.handleActionResult(result);
    this.updateDisplay();
    return result;
  }
}
