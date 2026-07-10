# API 参考

本文档描述当前存在并由主游戏使用的模块。系统实例通过 `getXxxSystemInstance()` 获取，再由 `Game.init()` 注入关联。

## Game

`js/main.js` 的 `Game` 负责系统装配、场景副作用和管理 UI。

| 方法 | 说明 |
| --- | --- |
| `init()` | 初始化系统、加载槽位 1、启动主循环 |
| `handleNavigation(tab, silent)` | 切换命运、战斗或领地；宠物和成就打开模态 |
| `quickSave()` / `quickLoad()` | 保存或加载槽位 1 |
| `updateFateDisplay()` | 刷新命运桌、商店推荐和下一目标 |
| `updateTerritoryDisplay()` | 刷新领地网格、建筑和产出信息 |

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
    fate: {}
  }
}
```
