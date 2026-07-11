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
| `destroy()` | 解绑控制器、系统回调、路由和主循环 |

## 控制器

控制器由 `Game` 通过构造参数显式注入依赖，不自行获取系统单例。

| 控制器 | 主要接口 |
| --- | --- |
| `FateSceneController` | `bind()`、`updateDisplay()`、`handleUpgrade()`、`handleAutoFlip()`、`destroy()` |
| `ShopRecommendationController` | `bind()`、`update()`、`setFateShopFilter()`、`destroy()` |
| `BattleSceneController` | `bind()`、`handleAbandon()`、`handleBattleActionResult()`、`updateBattleDisplay()`、`renderRouteChoices()`、`renderLoot()`、`renderPetSkills()`、`destroy()` |
| `TerritorySceneController` | `bind()`、`syncProgress()`、`updateDisplay()`、`destroy()` |
| `PlayerModalController` | `bindEvents()`、`open()`、`close()`、`updateUpgradeControls()`、`destroy()` |
| `SettingsController` | `bindEvents()`、`open()`、`close()`、`quickSave()`、`quickLoad()`、`destroy()` |
| `PetModalController` | `open()`、`close()`、`render()`、`handleAction()` |
| `AchievementController` | `open()`、`close()`、`render()`、`claimReward()` |

## 玩法系统

| 模块 | 主要接口 |
| --- | --- |
| `FateCoinSystem` | `manualFlip(face)`、`assistantFlip(face)`、`buyGoldCoin()`、`getDisplayData()`、`getSaveData()` |
| `PlayerSystem` | `upgradeAttribute()`、`calculateTotalPower()`、`getSaveData()` |
| `ExpeditionRunSystem` | `startRun()`、`chooseNode()`、`resolveSearch()`、`restAtCamp()`、`completeCombat()`、`startExtraction()`、`finishRun()`、`getState()` |
| `CombatSystem` | `prepareBattle()`、`startRun()`、`chooseRoute()`、`searchArea()`、`requestExtraction()`、`useSupply()`、`usePetSkill()`、`abandonRun()`、`getBattleState()`、`update(deltaTime)`、`renderWorld(ctx)`、`getSaveData()` |
| `PetSystem` | `unlockPet()`、`equipPet()`、`unequipPet()`、`getTotalPowerBonus()`、`getSaveData()` |
| `TerritorySystem` | `setProgressContext()`、`buildBuilding()`、`upgradeBuilding()`、`collectResources()`、`getSaveData()` |
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

### CombatSystem 远征门面

`CombatSystem.mode` 当前为 `extractionRpg`。控制器只调用它的门面接口，不直接驱动 `ExpeditionRunSystem`：

- `startRun()`：建立满生命、2 份补给和 8 格背包的一局。
- `chooseRoute(nodeId)`：选择路线，必要时创建遭遇怪物队列。
- `searchArea(mode)`：执行搜索，发生伏击时自动开始遭遇。
- `restAtCamp()` / `leaveCamp()`：处理安全屋选择。
- `requestExtraction()`：启动撤离信标、倒计时和追兵遭遇。
- `useSupply()`：恢复独立的远征生命。
- `usePetSkill(instanceId)`：释放上阵宠物主动技能并进入冷却。
- `selectTargetAt(x, y)`：把 Canvas 点击位置附近的敌人设为优先目标。
- `abandonRun()`：按失败规则结算当前局；二次点击确认由控制器负责。

`getBattleState()` 是控制器的统一读取接口，主要形状如下：

```javascript
{
  mode: "extractionRpg",
  phase: "route",
  phaseLabel: "选择路线",
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
  petSkills: [],
  extraction: { unlocked: false, canExtract: false },
  actions: {
    canStart: false,
    canChooseRoute: true,
    canSearch: false,
    canRest: false,
    canExtract: false,
    canHeal: true,
    canAbandon: true
  },
  settlement: null,
  meta: { bestDepth: 0, extractions: 0, losses: 0 }
}
```

`BattleSceneController` 必须以 `actions` 字段决定按钮显隐和禁用状态，避免在 DOM 层复制远征状态规则。

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

`data.combat` 只保存远征长期记录 `{ mode, meta }`。当前路线、阶段、生命、补给、威胁、背包、敌人、技能冷却和撤离倒计时不持久化。加载旧塔防存档时，`bestWave`、`victories`、`defeats` 会分别迁移为 `bestDepth`、`extractions`、`losses`。
