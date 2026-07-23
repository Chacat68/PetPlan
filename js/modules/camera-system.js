/**
 * CameraSystem - 大地图视口跟随与坐标转换。
 */
export class CameraSystem {
  constructor({
    worldWidth = 3000,
    worldHeight = 1900,
    viewportWidth = 750,
    viewportHeight = 900,
    smoothing = 0.14,
  } = {}) {
    this.worldWidth = Math.max(1, worldWidth);
    this.worldHeight = Math.max(1, worldHeight);
    this.viewportWidth = Math.max(1, viewportWidth);
    this.viewportHeight = Math.max(1, viewportHeight);
    this.smoothing = Math.max(0.01, Math.min(1, smoothing));
    this.x = 0;
    this.y = 0;
  }

  setWorldSize(width, height) {
    this.worldWidth = Math.max(1, Number(width) || 1);
    this.worldHeight = Math.max(1, Number(height) || 1);
    this.clamp();
  }

  setViewportSize(width, height) {
    this.viewportWidth = Math.max(1, Number(width) || 1);
    this.viewportHeight = Math.max(1, Number(height) || 1);
    this.clamp();
  }

  snapTo(targetX, targetY) {
    this.x = targetX - this.viewportWidth / 2;
    this.y = targetY - this.viewportHeight / 2;
    this.clamp();
    return this.getState();
  }

  follow(targetX, targetY, deltaTime = 16, targetInsets = {}) {
    const desiredX = targetX - this.viewportWidth / 2;
    const desiredY = targetY - this.viewportHeight / 2;
    const frameScale = Math.max(0, Math.min(4, (Number(deltaTime) || 0) / 16.667));
    const factor = 1 - Math.pow(1 - this.smoothing, frameScale);
    this.x += (desiredX - this.x) * factor;
    this.y += (desiredY - this.y) * factor;

    // 平滑镜头不能以丢失角色为代价。掉帧、后台恢复或连续键盘输入都可能
    // 让目标瞬间越过平滑追踪区，因此在插值后再把目标约束进安全框。
    const safeMarginX = Math.min(140, Math.max(48, this.viewportWidth * 0.18));
    const safeMarginY = Math.min(140, Math.max(48, this.viewportHeight * 0.18));
    const insetGutter = 3;
    const maxHorizontalMargin = this.viewportWidth / 2;
    const maxVerticalMargin = this.viewportHeight / 2;
    const safeLeft = Math.min(
      maxHorizontalMargin,
      Math.max(safeMarginX, Math.max(0, Number(targetInsets.left) || 0) + insetGutter),
    );
    const safeRight = Math.min(
      maxHorizontalMargin,
      Math.max(safeMarginX, Math.max(0, Number(targetInsets.right) || 0) + insetGutter),
    );
    const safeTop = Math.min(
      maxVerticalMargin,
      Math.max(safeMarginY, Math.max(0, Number(targetInsets.top) || 0) + insetGutter),
    );
    const safeBottom = Math.min(
      maxVerticalMargin,
      Math.max(safeMarginY, Math.max(0, Number(targetInsets.bottom) || 0) + insetGutter),
    );
    const screenX = targetX - this.x;
    const screenY = targetY - this.y;
    if (screenX < safeLeft) this.x = targetX - safeLeft;
    else if (screenX > this.viewportWidth - safeRight) {
      this.x = targetX - (this.viewportWidth - safeRight);
    }
    if (screenY < safeTop) this.y = targetY - safeTop;
    else if (screenY > this.viewportHeight - safeBottom) {
      this.y = targetY - (this.viewportHeight - safeBottom);
    }
    this.clamp();
    return this.getState();
  }

  clamp() {
    const maxX = Math.max(0, this.worldWidth - this.viewportWidth);
    const maxY = Math.max(0, this.worldHeight - this.viewportHeight);
    this.x = Math.max(0, Math.min(maxX, this.x));
    this.y = Math.max(0, Math.min(maxY, this.y));
  }

  screenToWorld(x, y) {
    return { x: x + this.x, y: y + this.y };
  }

  worldToScreen(x, y) {
    return { x: x - this.x, y: y - this.y };
  }

  getState() {
    return {
      x: this.x,
      y: this.y,
      width: this.viewportWidth,
      height: this.viewportHeight,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
    };
  }
}
