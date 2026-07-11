const SETTINGS_STORAGE_KEY = "petplan_settings";
const SAVE_SLOT = 1;

/**
 * Owns settings-modal events, persisted display settings, and quick save/load.
 * All game-level refreshes after loading are delegated to onGameLoaded.
 */
export class SettingsController {
  constructor({
    canvas,
    gameCore = null,
    getGameCore = null,
    saveSystem,
    uiSystem,
    modalFocusManager,
    getCurrentScene,
    onGameLoaded,
  } = {}) {
    this.canvas = canvas;
    this.saveSystem = saveSystem;
    this.uiSystem = uiSystem;
    this.modalFocusManager = modalFocusManager;
    this.getCurrentScene =
      typeof getCurrentScene === "function" ? getCurrentScene : () => "fate";
    this.onGameLoaded =
      typeof onGameLoaded === "function" ? onGameLoaded : () => {};
    this.getGameCore =
      typeof getGameCore === "function" ? getGameCore : () => gameCore;

    this.listeners = [];
    this.isBound = false;
  }

  bindEvents() {
    if (this.isBound) return;

    this.isBound = true;

    this.listen(document.getElementById("game-settings-btn"), "click", () => {
      this.open();
    });

    const overlay = document.getElementById("settings-modal-overlay");
    this.listen(overlay, "click", (event) => {
      const closeTrigger = event.target?.closest?.("#settings-modal-close");
      if (closeTrigger || event.target === overlay) {
        this.close();
      }
    });

    this.listen(document.getElementById("settings-save-btn"), "click", () => {
      this.save();
      this.close();
      this.uiSystem?.showToast?.("设置已保存", "success");
    });

    this.listen(
      document.getElementById("settings-quick-save-btn"),
      "click",
      async () => {
        await this.quickSave();
      }
    );

    this.listen(
      document.getElementById("settings-quick-load-btn"),
      "click",
      async () => {
        await this.quickLoad();
      }
    );

    this.listen(document, "keydown", (event) => {
      if (event.key === "F5") {
        event.preventDefault();
        void this.quickSave();
      } else if (event.key === "F9") {
        event.preventDefault();
        void this.quickLoad();
      }
    });

    this.load();
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
    const overlay = document.getElementById("settings-modal-overlay");
    if (!overlay) return;

    this.updateStatus();
    overlay.querySelector(".settings-content")?.scrollTo({ top: 0 });
    overlay.classList.add("active");
    this.modalFocusManager?.activate?.(overlay, "#settings-modal-close");
  }

  close() {
    const overlay = document.getElementById("settings-modal-overlay");
    if (!overlay) return;

    overlay.classList.remove("active");
    this.modalFocusManager?.release?.(overlay);
  }

  getSceneLabel() {
    const sceneLabels = {
      fate: "命运",
      dungeon: "远征",
      territory: "领地",
    };

    return sceneLabels[this.getCurrentScene()] || "命运";
  }

  formatSaveTime(timestamp) {
    if (!timestamp) return "未保存";

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "未保存";

    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  updateStatus() {
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    setText("settings-scene-label", this.getSceneLabel());

    const saveInfo = this.saveSystem?.getSaveInfo?.(SAVE_SLOT);
    if (!saveInfo) {
      setText("settings-save-time", "未保存");
      setText("settings-save-level", "Lv.1");
      setText("settings-save-version", "-");
      return;
    }

    setText("settings-save-time", this.formatSaveTime(saveInfo.timestamp));
    setText("settings-save-level", `Lv.${saveInfo.level || 1}`);
    setText("settings-save-version", saveInfo.version || "-");
  }

  load() {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);

        if (settings.resolution) {
          const radio = document.querySelector(
            `input[name="resolution"][value="${settings.resolution}"]`
          );
          if (radio) radio.checked = true;
        }

        this.applyResolution(settings.resolution || "pc");
        console.log("[Game] 设置已加载:", settings);
      }
      this.updateStatus();
    } catch (error) {
      console.error("[Game] 加载设置失败:", error);
    }
  }

  save() {
    const resolution =
      document.querySelector('input[name="resolution"]:checked')?.value ||
      "pc";
    const settings = { resolution };

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      this.applyResolution(resolution);
      console.log("[Game] 设置已保存:", settings);
      this.updateStatus();
    } catch (error) {
      console.error("[Game] 保存设置失败:", error);
    }
  }

  applyResolution(resolution) {
    const gameCore = this.getGameCore();
    if (!gameCore) return;

    const root = document.documentElement;
    root.style.setProperty("--game-width", "min(100vw, calc(100dvh * 16 / 9))");
    root.style.setProperty("--game-height", "min(100dvh, calc(100vw * 9 / 16))");
    root.style.setProperty("--top-bar-height", "0px");
    root.style.setProperty("--nav-height", "0px");
    root.style.setProperty("--canvas-height", "var(--game-height)");

    this.canvas.style.width = "";
    this.canvas.style.height = "";
    gameCore.fixedResolution = null;
    requestAnimationFrame(() => gameCore.resizeCanvas());

    console.log(`[Game] 分辨率设置: PC 自适应 16:9 (${resolution})`);
  }

  async quickSave() {
    const result = await this.saveSystem.saveGame(SAVE_SLOT);
    if (result) {
      this.updateStatus();
      this.uiSystem?.showToast?.("已保存", "success");
    }
    return result;
  }

  async quickLoad() {
    const result = await this.saveSystem.loadGame(SAVE_SLOT);
    if (result) {
      await this.onGameLoaded(result);
      this.updateStatus();
      this.uiSystem?.showToast?.("已加载", "success");
    }
    return result;
  }

  openSettingsModal() {
    return this.open();
  }

  closeSettingsModal() {
    return this.close();
  }

  formatSettingsSaveTime(timestamp) {
    return this.formatSaveTime(timestamp);
  }

  updateSettingsPanelStatus() {
    return this.updateStatus();
  }

  loadSettings() {
    return this.load();
  }

  saveSettings() {
    return this.save();
  }
}
