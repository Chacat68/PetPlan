/**
 * Keeps the landscape-only stage readable on narrow portrait devices without
 * reloading or mutating gameplay state.
 */
export class OrientationController {
  constructor({ maxPortraitWidth = 540 } = {}) {
    this.maxPortraitWidth = maxPortraitWidth;
    this.abortController = null;
    this.previouslyFocused = null;
    this.active = false;
  }

  bind() {
    if (this.abortController || typeof window === "undefined") return;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    window.addEventListener("resize", () => this.update(), { signal });
    window.addEventListener("orientationchange", () => this.update(), { signal });
    document
      .getElementById("orientation-guide-check")
      ?.addEventListener("click", () => this.update({ announce: true }), { signal });
    document.addEventListener(
      "keydown",
      (event) => {
        if (!this.active || event.key !== "Escape") return;
        event.preventDefault();
        document.getElementById("orientation-guide-check")?.focus();
      },
      { signal }
    );

    this.update();
  }

  destroy() {
    this.abortController?.abort();
    this.abortController = null;
    this.setActive(false, { restoreFocus: false });
  }

  isNarrowPortrait() {
    if (typeof window === "undefined") return false;
    return (
      window.innerHeight > window.innerWidth &&
      window.innerWidth <= this.maxPortraitWidth
    );
  }

  update({ announce = false } = {}) {
    const shouldBeActive = this.isNarrowPortrait();
    this.setActive(shouldBeActive);

    const status = document.getElementById("orientation-guide-status");
    if (status) {
      status.textContent = announce && shouldBeActive
        ? "仍处于竖屏，请旋转设备；当前进度会保持。"
        : "";
    }
    return shouldBeActive;
  }

  setActive(active, { restoreFocus = true } = {}) {
    const guide = document.getElementById("orientation-guide");
    const game = document.querySelector(".game-container");
    if (!guide || !game) return;

    const nextActive = Boolean(active);
    if (nextActive === this.active && guide.hidden === !nextActive) return;

    if (nextActive) {
      if (!this.active && document.activeElement instanceof HTMLElement) {
        this.previouslyFocused = document.activeElement;
      }
      guide.hidden = false;
      game.inert = true;
      game.setAttribute("aria-hidden", "true");
      this.active = true;
      window.requestAnimationFrame(() => {
        document.getElementById("orientation-guide-check")?.focus();
      });
      return;
    }

    guide.hidden = true;
    game.inert = false;
    game.removeAttribute("aria-hidden");
    const focusTarget = this.previouslyFocused;
    this.previouslyFocused = null;
    this.active = false;
    if (restoreFocus && focusTarget?.isConnected) {
      window.requestAnimationFrame(() => focusTarget.focus?.({ preventScroll: true }));
    }
  }
}
