/**
 * FateCoinSystem - core coin-growth loop.
 * Produces heads and tails through manual flips and assistant automation.
 */

let instance = null;

export class FateCoinSystem {
  constructor() {
    this.fateCoins = 1;
    this.heads = 0;
    this.tails = 0;
    this.assistants = 0;
    this.manualPower = 1;
    this.assistantPower = 1;
    this.autoInterval = 3000;
    this.goldCoins = 0;
    this.totalFlips = 0;
    this.autoTimer = 0;
    this.onChange = null;
    this.onAutoFlip = null;

    console.log("[FateCoinSystem] 初始化完成");
  }

  setOnChange(callback) {
    this.onChange = callback;
  }

  setOnAutoFlip(callback) {
    this.onAutoFlip = callback;
  }

  notifyChange() {
    if (this.onChange) {
      this.onChange(this.getDisplayData());
    }
  }

  update(deltaTime) {
    if (this.assistants <= 0) return null;

    this.autoTimer += deltaTime;
    if (this.autoTimer < this.autoInterval) return null;

    const cycles = Math.floor(this.autoTimer / this.autoInterval);
    this.autoTimer %= this.autoInterval;

    const result = {
      source: "assistant",
      cycles,
      assistants: this.assistants,
    };

    if (this.onAutoFlip) {
      this.onAutoFlip(result);
    }

    return result;
  }

  manualFlip(face = null) {
    const result = face
      ? this.settleFace(face)
      : this.flipMany(this.manualPower);
    result.source = "manual";
    this.goldCoins += 1;

    this.notifyChange();
    return result;
  }

  assistantFlip(face) {
    const result = this.settleFace(face);
    result.source = "assistant";
    this.goldCoins += 1;

    this.notifyChange();
    return result;
  }

  settleFace(face) {
    const normalizedFace = face === "tails" ? "tails" : "heads";
    const heads = normalizedFace === "heads" ? 1 : 0;
    const tails = normalizedFace === "tails" ? 1 : 0;

    this.heads += heads;
    this.tails += tails;
    this.totalFlips += 1;

    return { flips: 1, heads, tails, face: normalizedFace };
  }

  flipMany(count) {
    const safeCount = Math.max(0, Math.floor(count));
    if (safeCount <= 0) {
      return { flips: 0, heads: 0, tails: 0 };
    }

    const heads = this.rollHeads(safeCount);
    const tails = safeCount - heads;

    this.heads += heads;
    this.tails += tails;
    this.totalFlips += safeCount;

    return { flips: safeCount, heads, tails };
  }

  rollHeads(count) {
    if (count <= 1000) {
      let heads = 0;
      for (let i = 0; i < count; i++) {
        if (Math.random() < 0.5) heads++;
      }
      return heads;
    }

    const variance = (Math.random() - 0.5) * Math.sqrt(count);
    return Math.max(0, Math.min(count, Math.round(count * 0.5 + variance)));
  }

  getBuyCoinCost() {
    const scale = Math.pow(1.45, Math.max(0, this.fateCoins - 1));
    return {
      heads: Math.floor(10 * scale),
      tails: Math.floor(10 * scale),
    };
  }

  getBuyAssistantCost() {
    return {
      heads: 0,
      tails: Math.floor(25 * Math.pow(1.65, this.assistants)),
    };
  }

  getBuyGoldCoinCost() {
    const scale = Math.pow(1.45, Math.max(0, this.fateCoins - 1));
    return {
      heads: Math.floor(5 * scale),
      tails: 0,
    };
  }

  getUpgradeManualCost() {
    return {
      heads: Math.floor(20 * Math.pow(1.55, this.manualPower - 1)),
      tails: 0,
    };
  }

  getUpgradeAssistantSpeedCost() {
    const speedLevel = Math.round((3000 - this.autoInterval) / 250);
    return {
      heads: 0,
      tails: Math.floor(40 * Math.pow(1.7, speedLevel)),
    };
  }

  buyFateCoin() {
    const cost = this.getBuyCoinCost();
    if (!this.canAfford(cost)) {
      return { success: false, message: "正面或反面不足" };
    }

    this.pay(cost);
    this.fateCoins += 1;
    this.notifyChange();

    return { success: true, message: "命运硬币 +1" };
  }

  buyAssistant() {
    const cost = this.getBuyAssistantCost();
    if (!this.canAfford(cost)) {
      return { success: false, message: "反面不足" };
    }

    this.pay(cost);
    this.assistants += 1;
    this.notifyChange();

    return { success: true, message: "助手 +1" };
  }

  buyGoldCoin() {
    const cost = this.getBuyGoldCoinCost();
    if (!this.canAfford(cost)) {
      return { success: false, message: "正面不足" };
    }

    this.pay(cost);
    this.fateCoins += 1;
    this.notifyChange();

    return { success: true, message: "桌面金币 +1" };
  }

  upgradeManualPower() {
    const cost = this.getUpgradeManualCost();
    if (!this.canAfford(cost)) {
      return { success: false, message: "正面不足" };
    }

    this.pay(cost);
    this.manualPower += 1;
    this.notifyChange();

    return { success: true, message: "手动抛币强化" };
  }

  upgradeAssistantSpeed() {
    if (this.autoInterval <= 750) {
      return { success: false, message: "助手速度已达上限" };
    }

    const cost = this.getUpgradeAssistantSpeedCost();
    if (!this.canAfford(cost)) {
      return { success: false, message: "反面不足" };
    }

    this.pay(cost);
    this.autoInterval = Math.max(750, this.autoInterval - 250);
    this.notifyChange();

    return { success: true, message: "助手加速" };
  }

  canAfford(cost) {
    return this.heads >= (cost.heads || 0) && this.tails >= (cost.tails || 0);
  }

  pay(cost) {
    this.heads -= cost.heads || 0;
    this.tails -= cost.tails || 0;
  }

  spend(cost) {
    if (!this.canAfford(cost)) {
      return false;
    }

    this.pay(cost);
    this.notifyChange();
    return true;
  }

  getAutoFlipsPerSecond() {
    if (this.assistants <= 0) return 0;
    return this.assistants / (this.autoInterval / 1000);
  }

  formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return "0";
    const suffixes = ["", "K", "M", "B", "T", "Qa", "Qi"];
    let value = Math.floor(num);
    let suffixIndex = 0;

    while (value >= 1000 && suffixIndex < suffixes.length - 1) {
      value /= 1000;
      suffixIndex++;
    }

    if (suffixIndex === 0) return String(value);
    if (value >= 100) return `${Math.floor(value)}${suffixes[suffixIndex]}`;
    if (value >= 10) return `${value.toFixed(1)}${suffixes[suffixIndex]}`;
    return `${value.toFixed(2)}${suffixes[suffixIndex]}`;
  }

  formatCost(cost) {
    const parts = [];
    if (cost.heads > 0) parts.push(`${this.formatNumber(cost.heads)} 正面`);
    if (cost.tails > 0) parts.push(`${this.formatNumber(cost.tails)} 反面`);
    return parts.join(" + ") || "免费";
  }

  getDisplayData() {
    return {
      fateCoins: this.fateCoins,
      heads: this.heads,
      tails: this.tails,
      assistants: this.assistants,
      manualPower: this.manualPower,
      assistantPower: this.assistantPower,
      autoInterval: this.autoInterval,
      goldCoins: this.goldCoins,
      totalFlips: this.totalFlips,
      autoFlipsPerSecond: this.getAutoFlipsPerSecond(),
      costs: {
        fateCoin: this.getBuyCoinCost(),
        assistant: this.getBuyAssistantCost(),
        goldCoin: this.getBuyGoldCoinCost(),
        manual: this.getUpgradeManualCost(),
        assistantSpeed: this.getUpgradeAssistantSpeedCost(),
      },
    };
  }

  getSaveData() {
    return {
      fateCoins: this.fateCoins,
      heads: this.heads,
      tails: this.tails,
      assistants: this.assistants,
      manualPower: this.manualPower,
      assistantPower: this.assistantPower,
      autoInterval: this.autoInterval,
      goldCoins: this.goldCoins,
      totalFlips: this.totalFlips,
    };
  }

  loadSaveData(data) {
    if (!data) return;

    this.fateCoins = Math.max(
      1,
      (data.fateCoins ?? 1) + (data.pendingGoldCoins ?? 0)
    );
    this.heads = data.heads ?? 0;
    this.tails = data.tails ?? 0;
    this.assistants = data.assistants ?? 0;
    this.manualPower = data.manualPower ?? 1;
    this.assistantPower = data.assistantPower ?? 1;
    this.autoInterval = data.autoInterval ?? 3000;
    this.goldCoins = data.goldCoins ?? data.totalFlips ?? 0;
    this.totalFlips = data.totalFlips ?? 0;
    this.autoTimer = 0;

    this.notifyChange();
  }
}

export function getFateCoinSystemInstance() {
  if (!instance) {
    instance = new FateCoinSystem();
  }
  return instance;
}
