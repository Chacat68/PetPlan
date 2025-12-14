# 离线系统 API 文档

## 模块导出

```javascript
import { getOfflineSystemInstance } from './modules/offline-system.js';
```

## OfflineSystem

离线系统的核心类，管理离线时间计算和收益发放。

### 单例模式

使用单例模式确保全局只有一个实例：

```javascript
const offlineSystem = getOfflineSystemInstance();
```

### 核心方法

#### `init()`

初始化离线系统。在游戏启动时调用。

```javascript
offlineSystem.init();
```

**参数：** 无

**返回值：** `void`

---

#### `setOfflineStart()`

记录离线开始时间。在游戏关闭时调用。

```javascript
offlineSystem.setOfflineStart();
```

**参数：** 无

**返回值：** `void`

---

#### `calculateOfflineRevenue()`

计算离线期间的收益。

```javascript
const revenue = offlineSystem.calculateOfflineRevenue();
// {
//   coins: 10000,
//   rubies: 100,
//   crystals: 50,
//   experience: 500,
//   buildings: [...]
// }
```

**参数：** 无

**返回值：** `Object` - 收益对象

**返回值结构：**
```javascript
{
    coins: number,           // 获得的金币
    rubies: number,          // 获得的红宝石
    crystals: number,        // 获得的水晶
    experience: number,      // 获得的经验
    duration: number,        // 离线时长（毫秒）
    startTime: number,       // 离线开始时间
    endTime: number,         // 离线结束时间
    buildings: Array         // 各建筑的贡献
}
```

---

#### `applyOfflineRevenue(revenue)`

应用离线收益到玩家账户。

```javascript
const revenue = offlineSystem.calculateOfflineRevenue();
offlineSystem.applyOfflineRevenue(revenue);
```

**参数：**
- `revenue` (Object) - 收益对象

**返回值：** `void`

---

#### `getOfflineDuration()`

获取本次离线时长（毫秒）。

```javascript
const duration = offlineSystem.getOfflineDuration();
```

**参数：** 无

**返回值：** `number` - 离线时长（毫秒）

---

#### `getOfflineDurationMinutes()`

获取本次离线时长（分钟）。

```javascript
const minutes = offlineSystem.getOfflineDurationMinutes();
```

**参数：** 无

**返回值：** `number` - 离线时长（分钟）

---

#### `getOfflineInfo()`

获取本次离线的详细信息。

```javascript
const info = offlineSystem.getOfflineInfo();
```

**参数：** 无

**返回值：** `Object` - 离线信息

**返回值结构：**
```javascript
{
    startTime: number,        // 离线开始时间戳
    endTime: number,          // 离线结束时间戳
    duration: number,         // 离线时长（毫秒）
    revenue: {
        coins: number,
        rubies: number,
        crystals: number,
        experience: number
    }
}
```

---

#### `calculateBuildingRevenue(buildingId, duration)`

计算特定建筑的离线收益。

```javascript
const buildingRevenue = offlineSystem.calculateBuildingRevenue('workshop_1', 60000);
```

**参数：**
- `buildingId` (string) - 建筑 ID
- `duration` (number) - 时长（毫秒）

**返回值：** `number` - 建筑产出

---

#### `getRevenueModifier(duration)`

获取根据离线时长计算的收益修正系数。

```javascript
const modifier = offlineSystem.getRevenueModifier(3600000);  // 1小时
// 返回值在 0.4 到 1.0 之间
```

**参数：**
- `duration` (number) - 离线时长（毫秒）

**返回值：** `number` - 修正系数（0.0 - 1.0）

**修正规则：**
- 0-1 小时：100% (1.0)
- 1-6 小时：100% (1.0)
- 6-12 小时：80% (0.8)
- 12-24 小时：60% (0.6)
- 24+ 小时：40% (0.4)

---

#### `getMaxOfflineRevenue()`

获取单次离线的最大收益上限。

```javascript
const max = offlineSystem.getMaxOfflineRevenue();
// { coins: 1000000, rubies: 10000, ... }
```

**参数：** 无

**返回值：** `Object` - 最大收益对象

---

#### `isFirstOnlineToday()`

判断是否是今日首次上线。

```javascript
if (offlineSystem.isFirstOnlineToday()) {
    console.log('今天首次上线！');
}
```

**参数：** 无

**返回值：** `boolean` - 是否首次上线

---

#### `getSystemData()`

获取系统的完整数据（用于存档）。

```javascript
const data = offlineSystem.getSystemData();
```

**参数：** 无

**返回值：** `Object` - 系统数据

---

#### `loadSystemData(data)`

加载系统数据（用于读档）。

```javascript
offlineSystem.loadSystemData(savedData);
```

**参数：**
- `data` (Object) - 系统数据

**返回值：** `void`

---

## 配置常数

### 收益上限

```javascript
const MAX_OFFLINE_REVENUE = {
    coins: 1000000,      // 最多 100 万金币
    rubies: 10000,       // 最多 1 万红宝石
    crystals: 5000,      // 最多 5000 水晶
    experience: 100000   // 最多 10 万经验
};
```

### 收益修正规则

```javascript
const REVENUE_MODIFIERS = {
    0: 1.0,         // 0 分钟：100%
    60: 1.0,        // 1 小时：100%
    360: 0.8,       // 6 小时：80%
    720: 0.6,       // 12 小时：60%
    1440: 0.4       // 24 小时及以上：40%
};
```

## 事件和回调

### 离线收益计算完成事件

```javascript
offlineSystem.on('revenue_calculated', (revenue) => {
    console.log('离线收益：', revenue);
});
```

### 离线收益应用事件

```javascript
offlineSystem.on('revenue_applied', (revenue) => {
    console.log('已应用离线收益');
});
```

## 使用示例

### 基础用法

```javascript
import { getOfflineSystemInstance } from './modules/offline-system.js';

const offlineSystem = getOfflineSystemInstance();

// 游戏启动时
offlineSystem.init();

// 游戏关闭时
window.addEventListener('beforeunload', () => {
    offlineSystem.setOfflineStart();
});

// 游戏加载时
const revenue = offlineSystem.calculateOfflineRevenue();
offlineSystem.applyOfflineRevenue(revenue);

// 显示离线收益通知
const info = offlineSystem.getOfflineInfo();
console.log(`离线 ${info.duration / 60000} 分钟，获得：`, info.revenue);
```

### 与 UI 集成

```javascript
// 显示离线收益提示
function showOfflineRevenueNotification() {
    const revenue = offlineSystem.calculateOfflineRevenue();
    const info = offlineSystem.getOfflineInfo();
    
    const notification = `
        离线收益通知：
        ━━━━━━━━━━━━━━━━━━━━━━━
        离线时间：${Math.floor(info.duration / 60000)} 分钟
        💰 金币：${revenue.coins.toLocaleString()}
        🔴 红宝石：${revenue.rubies}
        💎 水晶：${revenue.crystals}
        ⭐ 经验：${revenue.experience}
        ━━━━━━━━━━━━━━━━━━━━━━━
    `;
    
    showNotificationDialog(notification);
}
```

### 与资源系统集成

```javascript
import { getResourceSystemInstance } from './modules/resource-system.js';

const resourceSystem = getResourceSystemInstance();
const offlineSystem = getOfflineSystemInstance();

// 应用离线收益
const revenue = offlineSystem.calculateOfflineRevenue();
resourceSystem.addCoins(revenue.coins);
resourceSystem.addRubies(revenue.rubies);
resourceSystem.addCrystals(revenue.crystals);
```

### 与存档系统集成

```javascript
// 保存
const offlineData = offlineSystem.getSystemData();
saveGame.offline = offlineData;

// 加载
offlineSystem.loadSystemData(loadedGame.offline);

// 加载后立即计算和应用离线收益
const revenue = offlineSystem.calculateOfflineRevenue();
offlineSystem.applyOfflineRevenue(revenue);
```

### 获取离线统计

```javascript
// 获取离线时长
const duration = offlineSystem.getOfflineDurationMinutes();
console.log(`离线时长：${duration} 分钟`);

// 获取是否首次上线
if (offlineSystem.isFirstOnlineToday()) {
    // 显示特殊欢迎奖励
    resourceSystem.addCoins(1000);
}

// 检查单个建筑的收益
const workshopRevenue = offlineSystem.calculateBuildingRevenue('workshop_1', duration * 60000);
console.log(`工坊离线产出：${workshopRevenue} 金币`);
```

## 最佳实践

### 开发者建议

1. **定期测试** - 在各种离线时长下测试收益计算
2. **监控经济** - 定期检查玩家的离线收益数据，防止经济崩溃
3. **防作弊** - 实现额外的验证机制防止数据篡改
4. **通知提示** - 明确告知玩家离线收益的上限

### 玩家提示

1. **定期上线** - 离线超过 24 小时收益会被限制
2. **优化建筑** - 升级建筑提升离线收益
3. **合理使用** - 不要过度依赖离线收益，应平衡主动游戏

---

**版本**：v1.0.0  
**最后更新**：2025年12月14日
