# API 参考手册

本文档汇总了 PetPlan 所有系统的 API 接口。

---

## 目录

1. [Game 类](#game-类)
2. [PlayerSystem](#playersystem)
3. [CombatSystem](#combatsystem)
4. [PetSystem](#petsystem)
5. [TerritorySystem](#territorysystem)
6. [ResourceSystem](#resourcesystem)
7. [SaveSystem](#savesystem)
8. [UISystem](#uisystem)
9. [AchievementSystem](#achievementsystem)

---

## Game 类

主游戏控制器，位于 `js/main.js`。

### 核心方法

| 方法                    | 参数   | 返回 | 说明         |
| ----------------------- | ------ | ---- | ------------ |
| `init()`                | -      | void | 初始化游戏   |
| `gameLoop(currentTime)` | number | void | 游戏主循环   |
| `update(deltaTime)`     | number | void | 更新游戏逻辑 |
| `render()`              | -      | void | 渲染游戏画面 |

### 存档方法

| 方法             | 参数   | 返回    | 说明           |
| ---------------- | ------ | ------- | -------------- |
| `saveGame(slot)` | number | Promise | 保存到指定槽位 |
| `loadGame(slot)` | number | Promise | 从指定槽位加载 |

### 属性

```javascript
game.canvas; // HTMLCanvasElement - 游戏画布
game.ctx; // CanvasRenderingContext2D - 渲染上下文
game.isRunning; // boolean - 运行状态
game.mapWidth; // number - 地图宽度 (400)
game.mapHeight; // number - 地图高度 (435)
```

---

## PlayerSystem

玩家系统，位于 `js/modules/player-system.js`。

### 获取实例

```javascript
import { getPlayerSystemInstance } from "./modules/player-system.js";
const playerSystem = getPlayerSystemInstance();
```

### 玩家属性

```javascript
playerSystem.player = {
  // 位置
  x: 35,
  y: 0,
  width: 51,
  height: 51,

  // 战斗属性
  level: 1,
  hp: 100,
  maxHp: 100,
  attack: 20,
  hpRegen: 1,
  critDamage: 150,
  attackSpeed: 1.0,
  crit: 5,
  multiShot: 1,
  tripleShot: 0,

  // 升级成本
  upgradeCosts: {
    attack: 10,
    hp: 15,
    hpRegen: 20,
    critDamage: 25,
    attackSpeed: 30,
    crit: 35,
    multiShot: 40,
    tripleShot: 50,
  },
};
```

### 升级方法

| 方法                                       | 参数                    | 返回                      | 说明         |
| ------------------------------------------ | ----------------------- | ------------------------- | ------------ |
| `upgradeAttribute(attr, increase, silent)` | string, number, boolean | void                      | 升级属性     |
| `bulkUpgradeAttribute(attr, times)`        | string, number          | void                      | 批量升级     |
| `canUpgrade(attr, times)`                  | string, number          | boolean                   | 检查能否升级 |
| `getBulkUpgradeCost(attr, times)`          | string, number          | {totalCost, allowedTimes} | 计算批量成本 |
| `calculateTotalPower()`                    | -                       | number                    | 计算总战力   |

### 存档接口

| 方法                 | 参数   | 返回   | 说明         |
| -------------------- | ------ | ------ | ------------ |
| `getSaveData()`      | -      | object | 获取存档数据 |
| `loadSaveData(data)` | object | void   | 加载存档数据 |

---

## CombatSystem

战斗系统，位于 `js/modules/combat-system.js`。

### 获取实例

```javascript
import { getCombatSystemInstance } from "./modules/combat-system.js";
const combatSystem = getCombatSystemInstance();
```

### 核心方法

| 方法                 | 参数                     | 返回 | 说明         |
| -------------------- | ------------------------ | ---- | ------------ |
| `update(deltaTime)`  | number                   | void | 更新战斗逻辑 |
| `render(ctx)`        | CanvasRenderingContext2D | void | 渲染战斗元素 |
| `spawnMonster()`     | -                        | void | 生成怪物     |
| `fireBullet(target)` | object                   | void | 发射子弹     |
| `checkCollisions()`  | -                        | void | 碰撞检测     |

### 数据结构

```javascript
combatSystem.monsters = [
  {
    x,
    y,
    width,
    height,
    hp,
    maxHp,
    attack,
    defense,
    speed,
    coinReward,
  },
];

combatSystem.bullets = [
  {
    x,
    y,
    targetX,
    targetY,
    damage,
    speed,
    life,
  },
];

combatSystem.explosions = [
  {
    x,
    y,
    radius,
    life,
  },
];
```

### 配置

```javascript
combatSystem.monsterSpawnInterval = 2000; // 怪物生成间隔
combatSystem.attackInterval = 800; // 攻击间隔
combatSystem.attackRange = 500; // 攻击范围
```

---

## PetSystem

宠物系统，位于 `js/modules/pet-system.js`。

### 获取实例

```javascript
import { getPetSystemInstance } from "./modules/pet-system.js";
const petSystem = getPetSystemInstance(gameCore, resourceSystem);
```

### 宠物管理

| 方法                                   | 参数                   | 返回                    | 说明     |
| -------------------------------------- | ---------------------- | ----------------------- | -------- |
| `unlockPet(petId)`                     | number                 | {success, message, pet} | 解锁宠物 |
| `equipPet(instanceId, position, slot)` | number, string, number | {success, message}      | 装备宠物 |
| `unequipPet(instanceId)`               | number                 | {success, message}      | 卸下宠物 |
| `upgradePet(instanceId)`               | number                 | {success, message}      | 升级宠物 |

### 养成操作

| 方法                   | 参数   | 返回               | 说明                         |
| ---------------------- | ------ | ------------------ | ---------------------------- |
| `feedPet(instanceId)`  | number | {success, message} | 喂食 (50× 等级金币)          |
| `trainPet(instanceId)` | number | {success, message} | 训练 (100× 等级金币+20 精力) |

### 查询接口

| 方法                      | 参数   | 返回                | 说明           |
| ------------------------- | ------ | ------------------- | -------------- |
| `getEquippedPets()`       | -      | Pet[]               | 获取已装备宠物 |
| `getTotalPowerBonus()`    | -      | {attack, defense}   | 获取战力加成   |
| `getRarityConfig(rarity)` | string | {color, name, star} | 获取稀有度配置 |

### 宠物实例结构

```javascript
{
    instanceId: 1234567890,
    templateId: 1,
    name: '火焰犬',
    rarity: 'common',
    type: 'fire',
    level: 1,
    exp: 0,
    expToNext: 100,
    attack: 15,
    hp: 80,
    maxHp: 80,
    defense: 5,
    attackSpeed: 1.0,
    friendship: 0,      // 好感度 0-100
    hunger: 100,        // 饱腹度 0-100
    energy: 100,        // 精力 0-100
    position: null,     // { type: 'front'|'back', index: 0-2 }
    skill: { id, name, cooldown, damage }
}
```

---

## TerritorySystem

领地系统，位于 `js/modules/territory-system.js`。

### 获取实例

```javascript
import { getTerritorySystemInstance } from "./modules/territory-system.js";
const territorySystem = getTerritorySystemInstance();
```

### 建筑管理

| 方法                                     | 参数           | 返回               | 说明     |
| ---------------------------------------- | -------------- | ------------------ | -------- |
| `buildBuilding(slotIndex, buildingType)` | number, string | {success, message} | 建造建筑 |
| `upgradeBuilding(slotIndex)`             | number         | {success, message} | 升级建筑 |
| `demolishBuilding(slotIndex)`            | number         | {success, message} | 拆除建筑 |

### 领地扩张

| 方法                 | 参数 | 返回               | 说明         |
| -------------------- | ---- | ------------------ | ------------ |
| `expandTerritory()`  | -    | {success, message} | 扩张领地     |
| `getExpansionCost()` | -    | {coins, crystals}  | 获取扩张成本 |
| `canExpand()`        | -    | boolean            | 检查能否扩张 |

### 资源产出

| 方法                    | 参数 | 返回              | 说明           |
| ----------------------- | ---- | ----------------- | -------------- |
| `collectResources()`    | -    | {coins, crystals} | 收集资源       |
| `getHourlyProduction()` | -    | {coins, crystals} | 获取每小时产出 |
| `getTotalBonus()`       | -    | {attack, defense} | 获取属性加成   |

---

## ResourceSystem

资源系统，位于 `js/modules/resource-system.js`。

### 获取实例

```javascript
import { getResourceSystemInstance } from "./modules/resource-system.js";
const resourceSystem = getResourceSystemInstance();
```

### 货币操作

| 方法                     | 参数   | 返回    | 说明             |
| ------------------------ | ------ | ------- | ---------------- |
| `addCoins(amount)`       | number | void    | 增加金币         |
| `spendCoins(amount)`     | number | boolean | 消费金币         |
| `hasEnoughCoins(amount)` | number | boolean | 检查金币是否足够 |
| `addRubies(amount)`      | number | void    | 增加红宝石       |
| `spendRubies(amount)`    | number | boolean | 消费红宝石       |
| `addCrystals(amount)`    | number | void    | 增加水晶         |
| `spendCrystals(amount)`  | number | boolean | 消费水晶         |

### 工具方法

| 方法                      | 参数   | 返回   | 说明             |
| ------------------------- | ------ | ------ | ---------------- |
| `formatNumber(num)`       | number | string | 格式化大数字     |
| `updateCurrencyDisplay()` | -      | void   | 更新货币 UI 显示 |

### 数字格式化规则

```javascript
formatNumber(1000); // "1K"
formatNumber(1000000); // "1M"
formatNumber(1000000000); // "1B"
```

---

## SaveSystem

存档系统，位于 `js/modules/save-system.js`。

### 获取实例

```javascript
import { getSaveSystemInstance } from "./modules/save-system.js";
const saveSystem = getSaveSystemInstance();
```

### 存档操作

| 方法                | 参数         | 返回             | 说明             |
| ------------------- | ------------ | ---------------- | ---------------- |
| `saveGame(slot)`    | number (1-5) | Promise<boolean> | 保存游戏         |
| `loadGame(slot)`    | number (1-5) | Promise<boolean> | 加载游戏         |
| `deleteGame(slot)`  | number (1-5) | Promise<boolean> | 删除存档         |
| `getSaveInfo(slot)` | number (1-5) | object\|null     | 获取存档信息     |
| `getAllSaveInfos()` | -            | object[]         | 获取所有存档信息 |

### 导入导出

| 方法                     | 参数         | 返回             | 说明             |
| ------------------------ | ------------ | ---------------- | ---------------- |
| `exportSave(slot)`       | number       | void             | 导出为 JSON 文件 |
| `importSave(file, slot)` | File, number | Promise<boolean> | 导入 JSON 文件   |

### 自动保存

| 方法                       | 参数   | 返回 | 说明         |
| -------------------------- | ------ | ---- | ------------ |
| `enableAutoSave(interval)` | number | void | 启用自动保存 |
| `disableAutoSave()`        | -      | void | 禁用自动保存 |

### 存档数据结构

```javascript
{
    version: "1.0.1",
    timestamp: Date.now(),
    level: playerLevel,
    player: { ... },
    resources: { coins, rubies, crystals },
    pets: { ownedPets, slots },
    territory: { buildings, expansions },
    combat: { ... }
}
```

---

## UISystem

用户界面系统，位于 `js/modules/ui-system.js`。

### 获取实例

```javascript
import { getUISystemInstance } from "./modules/ui-system.js";
const uiSystem = getUISystemInstance();
```

### 提示和对话框

| 方法                                     | 参数                     | 返回 | 说明            |
| ---------------------------------------- | ------------------------ | ---- | --------------- |
| `showToast(message, duration)`           | string, number           | void | 显示 Toast 提示 |
| `showConfirm(title, message, onConfirm)` | string, string, function | void | 显示确认对话框  |
| `showAlert(title, message)`              | string, string           | void | 显示警告对话框  |

### 弹窗管理

| 方法                 | 参数   | 返回 | 说明         |
| -------------------- | ------ | ---- | ------------ |
| `showModal(modalId)` | string | void | 显示弹窗     |
| `hideModal(modalId)` | string | void | 隐藏弹窗     |
| `hideAllModals()`    | -      | void | 隐藏所有弹窗 |

### UI 更新

| 方法                      | 参数 | 返回 | 说明             |
| ------------------------- | ---- | ---- | ---------------- |
| `update()`                | -    | void | 更新 UI 状态     |
| `updatePlayerInfo()`      | -    | void | 更新玩家信息显示 |
| `updateCurrencyDisplay()` | -    | void | 更新货币显示     |

---

## AchievementSystem

成就系统，位于 `js/modules/achievement-system.js`。

### 获取实例

```javascript
import { getAchievementSystemInstance } from "./modules/achievement-system.js";
const achievementSystem = getAchievementSystemInstance();
```

### 事件触发

| 方法                        | 参数           | 返回 | 说明     |
| --------------------------- | -------------- | ---- | -------- |
| `onEvent(eventType, value)` | string, number | void | 触发事件 |

### 事件类型

```javascript
achievementSystem.onEvent("kill", 1); // 击杀怪物
achievementSystem.onEvent("coin", amount); // 获得金币
achievementSystem.onEvent("level", newLevel); // 升级
```

### 任务管理

| 方法                   | 参数   | 返回               | 说明         |
| ---------------------- | ------ | ------------------ | ------------ |
| `getDailyQuests()`     | -      | Quest[]            | 获取每日任务 |
| `getAchievements()`    | -      | Achievement[]      | 获取成就列表 |
| `claimReward(questId)` | string | {success, message} | 领取奖励     |

---

## 通用模式

### 单例获取

所有系统都使用单例模式：

```javascript
// 推荐方式
const system = getXxxSystemInstance();

// 不推荐直接 new
const system = new XxxSystem(); // 避免
```

### 存档接口

所有系统都实现统一的存档接口：

```javascript
// 获取存档数据
const data = system.getSaveData();

// 加载存档数据
system.loadSaveData(data);
```

### 系统引用

设置系统间引用：

```javascript
// 在 main.js 中
combatSystem.setPetSystem(petSystem);
petSystem.setCombatSystem(combatSystem);
```
