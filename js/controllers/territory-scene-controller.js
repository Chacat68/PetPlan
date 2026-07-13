import { CameraSystem } from "../modules/camera-system.js?v=territory-world-20260712a";
import { TerritoryWorldSystem } from "../modules/territory-world-system.js?v=territory-world-20260712a";
import {
  TERRITORY_BUILDING_ART_SOURCES,
  TERRITORY_BUILDING_RENDER_SIZES,
  TERRITORY_DISTRICT_ART,
  TERRITORY_SCENE_ART_SOURCES,
} from "../modules/territory-art-config.js?v=territory-ground-unified-20260713a";

const PATH_COLORS = Object.freeze({
  core: "#ffd167",
  hero: "#ff8a62",
  companion: "#72d7ff",
  territory: "#8dffb5",
  gate: "#c38cff",
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
    this.sceneImages = this.loadSceneImages();
    this.buildingImages = Object.fromEntries(
      Object.keys(TERRITORY_BUILDING_ART_SOURCES).map((type) => [type, this.sceneImages[type]])
    );
    this.reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
  }

  loadSceneImages() {
    if (typeof Image !== "function") return {};
    const sources = {
      ...TERRITORY_SCENE_ART_SOURCES,
      ...TERRITORY_BUILDING_ART_SOURCES,
    };
    return Object.fromEntries(Object.entries(sources).map(([type, src]) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (this.isSceneActive) this.render();
      };
      image.src = src;
      return [type, image];
    }));
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
    document.getElementById("territory-context-panel")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-territory-action]");
      if (!button) return;
      this.handleContextAction(button.dataset.territoryAction);
    }, { signal });

    if (typeof ResizeObserver === "function" && this.canvas) {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(this.canvas.parentElement);
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
      this.setEventFeed(settlement.extracted
        ? `远征队已返航：带回 ${this.formatNumber(settlement.coins)} 金币与 ${this.formatNumber(settlement.crystals)} 水晶。`
        : "远征队返回基地休整，本次只保留了部分收益。"
      );
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
    return summary;
  }

  updateWorld(deltaTime) {
    this.world.syncFollowers(this.petSystem?.equippedPets || []);
    const state = this.world.update(deltaTime);
    const completed = this.world.consumeCompletedActivity();
    if (completed) {
      const result = this.territorySystem.performActivity(completed.buildingType);
      this.handleActionResult(result);
      this.updateDisplay();
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
    const prompt = document.getElementById("territory-nearby-prompt");
    if (!site) {
      if (interact) interact.disabled = true;
      if (label) label.textContent = "靠近建筑后交互";
      if (detail) detail.textContent = "A/D、方向键或点击地面移动";
      if (prompt) prompt.hidden = true;
      return;
    }
    const name = site.type === "expedition_gate"
      ? "远征入口"
      : this.territorySystem.buildingData[site.type]?.name || "基地设施";
    if (interact) interact.disabled = false;
    if (label) label.textContent = `与${name}交互`;
    if (detail) detail.textContent = "按 E 或点击此按钮";
    if (prompt) {
      prompt.hidden = false;
      prompt.textContent = `E · ${name}`;
    }
  }

  openNearbyContext() {
    const site = this.world.getNearbySite();
    if (!site) {
      this.setEventFeed("继续靠近建筑或远征入口后再进行交互。");
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
      if (kicker) kicker.textContent = "远征入口";
      if (title) title.textContent = "前往禁区";
      if (detail) detail.textContent = "带上当前基地准备效果，进入可自由探索的远征世界。";
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
      const button = this.showContextAction("build", type === "main_base" ? "修复主基地" : "开始建造");
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
        const activityButton = this.showContextAction("activity", this.territorySystem.getActivityDefinition(data.activity)?.label || "基地活动");
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
    if (!this.world.activity && type) this.renderContextPanel(type);
  }

  handleActionResult(result) {
    if (!result) return;
    if (result.message) {
      this.setEventFeed(result.message);
      this.uiSystem?.showToast(result.message, result.success ? "success" : "info");
    }
    this.resourceSystem?.updateDisplay?.();
  }

  setEventFeed(message) {
    const feed = document.getElementById("territory-event-feed");
    if (feed && message) feed.textContent = message;
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
    if (!this.territorySystem.getBuildingByType("main_base")) {
      title.textContent = "修复主基地";
      detail.textContent = "前往中央主基地遗迹并进行交互";
      return;
    }
    const promotion = this.territorySystem.canExpand();
    if (promotion.success) {
      title.textContent = `领地可以升阶为 R${promotion.next.rank}`;
      detail.textContent = "返回主基地完成升阶，开放新的基地区域";
      return;
    }
    const pending = summary.production;
    if ((pending.coins || 0) + (pending.crystals || 0) > 0) {
      title.textContent = "基地储备可以收取";
      detail.textContent = `工坊与矿区共储备 ${this.formatNumber(pending.coins)} 金币、${this.formatNumber(pending.crystals)} 水晶`;
      return;
    }
    const buildable = this.territorySystem.getBuildingEntries().find(([type, data]) => (
      !this.territorySystem.getBuildingByType(type) &&
      data.site.slotIndex < summary.unlockedSlots &&
      this.territorySystem.getBuildingUnlockState(type).unlocked
    ));
    if (buildable) {
      title.textContent = `建设${buildable[1].name}`;
      detail.textContent = `前往${this.getPathLabel(buildable[1].site.path)}分区查看施工点`;
      return;
    }
    const missing = summary.rankRequirements?.find((check) => !check.met);
    if (missing) {
      title.textContent = `推进${missing.label}`;
      detail.textContent = `${this.formatNumber(missing.value)} / ${this.formatNumber(missing.target)}，完成后可继续领地升阶`;
      return;
    }
    title.textContent = "完成基地准备后进入远征";
    detail.textContent = "训练、祈福或制作补给，再前往西侧远征入口";
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
      main_base: `领地 R${this.territorySystem.rank}`,
      training_ground: `主角攻击 +${level * 4}`,
      temple: `远征防御 +${level * 3} · 宠物冷却 -${Math.min(20, level * 2)}%`,
      workshop: `金币储备 ${level * 45}/分钟 · 远征金币 +${level * 3}%`,
      barracks: `攻击/防御 +${level * 3}`,
      library: `远征经验 +${Math.min(30, level * 4)}%`,
      crystal_mine: `水晶储备 ${level * 4}/2分钟`,
    };
    return effects[type] || "基地增益";
  }

  getPathLabel(path) {
    const labels = { core: "核心区", hero: "先攻区", companion: "协同区", territory: "拓域区", gate: "远征区" };
    return labels[path] || "基地设施";
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
      const scale = Math.max(height / sky.naturalHeight, (width + 180) / sky.naturalWidth);
      const drawWidth = sky.naturalWidth * scale;
      const drawHeight = sky.naturalHeight * scale;
      const offset = -((camera.x * 0.055) % drawWidth);
      const y = height - drawHeight;
      for (let x = offset - drawWidth; x < width + drawWidth; x += drawWidth) {
        ctx.drawImage(sky, x, y, drawWidth, drawHeight);
      }
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#102839");
      gradient.addColorStop(1, "#1b3037");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.fillStyle = `rgba(12, 28, 34, ${Math.max(0, 0.18 - rank * 0.025)})`;
    ctx.fillRect(0, 0, width, height);
  }

  renderWorldScenery(ctx) {
    const groundY = this.world.groundY;
    const ground = this.sceneImages.ground;
    if (ground?.complete && ground.naturalWidth > 0) {
      const tileWidth = 760;
      const tileHeight = tileWidth * (ground.naturalHeight / ground.naturalWidth);
      const y = groundY - tileHeight * 0.39;
      for (let x = 0; x < this.world.width + tileWidth; x += tileWidth - 1) {
        ctx.drawImage(ground, x, y, tileWidth, tileHeight);
      }
    } else {
      ctx.fillStyle = "#182a2c";
      ctx.fillRect(0, groundY - 5, this.world.width, this.world.height - groundY + 5);
    }

    const marker = this.sceneImages.districtMarker;
    TERRITORY_DISTRICT_ART.forEach((district) => {
      if (district.x > this.world.width) return;
      const color = PATH_COLORS[district.path] || "#ffd167";
      ctx.save();
      ctx.translate(district.markerX, groundY);
      if (marker?.complete && marker.naturalWidth > 0) {
        ctx.globalAlpha = 0.88;
        ctx.drawImage(marker, -31, -112, 62, 112);
      }
      ctx.fillStyle = color;
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(district.label, 0, -54);
      ctx.restore();
    });

    const lamp = this.sceneImages.lamp;
    for (let x = 90; x < this.world.width; x += 260) {
      if (lamp?.complete && lamp.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = this.territorySystem.rank >= 1 ? 0.9 : 0.45;
        if (this.territorySystem.rank >= 1) {
          ctx.shadowColor = "rgba(255, 186, 92, 0.8)";
          ctx.shadowBlur = 12;
        }
        ctx.drawImage(lamp, x - 33, groundY - 108, 66, 108);
        ctx.restore();
      }
    }

    if (this.territorySystem.rank < 5) {
      const barrier = this.sceneImages.frontierBarrier;
      if (barrier?.complete && barrier.naturalWidth > 0) {
        ctx.drawImage(barrier, this.world.width - 182, groundY - 166, 170, 166);
      }
      ctx.fillStyle = "#ffd167";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "right";
      ctx.fillText(`R${this.territorySystem.rank + 1} 后开放`, this.world.width - 34, groundY - 176);
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
    const image = this.sceneImages.expeditionGate;
    ctx.save();
    ctx.translate(site.x, y);
    if (nearby) {
      ctx.shadowColor = PATH_COLORS.gate;
      ctx.shadowBlur = 20;
    }
    if (image?.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -112, -198, 224, 198);
    }
    ctx.shadowBlur = 0;
    this.renderSiteNameplate(ctx, "远征入口", "禁区通道", PATH_COLORS.gate);
    ctx.restore();
  }

  renderConstructionSite(ctx, site, data, unlocked, nearby) {
    const y = this.world.groundY;
    const color = PATH_COLORS[data.site.path] || "#ffd167";
    const image = this.sceneImages.construction;
    ctx.save();
    ctx.translate(site.x, y);
    ctx.globalAlpha = unlocked ? 0.92 : 0.38;
    if (nearby) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
    }
    if (image?.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -112, -142, 224, 142);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    this.renderSiteNameplate(
      ctx,
      unlocked ? `建设${data.name}` : "蓝图未开放",
      unlocked ? "施工准备就绪" : `需要 R${data.site.requiredRank}`,
      color
    );
    ctx.restore();
  }

  renderSiteNameplate(ctx, title, detail, color) {
    ctx.fillStyle = "rgba(10, 16, 20, 0.9)";
    ctx.fillRect(-70, 7, 140, 38);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f2f5f6";
    ctx.font = "bold 13px Arial";
    ctx.fillText(title, 0, 22);
    ctx.fillStyle = color;
    ctx.font = "bold 10px Arial";
    ctx.fillText(detail, 0, 38);
  }

  renderBuilding(ctx, site, data, building, nearby) {
    const y = this.world.groundY;
    const color = PATH_COLORS[data.site.path] || "#ffd167";
    const image = this.buildingImages[site.type];
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

    ctx.fillStyle = nearby ? `${color}42` : "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, -3, width * 0.43, nearby ? 17 : 12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (image?.complete && image.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (nearby) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
      }
      ctx.drawImage(image, -width / 2, -height, width, height);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = "#202a33";
      ctx.strokeStyle = color;
      ctx.lineWidth = nearby ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(-width * 0.42, 0);
      ctx.lineTo(-width * 0.38, -height * 0.64);
      ctx.lineTo(0, -height);
      ctx.lineTo(width * 0.38, -height * 0.64);
      ctx.lineTo(width * 0.42, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    this.renderSiteNameplate(
      ctx,
      data.name,
      site.type === "main_base" ? `领地 R${this.territorySystem.rank}` : `设施 Lv.${building.level}`,
      color
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
    const frameIndex = Math.floor(performance.now() / (sprite?.frameDuration || 150)) % (sprite?.frameCount || 4);
    const renderWidth = 88;
    const renderHeight = 88;
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.fillStyle = "rgba(4, 9, 12, 0.46)";
    ctx.beginPath();
    ctx.ellipse(0, 25, 25, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (player.facing < 0) ctx.scale(-1, 1);
    if (image?.complete && image.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = "rgba(35, 143, 154, 0.2)";
      ctx.shadowBlur = 5;
      ctx.drawImage(image, frameIndex * 512, 0, 512, 512, -renderWidth / 2, -renderHeight / 2 - 10, renderWidth, renderHeight);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = "#ffd167";
      ctx.fillRect(-20, -40, 40, 60);
    }
    ctx.restore();
  }

  renderFollowers(ctx) {
    for (const follower of this.world.followers) {
      const state = this.world.player.moving ? "move" : "idle";
      const sheet = this.petSystem?.petAnimationSheets?.[follower.templateId]?.[state]
        || this.petSystem?.petAnimationSheets?.[follower.templateId]?.idle;
      const frameIndex = Math.floor((performance.now() + follower.phase * 240) / 150) % 4;
      ctx.save();
      ctx.translate(follower.x + follower.width / 2, follower.y + follower.height / 2);
      ctx.fillStyle = "rgba(4, 9, 12, 0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 15, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (follower.facing < 0) ctx.scale(-1, 1);
      if (sheet?.complete && sheet.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sheet, frameIndex * 512, 0, 512, 512, -30, -34, 60, 60);
      } else {
        const template = this.petSystem?.getTemplate?.(follower.templateId);
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.fillText(template?.emoji || "●", 0, 8);
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
      ctx.fillStyle = "rgba(5, 8, 12, 0.86)";
      ctx.fillRect(x - 12, y - 30, width + 24, 58);
      ctx.fillStyle = "#1f2935";
      ctx.fillRect(x, y, width, 10);
      ctx.fillStyle = "#ffd167";
      ctx.fillRect(x, y, width * ratio, 10);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`${activity.label} ${Math.ceil(activity.remainingMs / 1000)}秒`, this.canvas.width / 2, y - 9);
    }
    this.renderMinimap(ctx);
  }

  renderMinimap(ctx) {
    const width = Math.min(220, this.canvas.width * 0.19);
    const height = 42;
    const x = this.canvas.width - width - 16;
    const y = 70;
    const scale = width / this.world.width;
    ctx.save();
    ctx.fillStyle = "rgba(5, 8, 12, 0.84)";
    ctx.fillRect(x - 8, y - 20, width + 16, height + 30);
    ctx.strokeStyle = "#ffd167";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 8, y - 20, width + 16, height + 30);
    ctx.fillStyle = "#dfe9ef";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`R${this.territorySystem.rank} 基地地图`, x, y - 7);
    ctx.fillStyle = "#25322b";
    ctx.fillRect(x, y, width, height);
    for (const site of this.world.getVisibleSites()) {
      const built = site.type === "expedition_gate" || this.territorySystem.getBuildingByType(site.type);
      ctx.fillStyle = built ? (PATH_COLORS[site.path] || "#ffffff") : "#66717a";
      ctx.beginPath();
      ctx.arc(x + site.x * scale, y + height / 2, built ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const center = this.getWorldPlayerCenter();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + center.x * scale, y + height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
