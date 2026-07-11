/**
 * Keeps the primary game scenes, navigation state, and URL in sync.
 */
export class SceneRouter {
  constructor({
    navSelector = ".nav-btn",
    scenes = {
      fate: "#fate-scene",
      dungeon: "#battle-scene",
      territory: "#territory-scene",
    },
  } = {}) {
    this.navSelector = navSelector;
    this.scenes = scenes;
    this.onPopState = null;
  }

  isPrimaryScene(scene) {
    return Object.prototype.hasOwnProperty.call(this.scenes, scene);
  }

  resolve(scene, fallback = "fate") {
    return this.isPrimaryScene(scene) ? scene : fallback;
  }

  getRequestedScene(fallback = "fate", { normalize = false } = {}) {
    const requestedScene = new URLSearchParams(window.location.search).get("scene");
    const resolvedScene = this.resolve(requestedScene, fallback);

    if (normalize && requestedScene && requestedScene !== resolvedScene) {
      this.writeSceneToLocation(resolvedScene, { replace: true });
    }

    return resolvedScene;
  }

  activate(scene, { syncHistory = false } = {}) {
    const resolvedScene = this.resolve(scene);

    document.querySelectorAll(this.navSelector).forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === resolvedScene);
    });

    Object.entries(this.scenes).forEach(([sceneName, selector]) => {
      const element = document.querySelector(selector);
      if (element) {
        element.style.display = sceneName === resolvedScene ? "flex" : "none";
      }
    });

    if (syncHistory) {
      this.writeSceneToLocation(resolvedScene);
    }

    return resolvedScene;
  }

  bindHistory(onNavigate) {
    this.destroy();
    this.onPopState = () =>
      onNavigate(this.getRequestedScene("fate", { normalize: true }));
    window.addEventListener("popstate", this.onPopState);
  }

  destroy() {
    if (!this.onPopState) return;
    window.removeEventListener("popstate", this.onPopState);
    this.onPopState = null;
  }

  writeSceneToLocation(scene, { replace = false } = {}) {
    const url = new URL(window.location.href);
    if (scene === "fate") {
      url.searchParams.delete("scene");
    } else {
      url.searchParams.set("scene", scene);
    }

    const nextLocation = `${url.pathname}${url.search}${url.hash}`;
    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextLocation !== currentLocation) {
      const method = replace ? "replaceState" : "pushState";
      window.history[method]({ scene }, "", nextLocation);
    }
  }
}
