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

  follow(targetX, targetY, deltaTime = 16) {
    const desiredX = targetX - this.viewportWidth / 2;
    const desiredY = targetY - this.viewportHeight / 2;
    const frameScale = Math.max(0, Math.min(4, (Number(deltaTime) || 0) / 16.667));
    const factor = 1 - Math.pow(1 - this.smoothing, frameScale);
    this.x += (desiredX - this.x) * factor;
    this.y += (desiredY - this.y) * factor;
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
