# API 参考

本文档描述当前存在并由主游戏使用的模块。系统实例通过 `getXxxSystemInstance()` 获取，再由 `Game.init()` 注入关联。

## Game

`js/main.js` 的 `Game` 负责系统装配、跨系统回调和高层场景协调。

| 方法 | 说明 |
| --- | --- |
| `init()` | 初始化系统和控制器、加载槽位 1、启动主循环 |
| `handleNavigation(tab, silent)` | 切换命运、战斗或领地；宠物和成就打开模态 |
| `updateUI()` | 协调资源、玩家、命运和战斗控制器的全局刷新 |
| `getProgressionContext()` | 汇总首局目标、成长倾向和领地脉冲所需上下文 |
| `getAchievementContext()` | 汇总命运、远征、宠物羁绊与领地的长期指标 |
| `destroy()` | 解绑控制器、系统回调、路由和主循环 |

## 控制器

控制器由 `Game` 通过构造参数显式注入依赖，不自行获取系统单例。

| 控制器 | 主要接口 |
| --- | --- |
| `FateSceneController` | `bind()`、`updateDisplay()`、`handleUpgrade()`、`handleAutoFlip()`、`destroy()` |
| `ShopRecommendationController` | `bind()`、`update()`、`setFateShopFilter()`、`destroy()` |
| `BattleSceneController` | `bind()`、`bindMovementControls()`、`applyMovementInput()`、`clearMovementInput()`、`setSceneActive()`、`handleAbandon()`、`handleBattleActionResult()`、`updateBattleDisplay()`、`renderRouteChoices()`、`renderLoot()`、`renderPetSkills()`、`destroy()` |
| `TerritorySceneController` | `bind()`、`syncProgress()`、`updateDisplay()`、`destroy()` |
| `PlayerModalController` | `bindEvents()`、`open()`、`close()`、`updateUpgradeControls()`、`destroy()` |
| `SettingsController` | `bindEvents()`、`open()`、`close()`、`quickSave()`、`quickLoad()`、`destroy()` |
| `PetModalController` | `open()`、`close()`、`render()`、`handleAction()` |
| `AchievementController` | `open()`、`close()`、`render()`、`refreshProgress()`、`claimReward()`、`claimAllRewards()` |

## 玩法系统

| 模块 | 主要接口 |
| --- | --- |
| `FateCoinSystem` | `manualFlip(face)`、`assistantFlip(face)`、`buyGoldCoin()`、`getDisplayData()`、`getSaveData()` |
| `PlayerSystem` | `upgradeAttribute()`、`calculateTotalPower()`、`getSaveData()` |
| `ExpeditionRunSystem` | `startRun()`、`chooseNode()`、`resolveSearch()`、`restAtCamp()`、`completeCombat()`、`startExtraction()`、`finishRun()`、`getState()` |
| `ExpeditionWorldSystem` | `startRun()`、`syncRouteChoices()`、`trackLocation()`、`engageLocation()`、`completeActiveLocation()`、`updatePlayerPosition()`、`moveEntity()`、`getState()` |
| `CameraSystem` | `setWorldSize()`、`setViewportSize()`、`snapTo()`、`follow()`、`screenToWorld()`、`worldToScreen()`、`getState()` |
| `CombatSystem` | `prepareBattle()`、`startRun()`、`setViewportSize()`、`setMovementInput()`、`updateHeroMovement()`、`trackLocation()`、`interactWithNearbyLocation()`、`chooseRoute()`、`searchArea()`、`requestExtraction()`、`useSupply()`、`usePetSkill()`、`selectTargetAt()`、`abandonRun()`、`getBattleState()`、`update(deltaTime)`、`renderExplorationFrame(ctx)`、`getSaveData()` |
| `PetSystem` | `unlockPet()`、`equipPet()`、`unequipPet()`、`resetBattleStates()`、`getTotalPowerBonus()`、`getSaveData()` |
| `TerritorySystem` | `setProgressContext()`、`buildBuilding()`、`upgradeBuilding()`、`collectResources()`、`getSaveData()` |
| `AchievementSystem` | `updateProgress()`、`getItems()`、`getSummary()`、`claimReward()`、`claimAllRewards()`、`getSaveData()` |
| `ResourceSystem` | `addCoins()`、`spendCoins()`、`addRubies()`、`addCrystals()`、`formatNumber()` |
| `SaveSystem` | `saveGame(slot)`、`loadGame(slot)`、`getSaveInfo(slot)`、`exportSave(slot)`、`importSave(file, slot)` |
| `UISystem` | `showToast(message, type)`、`showConfirm(title, message, callback)` |

所有会持久化的玩法系统均实现 `getSaveData()` 和 `loadSaveData(data)`。

### ExpeditionRunSystem

`ExpeditionRunSystem` 是不依赖 DOM、Canvas 和永久资源的单局规则对象，由 `CombatSystem` 创建，不使用全局单例。构造时可以注入随机函数和局内配置：

```javascript
import {
  ExpeditionRunSystem,
  createSeededRandom,
} from "../../js/modules/expedition-run-system.js";

const run = new ExpeditionRunSystem({
  random: createSeededRandom(42),
  maxDepth: 8,
  minExtractionDepth: 3,
  backpackCapacity: 8,
});
```

主要阶段为：

```text
briefing -> route -> search / camp / combat -> route
route / extraction-ready -> extracting -> extracted
任意进行中阶段 -> defeat
```

规则接口返回 `{ success, message, ... }`，失败时不改变局内状态。`getState()` 返回路线、节点、深度、威胁、补给、背包、待结算收益、撤离条件和最终结算的快照；调用方不应直接修改快照。

| 方法 | 说明 |
| --- | --- |
| `startRun(options)` | 从 `briefing` 开始一局并生成首批路线 |
| `chooseNode(nodeId)` | 在 `route` 阶段选择节点，返回搜索、休整或遭遇规格 |
| `resolveSearch(mode, context)` | 处理 `quick`、`thorough`、`pet` 搜索及伏击、补给和掉落 |
| `restAtCamp()` / `leaveCamp()` | 结算或跳过安全屋，并返回路线阶段 |
| `completeCombat(rewards, lootOptions)` | 提交清场收益、生成战利品并推进深度 |
| `startExtraction()` | 校验撤离条件，返回守点时长和遭遇规格 |
| `finishRun(result)` | 生成成功或失败结算；重复调用返回同一结算 |
| `spendSupply()` | 消耗 1 份补给并返回恢复比例 |

### ExpeditionWorldSystem

`ExpeditionWorldSystem` 是不依赖 DOM 和 Canvas 的单局世界模型。默认世界为 `3000×1900`，出生点在西侧 `(280, 950)`，入口撤离信标在 `(310, 950)`；它不决定节点类型、掉落或阶段，只把 `ExpeditionRunSystem.routeChoices` 放到固定深度槽位中。

```javascript
import { ExpeditionWorldSystem } from "../../js/modules/expedition-world-system.js";

const world = new ExpeditionWorldSystem({
  width: 3000,
  height: 1900,
  cellSize: 180,
  revealRadius: 290,
  interactionRadius: 92,
});

world.startRun(run.getState().routeChoices);
world.updatePlayerPosition(280, 950);
```

| 方法 | 说明 |
| --- | --- |
| `startRun(routeChoices)` | 重置单局世界、创建入口信标、放置首层 POI，并揭示出生点周边 |
| `syncRouteChoices(routeChoices)` | 把当前候选节点加入世界；不再属于当前候选的可用地点标记为 `missed` |
| `trackLocation(nodeOrLocationId)` | 设置导航目标；只改变追踪，不触发规则节点 |
| `engageLocation(nodeId)` | 把近距交互选择的路线地点改为 `engaged`，并把同层另一分支改为 `missed` |
| `completeActiveLocation()` | 把当前地点标记为 `cleared`，清除活动地点和对应追踪 |
| `setExtractionUnlocked(unlocked)` / `activateExtraction()` | 更新入口信标的锁定状态，或把它设为撤离战活动地点 |
| `updatePlayerPosition(x, y)` | 累计行进距离、更新探索网格与地点发现，并返回最近可交互地点 |
| `findNearbyLocation(x, y)` | 在 `interactionRadius + 地点半径` 内查找最近的可用地点 |
| `moveEntity(entity, dx, dy, options)` | 在世界边界内按 X/Y 轴分别移动并处理矩形障碍碰撞 |
| `findOpenPositionNear(origin, distance, angle, size)` | 为世界坐标遭遇寻找不与固定障碍重叠的生成点 |
| `isPointRevealed(x, y)` / `isAreaRevealed(area)` | 判断世界点或矩形区域是否已进入探索迷雾的揭示网格 |
| `getState(playerPosition)` | 返回世界尺寸、探索比例、已揭示网格、障碍、地点、附近地点和导航目标快照 |

地点主要状态为 `locked`、`available`、`engaged`、`cleared` 和 `missed`。规则层仍以 `route` 表示自由探索期；控制器不能因为路线卡被点击就直接进入地点。

### CameraSystem

`CameraSystem` 只管理视口，不持有玩法状态。当前没有缩放参数，屏幕与世界采用相同逻辑单位：

```javascript
import { CameraSystem } from "../../js/modules/camera-system.js";

const camera = new CameraSystem({
  worldWidth: 3000,
  worldHeight: 1900,
  viewportWidth: canvas.width,
  viewportHeight: canvas.height,
  smoothing: 0.14,
});

camera.follow(heroX, heroY, deltaTime);
const worldPoint = camera.screenToWorld(screenX, screenY);
```

| 方法 | 说明 |
| --- | --- |
| `setWorldSize(width, height)` | 更新世界边界并立即约束镜头 |
| `setViewportSize(width, height)` | 更新 Canvas 视口；不修改世界实体坐标 |
| `snapTo(x, y)` | 立即把目标置于视口中心，并约束在世界边界内 |
| `follow(x, y, deltaTime)` | 使用帧率无关平滑系数跟随目标 |
| `screenToWorld(x, y)` | 加上镜头偏移，把 Canvas 坐标转换为世界坐标 |
| `worldToScreen(x, y)` | 减去镜头偏移，把世界坐标转换为 Canvas 坐标 |
| `getState()` | 返回镜头位置、视口尺寸和世界尺寸 |

### CombatSystem 远征门面

`CombatSystem.mode` 当前为 `extractionRpg`。它持有 `ExpeditionRunSystem`、`ExpeditionWorldSystem` 和 `CameraSystem`，控制器只调用门面接口，不直接改写三者内部状态：

- `startRun()`：建立满生命、2 份补给和 8 格背包的一局。
- `setViewportSize(width, height)`：同步 Canvas 视口与镜头，不修改 `3000×1900` 世界或玩家坐标。
- `setMovementInput(x, y)` / `clearMovementInput()`：设置或清空归一化移动方向；斜向输入长度不会超过 1。
- `updateHeroMovement(player, deltaTime)`：在可移动阶段按世界边界和障碍推进玩家；由 `PlayerSystem` 每帧调用。
- `trackLocation(nodeId)`：只设置路线 POI 为导航目标，并返回世界距离。
- `interactWithNearbyLocation()`：校验 POI 近距和当前阶段，再进入路线节点或启动入口撤离信标。
- `chooseRoute(nodeId, options)`：规则门面及测试兼容接口；实际 UI 使用 `requireProximity: true` 的近距交互路径。
- `searchArea(mode)`：执行搜索，发生伏击时自动开始遭遇。
- `restAtCamp()` / `leaveCamp()`：处理安全屋选择。
- `requestExtraction()`：要求玩家位于西侧入口信标附近，再启动倒计时和世界坐标追兵遭遇。
- `useSupply()`：恢复独立的远征生命。
- `usePetSkill(instanceId)`：只允许释放本局队长宠物的队伍技能并进入冷却；其他上阵宠物提供被动支持。
- `selectTargetAt(x, y)`：默认接收 Canvas 坐标，经 `screenToWorld()` 转换后把附近敌人设为优先目标；`selectTargetAtWorld()` 接收世界坐标。
- `abandonRun()`：按失败规则结算当前局；二次点击确认由控制器负责。
- `renderExplorationFrame(ctx)`：在同一帧中分别渲染屏幕背景、镜头偏移后的世界层，以及迷雾、导航箭头、小地图、撤离进度和横幅等屏幕层。

`getBattleState()` 是控制器的统一读取接口，主要形状如下：

```javascript
{
  mode: "extractionRpg",
  phase: "route",
  phaseLabel: "大地图探索",
  depth: 2,
  maxDepth: 8,
  hp: 86,
  maxHp: 100,
  threat: 31,
  supplies: 1,
  activeEnemies: 0,
  queuedEnemies: 0,
  backpack: [],
  backpackCapacity: 8,
  routeChoices: [
    {
      id: "run-1-node-5",
      type: "combat",
      name: "污染巡逻区",
      danger: "交战"
    },
    {
      id: "run-1-node-6",
      type: "search",
      name: "废弃补给站",
      danger: "低风险"
    }
  ],
  world: {
    initialized: true,
    width: 3000,
    height: 1900,
    explorationPercent: 8.7,
    distanceTravelled: 420,
    locations: [],
    obstacles: [],
    revealedCells: [],
    nearbyLocation: null,
    navigationTarget: {
      nodeId: "run-1-node-5",
      name: "污染巡逻区",
      distance: 360
    },
    player: { x: 640, y: 930, moving: true },
    camera: {
      x: 160,
      y: 480,
      width: 960,
      height: 540,
      worldWidth: 3000,
      worldHeight: 1900
    },
    canMove: true
  },
  interaction: {
    available: false,
    label: "靠近地点后交互",
    detail: "追踪 污染巡逻区 · 360m",
    location: null
  },
  petSkills: [],
  extraction: {
    unlocked: false,
    canExtract: false,
    inZone: false,
    remainingMs: 0,
    remainingSeconds: 0
  },
  actions: {
    canStart: false,
    canChooseRoute: true,
    canTrackMap: true,
    canSearch: false,
    canRest: false,
    canExtract: false,
    canInteract: false,
    canMove: true,
    canHeal: true,
    canAbandon: true
  },
  settlement: null,
  meta: { bestDepth: 0, extractions: 0, losses: 0 }
}
```

`BattleSceneController` 必须以 `actions` 和 `interaction` 字段决定按钮显隐、禁用状态及近距提示，避免在 DOM 层复制远征状态规则。`world.locations`、`world.obstacles` 和 `world.revealedCells` 是只读诊断快照；Canvas 渲染直接读取系统状态，不应通过 DOM 回写这些数组。

## UI 基础设施

### SceneRouter

`SceneRouter` 负责三种主场景的 DOM 显示状态和 URL：

```javascript
const scene = router.getRequestedScene();
router.activate(scene, { syncHistory: true });
```

支持的值是 `fate`、`dungeon` 和 `territory`。宠物与成就不是主路由，而是模态页面。

### ModalFocusManager

动态或静态模态打开后调用 `activate()`，关闭时调用 `release()`：

```javascript
focusManager.activate(modal, ".modal-close");
focusManager.release(modal);
```

该管理器会将焦点移入弹窗、限制 Tab 键在弹窗内部，并在关闭后返回原控件。

## 存档形状

`SaveSystem` 将以下数据写入 `petplan_save_<slot>`：

```javascript
{
  version: "1.1.0",
  timestamp: Date.now(),
  data: {
    player: {},
    resource: {},
    combat: {},
    pet: {},
    territory: {},
    fate: {},
    progression: {}
  }
}
```

`SaveSystem` 会读取旧键 `petplan_save_slot<slot>`，并将旧版顶层的 `resources` / `pets` 映射到当前 `data.resource` / `data.pet` 结构。只有通过完整归一化校验的导入文件才会覆盖目标槽位。

`data.combat` 同时保存远征长期记录与活动局快照，包括世界坐标、地点和探索网格、路线阶段、生命、补给、警戒、背包、敌人、弹药、技能冷却与撤离倒计时；`data.expeditionMeta` 保存仓库、配装、合约、活动配装快照和幂等结算账本。恢复顺序为先 Meta、后 Combat，活动远征期间禁止快速读档。加载旧塔防存档时，`bestWave`、`victories`、`defeats` 会分别迁移为 `bestDepth`、`extractions`、`losses`。
