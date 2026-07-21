const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Keeps keyboard focus inside the current modal and returns it on close.
 */
export class ModalFocusManager {
  constructor() {
    this.activeModal = null;
    this.restoreTarget = null;
    this.onChange = null;
    this.handleKeydown = this.handleKeydown.bind(this);
    this.isBound = false;
    this.bind();
  }

  bind() {
    if (this.isBound) return;
    document.addEventListener("keydown", this.handleKeydown);
    this.isBound = true;
  }

  activate(modal, initialFocusSelector) {
    if (!modal) return;

    if (!this.restoreTarget?.isConnected) {
      const activeElement = document.activeElement;
      this.restoreTarget =
        activeElement instanceof HTMLElement ? activeElement : null;
    }

    this.activeModal = modal;
    this.notifyChange();
    const initialFocus =
      typeof initialFocusSelector === "string"
        ? modal.querySelector(initialFocusSelector)
        : initialFocusSelector;
    initialFocus?.focus({ preventScroll: true });
  }

  release(modal) {
    if (modal && this.activeModal !== modal) return;

    this.activeModal = null;
    this.notifyChange();
    const restoreTarget = this.restoreTarget;
    this.restoreTarget = null;
    if (restoreTarget?.isConnected) {
      restoreTarget.focus({ preventScroll: true });
    }
  }

  destroy() {
    if (!this.isBound) return;
    document.removeEventListener("keydown", this.handleKeydown);
    this.isBound = false;
    this.activeModal = null;
    this.restoreTarget = null;
    this.onChange = null;
  }

  setOnChange(callback) {
    this.onChange = typeof callback === "function" ? callback : null;
  }

  notifyChange() {
    try {
      this.onChange?.(this.activeModal);
    } catch (error) {
      console.warn("[ModalFocusManager] 状态回调失败:", error);
    }
  }

  handleKeydown(event) {
    if (event.key !== "Tab" || !this.activeModal?.isConnected) return;

    const focusableElements = Array.from(
      this.activeModal.querySelectorAll(FOCUSABLE_SELECTOR)
    ).filter((element) => element instanceof HTMLElement && element.offsetParent);

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (!this.activeModal.contains(activeElement)) {
      event.preventDefault();
      firstElement.focus();
    } else if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
}
