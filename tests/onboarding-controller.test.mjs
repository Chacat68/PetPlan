import assert from "node:assert/strict";
import test from "node:test";

import { OnboardingController } from "../js/controllers/onboarding-controller.js";
import { ProgressionSystem } from "../js/modules/progression-system.js";

test("成长教练层按完整闭环生成跨场景说明", () => {
  const progression = new ProgressionSystem();
  const controller = new OnboardingController({ progressionSystem: progression });

  const flip = controller.getPresentation({
    guide: progression.getFirstSessionGuide({}),
    scene: "fate",
  });
  assert.match(flip.title, /核心动作/);
  assert.equal(flip.targetSelector, ".fate-table-coin");

  const expeditionGuide = progression.getFirstSessionGuide({
    totalFlips: 8,
    fateCoins: 2,
    assistants: 1,
  });
  const expedition = controller.getPresentation({
    guide: expeditionGuide,
    scene: "fate",
  });
  assert.equal(expedition.cta.scene, "dungeon");
  assert.match(expedition.body, /完成第 1 个区域/);

  const extracting = controller.getPresentation({
    guide: {
      id: "extraction",
      current: 5,
      total: 6,
      value: 0,
      target: 1,
      complete: false,
    },
    scene: "dungeon",
    battleState: {
      phase: "extracting",
      extraction: { inZone: true, remainingSeconds: 6 },
    },
  });
  assert.match(extracting.title, /守住信标/);
  assert.match(extracting.body, /6 秒/);

  const complete = controller.getPresentation({
    guide: { complete: true },
    scene: "territory",
  });
  assert.equal(complete.cta.action, "complete");
  assert.match(complete.body, /永久能力/);
});
