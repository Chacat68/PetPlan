/**
 * Owns fate-table purchases, display refreshes, coin feedback, and helper motion.
 * Recommendation and territory rules remain delegated to their scene controllers.
 */
export class FateSceneController {
  constructor({
    fateCoinSystem,
    playerSystem,
    petSystem,
    resourceSystem,
    uiSystem,
    shopController,
    territoryController,
    getCurrentScene = () => "fate",
    getProgressionContext = () => ({}),
    onChanged = () => {},
  } = {}) {
    this.fateCoinSystem = fateCoinSystem;
    this.playerSystem = playerSystem;
    this.petSystem = petSystem;
    this.resourceSystem = resourceSystem;
    this.uiSystem = uiSystem;
    this.shopController = shopController;
    this.territoryController = territoryController;
    this.getCurrentScene = getCurrentScene;
    this.getProgressionContext = getProgressionContext;
    this.onChanged = onChanged;

    this.dropSerial = 0;
    this.helperWave = 0;
    this.abortController = null;
    this.waveTimers = new Set();
    this.resizeObserver = null;
    this.layoutFrame = 0;
    this.layoutSize = { width: 0, height: 0 };
    this.isSceneActive = true;
  }

  bind() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    const { signal } = this.abortController;
    const actions = {
      "fate-upgrade-assistant-power-btn": "assistantPower",
      "fate-buy-gold-btn": "gold",
      "fate-buy-assistant-btn": "assistant",
      "fate-upgrade-manual-btn": "manual",
      "fate-upgrade-speed-btn": "speed",
      "fate-train-hero-btn": "hero",
      "fate-train-pet-btn": "pet",
    };

    Object.entries(actions).forEach(([id, action]) => {
      document.getElementById(id)?.addEventListener(
        "click",
        () => this.handleUpgrade(action),
        { signal }
      );
    });
    document.getElementById("fate-skill-tree-btn")?.addEventListener(
      "click",
      () => this.openManualUpgradeCard(),
      { signal }
    );

    document.querySelectorAll(".fate-table-coin").forEach((coin) => {
      this.bindTableCoin(coin);
      if (!coin._fateFaceTimer) {
        this.startFateTableCoinFaceLoop(coin);
      }
    });

    const layer = document.getElementById("fate-coin-drop-layer");
    if (layer && typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => {
        this.scheduleFateLayoutRefresh();
      });
      this.resizeObserver.observe(layer);
    } else {
      window.addEventListener("resize", () => this.scheduleFateLayoutRefresh(), {
        signal,
      });
    }
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.layoutFrame) {
      window.cancelAnimationFrame(this.layoutFrame);
      this.layoutFrame = 0;
    }

    this.abortController?.abort();
    this.abortController = null;

    this.waveTimers.forEach((timer) => window.clearTimeout(timer));
    this.waveTimers.clear();

    const layer = document.getElementById("fate-coin-drop-layer");
    layer?.querySelectorAll(".fate-helper").forEach((helper) => {
      this.clearFateHelperTimers(helper, { reset: true });
    });
    layer?.querySelectorAll(".fate-table-coin").forEach((coin) => {
      this.clearFateTableCoinFaceLoop(coin);
      if (coin._fateSpawnEndHandler) {
        coin
          .querySelector(".fate-table-coin-visual")
          ?.removeEventListener("animationend", coin._fateSpawnEndHandler);
        coin._fateSpawnEndHandler = null;
      }
      coin.classList.remove("spawned", "clicked");
    });
    layer?.querySelectorAll(".fate-ground-coin").forEach((coin) => {
      if (coin._fateDropEndHandler) {
        coin.removeEventListener("animationend", coin._fateDropEndHandler);
        coin._fateDropEndHandler = null;
      }
    });
    layer?.querySelectorAll(".fate-helper-step").forEach((step) => step.remove());
  }

  resetTransientRuntime() {
    this.waveTimers.forEach((timer) => window.clearTimeout(timer));
    this.waveTimers.clear();

    if (this.layoutFrame) {
      window.cancelAnimationFrame(this.layoutFrame);
      this.layoutFrame = 0;
    }

    const layer = document.getElementById("fate-coin-drop-layer");
    layer?.querySelectorAll(".fate-helper").forEach((helper) => {
      this.clearFateHelperTimers(helper, { reset: true });
      helper.remove();
    });
    layer?.querySelectorAll(".fate-table-coin").forEach((coin) => {
      this.clearFateTableCoinFaceLoop(coin);
      if (coin._fateSpawnEndHandler) {
        const visual = coin.querySelector(".fate-table-coin-visual");
        visual?.removeEventListener("animationend", coin._fateSpawnEndHandler);
      }
      coin.remove();
    });
    layer
      ?.querySelectorAll(".fate-ground-coin, .fate-helper-step")
      .forEach((item) => {
        item.remove();
      });

    document.getElementById("fate-result-feed")?.replaceChildren();
    const status = document.getElementById("fate-result-status");
    if (status) status.textContent = "";
    this.dropSerial = 0;
    this.helperWave = 0;
    this.layoutSize = { width: 0, height: 0 };
  }

  setSceneActive(active) {
    this.isSceneActive = Boolean(active);
    if (!this.isSceneActive) {
      const status = document.getElementById("fate-result-status");
      if (status) status.textContent = "";
    }
    const coins = document.querySelectorAll(".fate-table-coin");
    coins.forEach((coin) => {
      if (this.isSceneActive) this.startFateTableCoinFaceLoop(coin);
      else this.clearFateTableCoinFaceLoop(coin);
    });
  }

  scheduleFateLayoutRefresh() {
    if (this.layoutFrame) return;
    this.layoutFrame = window.requestAnimationFrame(() => {
      this.layoutFrame = 0;
      this.refreshFateLayout();
    });
  }

  refreshFateLayout() {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer || layer.clientWidth <= 0 || layer.clientHeight <= 0) return;

    const width = layer.clientWidth;
    const height = layer.clientHeight;
    const oldWidth = this.layoutSize.width || width;
    const oldHeight = this.layoutSize.height || height;

    this.syncFateTableCoins(this.fateCoinSystem?.fateCoins || 1);
    const coins = Array.from(layer.querySelectorAll(".fate-table-coin"));
    coins.forEach((coin) => {
      const ratioX =
        Number(coin.dataset.xRatio) || Number(coin.dataset.x || 0) / oldWidth;
      const ratioY =
        Number(coin.dataset.yRatio) || Number(coin.dataset.y || 0) / oldHeight;
      const x = this.clamp(ratioX * width, width * 0.35, width * 0.68);
      const y = this.clamp(ratioY * height, height * 0.26, height * 0.72);
      coin.dataset.x = String(x);
      coin.dataset.y = String(y);
      coin.dataset.xRatio = String(x / width);
      coin.dataset.yRatio = String(y / height);
      coin.style.left = `${x}px`;
      coin.style.top = `${y}px`;
    });

    layer.querySelectorAll(".fate-helper").forEach((helper) => {
      const state = helper._fateHelperState;
      if (!state) return;
      this.clearFateHelperTimers(helper, { reset: true });
      const x = this.clamp((state.x / oldWidth) * width, 32, width - 32);
      const y = this.clamp((state.y / oldHeight) * height, 34, height - 26);
      this.setFateHelperPosition(helper, x, y);
    });
    layer
      .querySelectorAll(".fate-ground-coin, .fate-helper-step")
      .forEach((item) => {
        item.remove();
      });

    this.layoutSize = { width, height };
  }

  bindTableCoin(coin) {
    if (!coin || !this.abortController) return;
    coin.addEventListener("click", () => this.handleFateFlip(coin), {
      signal: this.abortController.signal,
    });
  }

  handleFateFlip(coin) {
    if (!this.fateCoinSystem) return;
    if (coin?.dataset.settled === "true") return;

    const face = this.getFateTableCoinFace(coin);
    if (coin) {
      coin.dataset.settled = "true";
      coin.setAttribute("aria-disabled", "true");
      this.updateFateTableCoinAccessibility(coin);
    }
    const result = this.fateCoinSystem.manualFlip(face);
    if (coin) {
      this.playFateTableCoinClickFeedback(
        coin,
        face,
        this.getFateResultFaceAmount(result, face)
      );
    }
    this.addFateCoinDrops(result, { source: "manual" });
    this.addFateResult(result, { announce: true });
  }

  playFateTableCoinClickFeedback(coin, face, amount = 1) {
    if (!coin) return;

    coin.classList.remove("clicked");
    void coin.offsetWidth;
    coin.dataset.score = this.formatFateGainText(face, amount);
    coin.classList.add("clicked");
  }

  getFateResultFaceAmount(result, face) {
    if (!result) return 1;
    return face === "tails" ? result.tails || 0 : result.heads || 0;
  }

  formatFateGainText(face, amount = 1) {
    const value = Math.max(1, Math.floor(amount || 1));
    return face === "tails" ? `获得反面 +${value}` : `获得正面 +${value}`;
  }

  handleAutoFlip(result) {
    if (!result || result.cycles <= 0 || result.flips <= 0) return;
    if (this.getCurrentScene() !== "fate") return;

    this.addFateResult(result, { announce: false });
    this.addFateCoinDrops(result, { source: "auto" });
    if (this.canAnimateFateAssistantBatch()) {
      this.queueFateHelperClicks(result.cycles);
    }
  }

  handleFateAutoFlip(request) {
    return this.handleAutoFlip(request);
  }

  canAnimateFateAssistantBatch() {
    if (this.getCurrentScene() !== "fate") return false;

    const layer = document.getElementById("fate-coin-drop-layer");
    return Boolean(
      layer?.querySelector(".fate-table-coin") &&
        layer?.querySelector(".fate-helper")
    );
  }

  handleUpgrade(action) {
    if (!this.fateCoinSystem) return;

    const handlers = {
      assistantPower: () => this.fateCoinSystem.upgradeAssistantPower(),
      gold: () => this.buyFateGoldCoin(),
      assistant: () => this.fateCoinSystem.buyAssistant(),
      manual: () => this.fateCoinSystem.upgradeManualPower(),
      speed: () => this.fateCoinSystem.upgradeAssistantSpeed(),
      hero: () => this.trainHeroWithFate(),
      pet: () => this.trainPetsWithFate(),
    };
    const handler = handlers[action];
    if (!handler) return;

    this.shopController?.requestRecommendationCommit?.();
    const result = handler();
    if (!result?.success) {
      this.shopController?.cancelRecommendationCommit?.();
    } else if (action === "hero" || action === "pet") {
      // Cross-system training uses a silent fate-resource debit, then refreshes
      // every dependent display once after the player/pet mutation is complete.
      this.onChanged({ action, result });
    }
    this.uiSystem?.showToast?.(
      result.message,
      result.success ? "success" : "error"
    );
    return result;
  }

  openManualUpgradeCard() {
    this.shopController?.setFateShopFilter?.("fate");
    const card = document.getElementById("fate-upgrade-manual-btn");
    card?.focus?.({ preventScroll: true });
  }

  handleFateUpgrade(action) {
    return this.handleUpgrade(action);
  }

  buyFateGoldCoin() {
    const beforeCount = this.fateCoinSystem.fateCoins;
    const result = this.fateCoinSystem.buyGoldCoin();

    if (result.success) {
      const addedCount = Math.max(
        1,
        this.fateCoinSystem.fateCoins - beforeCount
      );
      this.playNewFateTableCoinAnimation(addedCount);
    }

    return result;
  }

  playNewFateTableCoinAnimation(count = 1) {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const coins = Array.from(layer.querySelectorAll(".fate-table-coin"));
    const animatedCoins = coins.slice(-Math.max(1, Math.floor(count)));

    animatedCoins.forEach((coin) => {
      const visual = coin.querySelector(".fate-table-coin-visual");
      if (!visual) return;
      if (coin._fateSpawnEndHandler) {
        visual.removeEventListener("animationend", coin._fateSpawnEndHandler);
      }

      coin.classList.remove("spawned");
      void coin.offsetWidth;
      coin.classList.add("spawned");
      coin._fateSpawnEndHandler = (event) => {
        if (
          event.target !== visual ||
          event.animationName !== "fateTableCoinSpawn"
        ) {
          return;
        }

        coin.classList.remove("spawned");
        visual.removeEventListener("animationend", coin._fateSpawnEndHandler);
        coin._fateSpawnEndHandler = null;
      };
      visual.addEventListener("animationend", coin._fateSpawnEndHandler);
    });
  }

  getFateCoinReward() {
    const fateCoins = this.fateCoinSystem?.fateCoins || 1;
    return Math.max(10, Math.floor(25 * fateCoins));
  }

  getFateHeroTrainingCost() {
    return this.shopController.getFateHeroTrainingCost();
  }

  getFatePetTrainingCost() {
    return this.shopController.getFatePetTrainingCost();
  }

  exchangeFateForCoins() {
    if (!this.fateCoinSystem || !this.resourceSystem) {
      return { success: false, message: "资源系统未初始化" };
    }

    const cost = this.fateCoinSystem.getBuyGoldCoinCost();
    if (!this.fateCoinSystem.spend(cost)) {
      return { success: false, message: "正面不足" };
    }

    const reward = this.getFateCoinReward();
    this.resourceSystem.addCoins(reward);

    return {
      success: true,
      message: `金币 +${this.resourceSystem.formatNumber(reward)}`,
    };
  }

  trainHeroWithFate() {
    if (!this.fateCoinSystem || !this.playerSystem) {
      return { success: false, message: "训练系统未初始化" };
    }

    const cost = this.getFateHeroTrainingCost();
    if (!this.fateCoinSystem.spend(cost, { notify: false })) {
      return { success: false, message: "正面或反面不足" };
    }

    return this.playerSystem.applyFateTraining();
  }

  trainPetsWithFate() {
    if (!this.fateCoinSystem || !this.petSystem) {
      return { success: false, message: "宠物系统未初始化" };
    }

    if ((this.petSystem.equippedPets?.length || 0) === 0) {
      return { success: false, message: "没有装备宠物" };
    }

    const cost = this.getFatePetTrainingCost();
    if (!this.fateCoinSystem.spend(cost, { notify: false })) {
      return { success: false, message: "正面或反面不足" };
    }

    return this.petSystem.trainEquippedPets(1);
  }

  updateDisplay({ commitRecommendation = false } = {}) {
    if (!this.fateCoinSystem) return;

    const data = this.fateCoinSystem.getDisplayData();
    const format = (value) => this.fateCoinSystem.formatNumber(value);
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    const setDisabled = (id, disabled) => {
      const element = document.getElementById(id);
      if (element) element.disabled = disabled;
    };

    setText("fate-coins-display", format(data.fateCoins));
    setText("heads-display", format(data.heads));
    setText("tails-display", format(data.tails));
    setText("fate-total-flips-display", format(data.totalFlips));
    setText("fate-manual-power-display", format(data.manualPower));
    setText(
      "fate-auto-rate-display",
      `${data.autoFlipsPerSecond.toFixed(1)} / 秒`
    );
    setText(
      "fate-gold-effect",
      `硬币 ${format(data.fateCoins)} -> ${format(data.fateCoins + 1)}`
    );
    setText(
      "fate-assistant-effect",
      `自动 ${this.formatFateRate(data.autoFlipsPerSecond)} -> ${this.formatFateRate(
        this.getFateAutoRatePreview(data, {
          assistants: data.assistants + 1,
        })
      )}/秒`
    );
    setText(
      "fate-assistant-power-effect",
      data.assistants <= 0
        ? "需小助手"
        : `自动 ${this.formatFateRate(data.autoFlipsPerSecond)} -> ${this.formatFateRate(
            this.getFateAutoRatePreview(data, {
              assistantPower: data.assistantPower + 1,
            })
          )}/秒`
    );
    setText("fate-train-hero-effect", this.getFateHeroTrainingPreview());
    const equippedPetCount = this.petSystem?.equippedPets?.length || 0;
    const equippedPetLevelTotal =
      typeof this.petSystem?.getEquippedPetLevelTotal === "function"
        ? this.petSystem.getEquippedPetLevelTotal()
        : equippedPetCount;
    setText(
      "fate-train-pet-effect",
      equippedPetCount > 0
        ? `宠物 Lv ${equippedPetLevelTotal} -> ${
            equippedPetLevelTotal + equippedPetCount
          }`
        : "先装备宠物"
    );
    setText(
      "fate-upgrade-manual-effect",
      `点击 +${format(data.manualPower)} -> +${format(data.manualPower + 1)}`
    );
    setText(
      "fate-upgrade-speed-effect",
      this.getFateAssistantSpeedPreview(data)
    );

    setText(
      "fate-assistant-power-cost",
      data.assistants <= 0
        ? "先购买小助手"
        : this.fateCoinSystem.formatCost(data.costs.assistantPower)
    );
    setText(
      "fate-buy-assistant-cost",
      this.fateCoinSystem.formatCost(data.costs.assistant)
    );
    setText(
      "fate-buy-gold-cost",
      this.fateCoinSystem.formatCost(data.costs.goldCoin)
    );
    setText(
      "fate-upgrade-manual-cost",
      this.fateCoinSystem.formatCost(data.costs.manual)
    );
    setText(
      "fate-upgrade-speed-cost",
      data.assistants <= 0
        ? "先购买小助手"
        : data.autoInterval <= 750
          ? "已达上限"
          : this.fateCoinSystem.formatCost(data.costs.assistantSpeed)
    );
    setText(
      "fate-train-hero-cost",
      this.fateCoinSystem.formatCost(this.getFateHeroTrainingCost())
    );
    setText(
      "fate-train-pet-cost",
      this.fateCoinSystem.formatCost(this.getFatePetTrainingCost())
    );

    setDisabled(
      "fate-upgrade-assistant-power-btn",
      data.assistants <= 0 ||
        !this.fateCoinSystem.canAfford(data.costs.assistantPower)
    );
    setDisabled(
      "fate-buy-assistant-btn",
      !this.fateCoinSystem.canAfford(data.costs.assistant)
    );
    setDisabled(
      "fate-buy-gold-btn",
      !this.fateCoinSystem.canAfford(data.costs.goldCoin)
    );
    setDisabled(
      "fate-upgrade-manual-btn",
      !this.fateCoinSystem.canAfford(data.costs.manual)
    );
    setDisabled("fate-skill-tree-btn", false);
    setDisabled(
      "fate-upgrade-speed-btn",
      data.assistants <= 0 ||
        data.autoInterval <= 750 ||
        !this.fateCoinSystem.canAfford(data.costs.assistantSpeed)
    );
    setDisabled(
      "fate-train-hero-btn",
      !this.fateCoinSystem.canAfford(this.getFateHeroTrainingCost())
    );
    setDisabled(
      "fate-train-pet-btn",
      equippedPetCount === 0 ||
        !this.fateCoinSystem.canAfford(this.getFatePetTrainingCost())
    );

    this.syncFateTableCoins(data.fateCoins);
    this.syncFateHelpers(data.assistants);
    const territorySummary = this.territoryController?.syncProgress?.();
    const progressionContext = this.getProgressionContext(data);
    this.shopController?.update?.({
      data,
      territorySummary,
      progressionContext,
      commitRecommendation,
    });

    return data;
  }

  updateFateDisplay(options) {
    return this.updateDisplay(options);
  }

  getFateAutoRatePreview(data, overrides = {}) {
    return this.shopController.getFateAutoRatePreview(data, overrides);
  }

  formatFateRate(value) {
    return this.shopController.formatFateRate(value);
  }

  getFateHeroTrainingPreview() {
    return this.shopController.getFateHeroTrainingPreview();
  }

  getFateAssistantSpeedPreview(data) {
    return this.shopController.getFateAssistantSpeedPreview(data);
  }

  addFateResult(result, { announce = result?.source === "manual" } = {}) {
    const feed = document.getElementById("fate-result-feed");
    if (!feed || !result) return;

    const item = document.createElement("div");
    item.className = "fate-result";
    item.dataset.source = result.source || "unknown";
    item.setAttribute("aria-hidden", "true");
    if (result.face) {
      item.textContent = this.formatFateGainText(
        result.face,
        this.getFateResultFaceAmount(result, result.face)
      );
    } else {
      item.textContent = `${result.flips} 次: +${result.heads} 正面 / +${result.tails} 反面`;
    }
    feed.prepend(item);

    while (feed.children.length > 4) {
      feed.removeChild(feed.lastElementChild);
    }

    if (announce) {
      const status = document.getElementById("fate-result-status");
      if (status) status.textContent = item.textContent;
    }
  }

  addFateCoinDrops(result, options = {}) {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer || !result || result.flips <= 0) return;

    const width = layer.clientWidth;
    const height = layer.clientHeight;
    if (width <= 0 || height <= 0) return;

    const maxCoins = options.maxCoins || 10;
    const visualCount = Math.max(
      1,
      Math.min(maxCoins, Math.ceil(Math.sqrt(Math.min(result.flips, 144))))
    );
    const headsRatio = result.flips > 0 ? result.heads / result.flips : 0.5;
    const sourceY = height * (options.source === "auto" ? 0.18 : 0.24);
    const sourceX = width * 0.5;
    const laneMin = width * 0.31;
    const laneMax = width * 0.66;

    for (let i = 0; i < visualCount; i++) {
      const face = Math.random() < headsRatio ? "heads" : "tails";
      const startX = sourceX + (Math.random() - 0.5) * 34;
      const startY = sourceY + (Math.random() - 0.5) * 18;
      const landingX = laneMin + Math.random() * (laneMax - laneMin);
      const floorY = Math.min(
        height - 34,
        height * (0.74 + Math.random() * 0.18)
      );
      const fallDistance = Math.max(80, floorY - startY);
      const bounceHeight = 18 + Math.random() * 30;
      const duration = 720 + Math.random() * 190;
      const delay = i * 42 + Math.random() * 36;
      const scale = 0.82 + Math.random() * 0.28;
      const settleRotate = (Math.random() - 0.5) * 44;
      const driftX = landingX - startX;

      const coin = document.createElement("span");
      coin.className = `fate-ground-coin ${face} coin-variant-${
        this.dropSerial % 4
      }`;
      coin.setAttribute("aria-hidden", "true");
      coin.style.left = `${startX}px`;
      coin.style.top = `${startY}px`;
      coin.style.setProperty("--drift-x", `${driftX}px`);
      coin.style.setProperty(
        "--pre-impact-y",
        `${fallDistance - bounceHeight * 1.4}px`
      );
      coin.style.setProperty("--impact-y", `${fallDistance}px`);
      coin.style.setProperty(
        "--first-hop-y",
        `${fallDistance - bounceHeight}px`
      );
      coin.style.setProperty(
        "--second-hop-y",
        `${fallDistance - bounceHeight * 0.35}px`
      );
      coin.style.setProperty("--drop-time", `${duration}ms`);
      coin.style.setProperty("--drop-delay", `${delay}ms`);
      coin.style.setProperty("--coin-scale", scale.toFixed(2));
      coin.style.setProperty("--settle-rotate", `${settleRotate}deg`);

      const frame = document.createElement("span");
      frame.className = "fate-ground-coin-frame";
      frame.textContent = face === "heads" ? "正" : "反";
      coin.appendChild(frame);

      coin._fateDropEndHandler = (event) => {
        if (event.target !== coin || event.animationName !== "fateCoinDrop") {
          return;
        }

        coin.classList.add("settled");
        this.pruneFateFloorCoins(layer);
        coin.removeEventListener("animationend", coin._fateDropEndHandler);
        coin._fateDropEndHandler = null;
      };
      coin.addEventListener("animationend", coin._fateDropEndHandler);

      layer.appendChild(coin);
      this.dropSerial += 1;
    }

    this.pruneFateFloorCoins(layer);
  }

  pruneFateFloorCoins(layer) {
    const maxFloorCoins = 56;
    const groundCoins = Array.from(layer.querySelectorAll(".fate-ground-coin"));

    while (groundCoins.length > maxFloorCoins) {
      const coin = groundCoins.shift();
      if (coin) coin.remove();
    }
  }

  syncFateTableCoins(targetCount) {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const activeCoins = Array.from(layer.querySelectorAll(".fate-table-coin"));
    const logicalTarget = Math.max(1, Math.floor(targetCount || 1));
    const safeTarget = Math.min(
      logicalTarget,
      this.getFateTableCoinRenderLimit(layer)
    );
    layer.dataset.logicalCoinCount = String(logicalTarget);
    layer.dataset.renderedCoinCount = String(safeTarget);

    while (activeCoins.length > safeTarget) {
      const coin = activeCoins.pop();
      if (coin) {
        this.clearFateTableCoinFaceLoop(coin);
        if (coin._fateSpawnEndHandler) {
          coin
            .querySelector(".fate-table-coin-visual")
            ?.removeEventListener("animationend", coin._fateSpawnEndHandler);
          coin._fateSpawnEndHandler = null;
        }
        coin.remove();
      }
    }

    while (activeCoins.length < safeTarget) {
      const coin = this.createFateTableCoin(layer, activeCoins);
      if (!coin) return;
      activeCoins.push(coin);
    }

    activeCoins.forEach((coin, index) => {
      coin.dataset.coinIndex = String(index + 1);
      this.updateFateTableCoinAccessibility(coin);
    });

    this.layoutSize = {
      width: layer.clientWidth,
      height: layer.clientHeight,
    };
  }

  getFateTableCoinRenderLimit(layer) {
    if (layer.clientWidth < 520) return 8;
    if (layer.clientWidth < 760) return 12;
    return 18;
  }

  createFateTableCoin(layer, existingCoins = []) {
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    if (width <= 0 || height <= 0) return null;

    const coin = document.createElement("button");
    coin.type = "button";
    coin.className = "fate-table-coin";

    const point = this.findFateTableCoinPosition(layer, existingCoins);
    coin.dataset.x = String(point.x);
    coin.dataset.y = String(point.y);
    coin.dataset.xRatio = String(point.x / width);
    coin.dataset.yRatio = String(point.y / height);
    coin.style.left = `${point.x}px`;
    coin.style.top = `${point.y}px`;
    coin.style.setProperty(
      "--coin-rotate",
      `${(Math.random() - 0.5) * 18}deg`
    );
    coin.style.setProperty("--bounce-delay", `${Math.random() * -0.75}s`);
    this.setFateTableCoinFace(
      coin,
      Math.random() < 0.5 ? "heads" : "tails"
    );
    coin.innerHTML = `
      <span class="fate-table-coin-visual" aria-hidden="true">
        <span class="fate-table-coin-shadow"></span>
        <span class="fate-table-coin-body">
          <span class="fate-table-coin-face fate-table-coin-front">正</span>
          <span class="fate-table-coin-face fate-table-coin-back">反</span>
        </span>
      </span>
    `;
    this.bindTableCoin(coin);

    layer.appendChild(coin);
    if (this.abortController) {
      this.startFateTableCoinFaceLoop(coin);
    }
    return coin;
  }

  getFateTableCoinFace(coin) {
    return coin?.dataset.face === "tails" ? "tails" : "heads";
  }

  setFateTableCoinFace(coin, face) {
    const normalizedFace = face === "tails" ? "tails" : "heads";
    coin.dataset.face = normalizedFace;
    coin.dataset.settled = "false";
    coin.setAttribute("aria-disabled", "false");
    coin.dataset.score = this.formatFateGainText(normalizedFace);
    this.updateFateTableCoinAccessibility(coin);
  }

  updateFateTableCoinAccessibility(coin) {
    if (!coin) return;
    const face = this.getFateTableCoinFace(coin);
    const faceLabel = face === "tails" ? "反面" : "正面";
    const index = Math.max(1, Number(coin.dataset.coinIndex) || 1);
    const amount = Math.max(1, Math.floor(this.fateCoinSystem?.manualPower || 1));
    coin.setAttribute(
      "aria-label",
      coin.dataset.settled === "true"
        ? `硬币 ${index}，当前${faceLabel}已结算，等待翻面`
        : `硬币 ${index}，当前${faceLabel}，点击结算${faceLabel} +${amount}`
    );
  }

  startFateTableCoinFaceLoop(coin) {
    if (!coin || coin._fateFaceTimer || !this.isSceneActive) return;

    const flip = () => {
      coin._fateFaceTimer = 0;
      if (!coin.isConnected || !this.abortController) return;

      this.setFateTableCoinFace(
        coin,
        this.getFateTableCoinFace(coin) === "heads" ? "tails" : "heads"
      );
      coin._fateFaceTimer = window.setTimeout(
        flip,
        this.getFateTableCoinFaceDelay()
      );
    };

    coin._fateFaceTimer = window.setTimeout(
      flip,
      Math.min(600, this.getFateTableCoinFaceDelay() * 0.7) + Math.random() * 180
    );
  }

  getFateTableCoinFaceDelay() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      ? 1500
      : 525;
  }

  clearFateTableCoinFaceLoop(coin) {
    if (coin?._fateFaceTimer) {
      window.clearTimeout(coin._fateFaceTimer);
      coin._fateFaceTimer = 0;
    }
  }

  syncFateHelpers(targetCount) {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const helpers = Array.from(layer.querySelectorAll(".fate-helper"));
    const safeTarget = Math.max(0, Math.floor(targetCount || 0));

    while (helpers.length > safeTarget) {
      const helper = helpers.pop();
      if (helper) {
        this.clearFateHelperTimers(helper);
        helper.remove();
      }
    }

    while (helpers.length < safeTarget) {
      const helper = this.createFateHelper(layer, helpers.length);
      if (!helper) return;
      helpers.push(helper);
    }

    helpers.forEach((helper, index) => {
      helper.dataset.helperIndex = String(index);
    });
  }

  createFateHelper(layer, index) {
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    if (width <= 0 || height <= 0) return null;

    const helper = document.createElement("span");
    helper.className = "fate-helper";
    helper.dataset.state = "idle";
    helper.dataset.helperIndex = String(index);
    helper.setAttribute("aria-hidden", "true");
    helper.innerHTML = `
      <span class="fate-helper-shadow"></span>
      <span class="fate-helper-body">
        <span class="fate-helper-hood">
          <span class="fate-helper-eye left"></span>
          <span class="fate-helper-eye right"></span>
        </span>
        <span class="fate-helper-hand"></span>
        <span class="fate-helper-foot left"></span>
        <span class="fate-helper-foot right"></span>
      </span>
    `;

    const home = this.getFateHelperHomePosition(layer, index);
    helper._fateHelperState = {
      x: home.x,
      y: home.y,
      busy: false,
      actionTimer: 0,
      clickTimer: 0,
      resetTimer: 0,
    };
    helper.style.left = `${home.x}px`;
    helper.style.top = `${home.y}px`;

    layer.appendChild(helper);
    return helper;
  }

  getFateHelperHomePosition(layer, index) {
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    const x = this.clamp(48 + index * 34, 34, width - 34);
    const y = this.clamp(height * 0.76 + (index % 2) * 20, 42, height - 28);
    return { x, y };
  }

  queueFateHelperClicks(cycles = 1) {
    const safeCycles = Math.min(4, Math.max(1, Math.floor(cycles || 1)));

    for (let i = 0; i < safeCycles; i++) {
      let timer = 0;
      timer = window.setTimeout(() => {
        this.waveTimers.delete(timer);
        this.runFateHelperClickWave();
      }, i * 190);
      this.waveTimers.add(timer);
    }
  }

  runFateHelperClickWave() {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const coins = Array.from(layer.querySelectorAll(".fate-table-coin"));
    const helpers = Array.from(layer.querySelectorAll(".fate-helper")).filter(
      (helper) => !helper._fateHelperState?.busy
    );
    if (coins.length === 0 || helpers.length === 0) return;

    helpers.forEach((helper, helperIndex) => {
      const coin = coins[(this.helperWave + helperIndex) % coins.length];
      this.sendFateHelperToCoin(helper, coin, helperIndex);
    });
    this.helperWave += 1;
  }

  sendFateHelperToCoin(helper, coin, helperIndex) {
    if (!helper || !coin || helper._fateHelperState?.busy) return;

    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const state = helper._fateHelperState;
    const point = this.getFateHelperCoinSidePosition(
      layer,
      coin,
      helperIndex
    );
    state.busy = true;
    state.targetCoin = coin;

    helper.dataset.state = "running";
    const path = this.createFateHelperWalkPath(
      layer,
      state.x,
      state.y,
      point.x,
      point.y,
      helperIndex
    );
    this.walkFateHelperPath(helper, path, () =>
      this.scheduleFateHelperClick(helper, coin, helperIndex)
    );
  }

  createFateHelperWalkPath(layer, startX, startY, endX, endY, helperIndex) {
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(3, Math.min(7, Math.ceil(distance / 68)));
    const normalX = distance > 0 ? -dy / distance : 0;
    const normalY = distance > 0 ? dx / distance : 0;
    const curve =
      (helperIndex % 2 === 0 ? 1 : -1) * Math.min(34, distance * 0.12);
    const path = [];

    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const arc = Math.sin(progress * Math.PI) * curve;
      path.push({
        x: this.clamp(
          startX + dx * progress + normalX * arc,
          32,
          layer.clientWidth - 32
        ),
        y: this.clamp(
          startY + dy * progress + normalY * arc,
          34,
          layer.clientHeight - 26
        ),
      });
    }

    return path;
  }

  walkFateHelperPath(helper, path, onComplete) {
    const state = helper?._fateHelperState;
    if (!helper || !state || path.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    window.clearTimeout(state.actionTimer);
    state.pathIndex = 0;

    const moveNext = () => {
      state.actionTimer = 0;
      if (!helper.isConnected || !state.busy) return;

      const point = path[state.pathIndex];
      if (!point) {
        if (onComplete) onComplete();
        return;
      }

      this.addFateHelperStep(point.x, point.y, state.pathIndex);
      this.setFateHelperPosition(helper, point.x, point.y);
      state.pathIndex += 1;

      state.actionTimer = window.setTimeout(
        moveNext,
        state.pathIndex >= path.length ? 260 : 235
      );
    };

    moveNext();
  }

  addFateHelperStep(x, y, index) {
    const layer = document.getElementById("fate-coin-drop-layer");
    if (!layer) return;

    const step = document.createElement("span");
    step.className = `fate-helper-step ${index % 2 === 0 ? "left" : "right"}`;
    step.style.left = `${x}px`;
    step.style.top = `${y}px`;
    step.addEventListener("animationend", () => step.remove(), { once: true });
    layer.appendChild(step);
  }

  scheduleFateHelperClick(helper, coin, helperIndex) {
    if (!helper?.isConnected || !helper._fateHelperState?.busy) return;

    const state = helper._fateHelperState;
    const clickDelay = 160 + helperIndex * 180 + Math.random() * 520;
    helper.dataset.state = "ready";

    window.clearTimeout(state.clickTimer);
    state.clickTimer = window.setTimeout(() => {
      state.clickTimer = 0;
      this.resolveFateHelperClick(helper, coin);
    }, clickDelay);
  }

  getFateHelperCoinSidePosition(layer, coin, helperIndex) {
    const coinX = Number(coin.dataset.x || 0);
    const coinY = Number(coin.dataset.y || 0);
    const side = (this.helperWave + helperIndex) % 2 === 0 ? -1 : 1;
    const verticalOffset = ((helperIndex % 3) - 1) * 8;

    return {
      x: this.clamp(coinX + side * 42, 32, layer.clientWidth - 32),
      y: this.clamp(coinY + 8 + verticalOffset, 34, layer.clientHeight - 26),
    };
  }

  setFateHelperPosition(helper, x, y) {
    const state = helper._fateHelperState;
    if (state) {
      state.x = x;
      state.y = y;
    }
    helper.style.left = `${x}px`;
    helper.style.top = `${y}px`;
  }

  resolveFateHelperClick(helper, coin) {
    if (!helper?.isConnected) return;

    const state = helper._fateHelperState;
    const canClick =
      coin?.isConnected && this.isFateHelperBesideCoin(helper, coin);

    if (canClick) {
      const face = this.getFateTableCoinFace(coin);
      helper.dataset.state = "tap";
      this.playFateTableCoinClickFeedback(
        coin,
        face,
        this.fateCoinSystem?.assistantPower || 1
      );
    } else {
      helper.dataset.state = "miss";
    }

    window.clearTimeout(state.resetTimer);
    state.resetTimer = window.setTimeout(() => {
      state.resetTimer = 0;
      if (!helper.isConnected) return;
      state.busy = false;
      state.targetCoin = null;
      helper.dataset.state = "idle";
    }, 190);
  }

  isFateHelperBesideCoin(helper, coin) {
    const state = helper._fateHelperState;
    if (!state || !coin) return false;

    const coinX = Number(coin.dataset.x || 0);
    const coinY = Number(coin.dataset.y || 0);
    return Math.hypot(state.x - coinX, state.y - coinY) <= 58;
  }

  clearFateHelperTimers(helper, { reset = false } = {}) {
    const state = helper?._fateHelperState;
    if (!state) return;

    window.clearTimeout(state.actionTimer);
    window.clearTimeout(state.clickTimer);
    window.clearTimeout(state.resetTimer);
    state.actionTimer = 0;
    state.clickTimer = 0;
    state.resetTimer = 0;

    if (reset) {
      state.busy = false;
      state.targetCoin = null;
      helper.dataset.state = "idle";
    }
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  findFateTableCoinPosition(layer, existingCoins) {
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    const radius = Math.max(46, Math.min(width, height) * 0.06);
    const existing = existingCoins.map((coin) => ({
      x: Number(coin.dataset.x || 0),
      y: Number(coin.dataset.y || 0),
    }));
    const area = {
      left: width * 0.35,
      right: width * 0.68,
      top: height * 0.26,
      bottom: height * 0.72,
    };

    for (let i = 0; i < 80; i++) {
      const point = {
        x: area.left + Math.random() * (area.right - area.left),
        y: area.top + Math.random() * (area.bottom - area.top),
      };

      if (this.isFateCoinPositionFree(point, existing, radius)) {
        return point;
      }
    }

    const columns = Math.max(1, Math.floor((area.right - area.left) / radius));
    const row = Math.floor(existing.length / columns);
    const col = existing.length % columns;
    return {
      x: Math.min(area.right, area.left + col * radius + radius * 0.5),
      y: Math.min(area.bottom, area.top + row * radius + radius * 0.5),
    };
  }

  isFateCoinPositionFree(point, existing, minDistance) {
    for (const other of existing) {
      const dx = point.x - other.x;
      const dy = point.y - other.y;
      if (Math.hypot(dx, dy) < minDistance) {
        return false;
      }
    }

    return true;
  }
}
