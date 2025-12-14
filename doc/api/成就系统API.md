# 成就系统 API 文档

## 模块导出

```javascript
import { getAchievementSystemInstance } from './modules/achievement-system.js';
import AchievementUI from './modules/achievement-ui.js';
```

## AchievementSystem

成就系统的核心类，管理任务、成就和奖励。

### 单例模式

使用单例模式确保全局只有一个实例：

```javascript
const achievementSystem = getAchievementSystemInstance();
```

### 核心方法

#### `init()`

初始化成就系统。

```javascript
achievementSystem.init();
```

**参数：** 无

**返回值：** `void`

---

#### `initializeTasks()`

初始化默认任务列表。

```javascript
achievementSystem.initializeTasks();
```

**参数：** 无

**返回值：** `void`

---

#### `updateProgress(taskId, amount)`

更新指定任务的进度。

```javascript
achievementSystem.updateProgress('daily_battle', 5);
```

**参数：**
- `taskId` (string) - 任务 ID
- `amount` (number) - 增加的进度数量

**返回值：** `void`

**示例：**
```javascript
// 更新战斗任务进度
achievementSystem.updateProgress('daily_battle', 1);

// 更新升级任务进度
achievementSystem.updateProgress('daily_level_up', 1);
```

---

#### `completeTask(taskId)`

标记任务为已完成。

```javascript
achievementSystem.completeTask('daily_battle');
```

**参数：**
- `taskId` (string) - 任务 ID

**返回值：** `void`

---

#### `claimReward(taskId)`

领取任务奖励。

```javascript
const result = achievementSystem.claimReward('daily_battle');
// { success: true, reward: { coins: 1000, rubies: 50 } }
```

**参数：**
- `taskId` (string) - 任务 ID

**返回值：** `Object`
- `success` (boolean) - 是否成功
- `reward` (Object) - 奖励内容
- `message` (string) - 提示信息

---

#### `getTask(taskId)`

获取任务对象。

```javascript
const task = achievementSystem.getTask('daily_battle');
```

**参数：**
- `taskId` (string) - 任务 ID

**返回值：** `Object` - 任务对象

**任务对象结构：**
```javascript
{
    id: 'daily_battle',
    type: 'daily',
    name: '战斗高手',
    description: '击败10个怪物',
    target: 10,
    current: 5,
    reward: { coins: 1000, rubies: 50 },
    completed: false,
    claimedReward: false
}
```

---

#### `getAllTasks()`

获取所有任务。

```javascript
const allTasks = achievementSystem.getAllTasks();
```

**参数：** 无

**返回值：** `Array<Object>` - 任务数组

---

#### `getDailyTasks()`

获取所有日常任务。

```javascript
const dailyTasks = achievementSystem.getDailyTasks();
```

**参数：** 无

**返回值：** `Array<Object>` - 日常任务数组

---

#### `getAchievements()`

获取所有成就。

```javascript
const achievements = achievementSystem.getAchievements();
```

**参数：** 无

**返回值：** `Array<Object>` - 成就数组

---

#### `getCompletedCount()`

获取已完成任务的数量。

```javascript
const count = achievementSystem.getCompletedCount();
```

**参数：** 无

**返回值：** `number` - 已完成任务数

---

#### `getUnclaimedRewardCount()`

获取未领取奖励的任务数量。

```javascript
const count = achievementSystem.getUnclaimedRewardCount();
```

**参数：** 无

**返回值：** `number` - 未领取奖励的任务数

---

#### `getTotalAchievementPoints()`

获取累积的成就点数。

```javascript
const points = achievementSystem.getTotalAchievementPoints();
```

**参数：** 无

**返回值：** `number` - 成就点数

---

#### `resetDailyTasks()`

重置日常任务（通常在每天重置时调用）。

```javascript
achievementSystem.resetDailyTasks();
```

**参数：** 无

**返回值：** `void`

---

#### `getSystemData()`

获取系统的完整数据（用于存档）。

```javascript
const data = achievementSystem.getSystemData();
```

**参数：** 无

**返回值：** `Object` - 系统数据

---

#### `loadSystemData(data)`

加载系统数据（用于读档）。

```javascript
achievementSystem.loadSystemData(savedData);
```

**参数：**
- `data` (Object) - 系统数据

**返回值：** `void`

---

## AchievementUI

成就系统的 UI 管理类。

### 构造函数

```javascript
const ui = new AchievementUI();
```

### 核心方法

#### `createUI()`

创建成就界面。

```javascript
ui.createUI();
```

**参数：** 无

**返回值：** `void`

---

#### `show()`

显示成就界面。

```javascript
ui.show();
```

**参数：** 无

**返回值：** `void`

---

#### `hide()`

隐藏成就界面。

```javascript
ui.hide();
```

**参数：** 无

**返回值：** `void`

---

#### `update()`

更新成就界面显示。

```javascript
ui.update();
```

**参数：** 无

**返回值：** `void`

---

## 事件和回调

### 任务完成事件

当任务完成时触发：

```javascript
achievementSystem.on('task_completed', (taskId) => {
    console.log(`任务 ${taskId} 完成了！`);
});
```

### 奖励领取事件

当领取奖励时触发：

```javascript
achievementSystem.on('reward_claimed', (taskId, reward) => {
    console.log(`领取了 ${taskId} 的奖励`, reward);
});
```

## 使用示例

### 基础用法

```javascript
import { getAchievementSystemInstance } from './modules/achievement-system.js';

const achievementSystem = getAchievementSystemInstance();

// 初始化
achievementSystem.init();

// 更新进度
achievementSystem.updateProgress('daily_battle', 1);

// 检查任务是否完成
const task = achievementSystem.getTask('daily_battle');
if (task.current >= task.target) {
    achievementSystem.completeTask('daily_battle');
}

// 领取奖励
const result = achievementSystem.claimReward('daily_battle');
if (result.success) {
    console.log('领取了奖励：', result.reward);
}
```

### 与游戏循环集成

```javascript
// 在游戏的 update 循环中
function gameUpdate() {
    // ... 其他更新逻辑
    
    // 更新战斗任务
    if (monsterDefeated) {
        achievementSystem.updateProgress('daily_battle', 1);
    }
    
    // 更新升级任务
    if (playerLevelUp) {
        achievementSystem.updateProgress('daily_level_up', 1);
    }
}
```

### 与存档系统集成

```javascript
// 保存
const achievementData = achievementSystem.getSystemData();
saveGame.achievement = achievementData;

// 加载
achievementSystem.loadSystemData(loadedGame.achievement);
```

---

**版本**：v1.0.0  
**最后更新**：2025年12月14日
