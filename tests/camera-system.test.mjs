import assert from "node:assert/strict";
import test from "node:test";

import { CameraSystem } from "../js/modules/camera-system.js";

test("平滑追踪始终把角色保留在视口安全框内", () => {
  const camera = new CameraSystem({
    worldWidth: 3000,
    worldHeight: 1900,
    viewportWidth: 900,
    viewportHeight: 700,
    smoothing: 0.05,
  });
  camera.snapTo(280, 950);

  camera.follow(1800, 1500, 16);
  const screen = camera.worldToScreen(1800, 1500);

  assert.ok(screen.x >= 48 && screen.x <= 852, `角色横向位置应可见，实际为 ${screen.x}`);
  assert.ok(screen.y >= 48 && screen.y <= 652, `角色纵向位置应可见，实际为 ${screen.y}`);
});

test("世界边缘的镜头约束仍保持合法", () => {
  const camera = new CameraSystem({
    worldWidth: 1200,
    worldHeight: 900,
    viewportWidth: 900,
    viewportHeight: 700,
  });

  camera.follow(1190, 890, 100);
  const state = camera.getState();
  assert.equal(state.x, 300);
  assert.equal(state.y, 200);
});
