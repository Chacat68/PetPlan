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
| `BattleSceneController` | `bind()`、`updateBattleDisplay()`、`destroy()` |
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
| `CombatSystem` | `update(deltaTime)`、`renderWorld(ctx)`、`getSaveData()` |
| `PetSystem` | `unlockPet()`、`equipPet()`、`unequipPet()`、`getTotalPowerBonus()`、`getSaveData()` |
| `TerritorySystem` | `setProgressContext()`、`buildBuilding()`、`upgradeBuilding()`、`collectResources()`、`getSaveData()` |
| `ResourceSystem` | `addCoins()`、`spendCoins()`、`addRubies()`、`addCrystals()`、`formatNumber()` |
| `SaveSystem` | `saveGame(slot)`、`loadGame(slot)`、`getSaveInfo(slot)`、`exportSave(slot)`、`importSave(file, slot)` |
| `UISystem` | `showToast(message, type)`、`showConfirm(title, message, callback)` |

所有会持久化的玩法系统均实现 `getSaveData()` 和 `loadSaveData(data)`。

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
