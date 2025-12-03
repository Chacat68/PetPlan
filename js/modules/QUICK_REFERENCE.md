# 模块快速参考

本文档提供各模块的快速参考，便于开发时查阅。

## 模块导入

```javascript
// 主入口
import Game from './main.js';

// 核心模块
import GameCore from './modules/game-core.js';
import PlayerSystem from './modules/player-system.js';
import CombatSystem from './modules/combat-system.js';
import ResourceSystem from './modules/resource-system.js';

// 单例模式模块
import { getPetSystemInstance } from './modules/pet-system.js';
import { getTerritorySystemInstance } from './modules/territory-system.js';
import { getSaveSystemInstance } from './modules/save-system.js';

// UI 模块
import UISystem, { uiSystem } from './modules/ui-system.js';
import SaveUI from './modules/save-ui.js';
import { getPetUIInstance } from './modules/pet-ui.js';
```

## 快速获取实例

```javascript
// 资源系统（单例）
const resourceSystem = ResourceSystem.getInstance();

// 宠物系统（单例）
const petSystem = getPetSystemInstance(gameCore, resourceSystem);

// 领地系统（单例）
const territorySystem = getTerritorySystemInstance(resourceSystem);

// 存档系统（单例）
const saveSystem = getSaveSystemInstance();
```

## 常用操作速查

### 资源操作

```javascript
// 金币
resourceSystem.addCoins(100);
resourceSystem.spendCoins(50);
resourceSystem.hasEnoughCoins(100);
resourceSystem.getCoins();

// 红宝石
resourceSystem.addRubies(10);
resourceSystem.spendRubies(5);
resourceSystem.hasEnoughRubies(10);
resourceSystem.getRubies();

// 水晶
resourceSystem.addCrystals(50);
resourceSystem.spendCrystals(25);
resourceSystem.hasEnoughCrystals(50);
resourceSystem.getCrystals();

// 批量操作（领地系统用）
resourceSystem.hasEnoughResources({ gold: 1000, crystal: 100 });
resourceSystem.spendResources({ gold: 1000, crystal: 100 });

// 数字格式化
resourceSystem.formatNumber(1234567); // "1.23B"
```

### 玩家操作

```javascript
// 获取数据
const playerData = playerSystem.getPlayerData();

// 设置数据
playerSystem.setPlayerData({ hp: 100 });

// 获取实际属性（含三维加成）
playerSystem.getActualAttack();
playerSystem.getActualMaxHp();
playerSystem.getActualCrit();
playerSystem.getActualCritDamage();
playerSystem.getActualDodge();

// 升级
playerSystem.upgradeAttribute('attack', 5);
playerSystem.bulkUpgradeAttribute('attack', 10);
playerSystem.canUpgrade('attack');

// 战力
playerSystem.calculateTotalPower();
```

### 宠物操作

```javascript
// 解锁
petSystem.unlockPet(1);

// 编队
petSystem.equipPet(instanceId, 'front', 0);
petSystem.unequipPet(instanceId);

// 养成
petSystem.feedPet(instanceId);
petSystem.trainPet(instanceId);
petSystem.upgradePet(instanceId);

// 查询
petSystem.getEquippedPets();
petSystem.getTotalPowerBonus();
petSystem.getRarityConfig('legendary');
```

### 领地操作

```javascript
// 建筑
territorySystem.getBuildings();
territorySystem.getBuildingInfo('training_ground');
territorySystem.startBuildBuilding('training_ground', { x: 5, y: 5 });
territorySystem.checkAndCompleteBuildings();
territorySystem.upgradeBuilding(buildingId);
territorySystem.demolishBuilding(buildingId);

// 属性加成
territorySystem.getTotalAttributeBonuses();

// 扩张
territorySystem.getExpansionStatus();
territorySystem.checkCanExpand();
territorySystem.expandTerritory();
```

### 存档操作

```javascript
// 保存/加载
saveSystem.saveGame(slot);
saveSystem.loadGame(slot);
saveSystem.quickSave();
saveSystem.quickLoad();

// 管理
saveSystem.getAllSaves();
saveSystem.deleteSave(slot);
saveSystem.clearAllSaves();

// 导入导出
saveSystem.exportSave(slot);
await saveSystem.importSave(file, slot);
```

### 战斗操作

```javascript
// 怪物
combatSystem.getMonsters();
combatSystem.getMonsterCount();

// 子弹
combatSystem.getBulletCount();

// 清除
combatSystem.clearAll();
```

## 存档接口模板

每个需要持久化的系统都应实现：

```javascript
class MySystem {
    getSaveData() {
        return {
            // 需要保存的数据
            myData: this.myData,
            myState: this.myState
        };
    }
    
    loadSaveData(data) {
        if (data) {
            this.myData = data.myData ?? this.myData;
            this.myState = data.myState ?? this.myState;
            // 更新 UI 等
        }
    }
}
```

## 事件处理模板

```javascript
// 快捷键
window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
        e.preventDefault();
        // 快速保存
    }
});

// 页面可见性
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // 暂停
    } else {
        // 恢复
    }
});

// 页面关闭
window.addEventListener('beforeunload', () => {
    // 保存数据
});
```

## 渲染循环模板

```javascript
update(deltaTime) {
    // 更新逻辑
    this.playerSystem.update(deltaTime);
    this.combatSystem.update(deltaTime);
    // ...
}

render(ctx) {
    // 绘制背景
    this.drawBackground();
    
    // 绘制各系统
    this.playerSystem.render(ctx);
    this.petSystem.render(ctx);
    this.combatSystem.render(ctx);
}
```

## 调试技巧

```javascript
// 开启资源系统调试
resourceSystem.debug = true;

// 快速获取资源（调试用）
resourceSystem.addCoins(100000);
resourceSystem.addRubies(1000);
resourceSystem.addCrystals(5000);

// 立即建造（调试用）
territorySystem.debugBuildBuilding('training_ground', { x: 5, y: 5 });
territorySystem.instantCompleteBuild(taskId);

// 重置宠物数据
petSystem.resetAll();

// 清除存档
saveSystem.clearAllSaves();
```

## 常见问题

### Q: 系统引用报错？
A: 确保在 `main.js` 中正确设置了系统引用：
```javascript
this.gameCore.setSystems(playerSystem, combatSystem, ...);
this.saveSystem.setSystems(playerSystem, territorySystem, ...);
```

### Q: 存档加载后数据不对？
A: 检查是否实现了 `loadSaveData()` 方法，且正确处理了 `undefined` 值。

### Q: 货币显示不更新？
A: 确保调用了 `resourceSystem.updateCurrencyDisplay()`。

### Q: 宠物不攻击？
A: 检查是否设置了 `petSystem.setCombatSystem(combatSystem)`。
