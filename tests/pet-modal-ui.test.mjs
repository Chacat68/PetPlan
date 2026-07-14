import assert from "node:assert/strict";
import test from "node:test";

import { PetModalController } from "../js/controllers/pet-modal-controller.js";

const fireDog = {
  id: 1,
  name: "火焰犬",
  type: "fire",
  rarity: "common",
  image: "images/pets/fire_dog_table.png",
  requiredLevel: 1,
  cost: { coins: 500, rubies: 0 },
  baseStats: { attack: 15, hp: 80, defense: 5 },
  skill: { name: "火球术" },
  explorationTalent: {
    label: "灼热嗅觉",
    detail: "快速搜索品质判定 +1",
  },
  baseRole: {
    buildingType: "training_ground",
    label: "训练陪练",
  },
};

const iceCat = {
  ...fireDog,
  id: 2,
  name: "冰霜猫",
  type: "ice",
  image: "images/pets/ice_cat_table.png",
  explorationTalent: {
    label: "冷静侦察",
    detail: "宠物侦察威胁 -3",
  },
};

function createController() {
  const equippedPet = {
    instanceId: 101,
    templateId: 1,
    level: 2,
    exp: 25,
    friendship: 12,
    equipped: true,
  };
  const petSystem = {
    petTemplates: [fireDog, iceCat],
    unlockedPets: [equippedPet],
    equippedPets: [equippedPet],
    getTemplate: (id) => [fireDog, iceCat].find((pet) => pet.id === id),
    getRarityConfig: () => ({ name: "普通", color: "#9e9e9e", stars: 1 }),
    getFriendshipTier: () => ({ level: 1, label: "熟悉" }),
    getTotalPowerBonus: () => ({ attack: 16, defense: 5 }),
  };

  return new PetModalController({
    petSystem,
    territorySystem: {
      buildingData: { training_ground: { name: "实战训练" } },
      getActivitySupportBonus: () => ({ detail: "攻击战备 +1" }),
    },
    playerSystem: { player: { level: 1 } },
    resourceSystem: {
      hasEnoughCoins: () => true,
      hasEnoughRubies: () => true,
    },
    uiSystem: null,
    modalFocusManager: { activate() {}, release() {} },
    escapeHTML: (value) => String(value),
    formatNumber: (value) => String(value),
  });
}

test("宠物中枢标签暴露完整 tab 语义和导航说明", () => {
  const controller = createController();
  const markup = controller.renderTabButton("formation");

  assert.match(markup, /role="tab"/);
  assert.match(markup, /aria-controls="pet-panel-formation"/);
  assert.match(markup, /远征编队/);
  assert.match(markup, /部署与协同/);
  assert.equal(controller.normalizeTab("unknown"), "formation");
});

test("编队页固定展示三席位、队伍战备和实际增益", () => {
  const markup = createController().renderFormation();
  const slotCount = (markup.match(/<article class="pet-slot/g) || []).length;

  assert.equal(slotCount, 3);
  assert.match(markup, /1 \/ 3 已部署/);
  assert.match(markup, /攻击加成[\s\S]*\+16/);
  assert.match(markup, /探索 · 灼热嗅觉/);
  assert.match(markup, /基地 · 实战训练/);
  assert.match(markup, /攻击战备 \+1/);
  assert.match(markup, /data-pet-route="bag"/);
});

test("伙伴名册把属性、远征天赋、基地岗位和羁绊分区展示", () => {
  const markup = createController().renderBag();

  assert.match(markup, /pet-roster-card is-equipped/);
  assert.match(markup, /pet-specialty-grid/);
  assert.match(markup, /灼热嗅觉/);
  assert.match(markup, /训练陪练/);
  assert.match(markup, /攻击战备 \+1/);
  assert.match(markup, /status-friendship/);
});

test("伙伴图鉴展示完成度、三类定位和可执行解锁状态", () => {
  const markup = createController().renderCollection();

  assert.match(markup, /图鉴完成度 50%/);
  assert.match(markup, /已缔结契约/);
  assert.match(markup, /等待解锁/);
  assert.match(markup, /战斗/);
  assert.match(markup, /探索/);
  assert.match(markup, /基地/);
  assert.match(markup, /可解锁/);
});
