# 领地系统 API 文档

## 概述

本文档描述了领地系统 (`TerritorySystem`) 的完整 API 接口。

## 模块导入

```javascript
import TerritorySystem, { getTerritorySystemInstance } from './modules/territory-system.js';
```

## 获取实例

```javascript
// 推荐：使用单例模式
const territorySystem = getTerritorySystemInstance(resourceSystem);
```

## 核心 API

### 系统初始化

#### init()

初始化领地系统。

**示例：**
```javascript
territorySystem.init();
```

---

### 建筑管理

#### getBuildings()

获取所有已建造的建筑列表。

**返回值：**
```javascript
[
    {
        id: 'main_base_1',
        type: 'main_base',
        level: 1,
        position: { x: 10, y: 10 }
    },
    // ...
]
```

---

#### getBuildingInfo(buildingType)

获取建筑的静态配置信息。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| buildingType | string | 建筑类型ID |

**返回值：**
```javascript
{
    name: '训练场',
    levels: [
        { level: 1, cost: { gold: 1000, crystal: 0 }, attackBonus: 5 },
        { level: 2, cost: { gold: 5000, crystal: 500 }, attackBonus: 10 },
        // ...
    ]
}
```

**可用建筑类型：**
| 类型 | 名称 | 功能 |
|------|------|------|
| main_base | 主基地 | 决定建筑上限 |
| training_ground | 训练场 | 攻击力加成 |
| temple | 神庙 | 防御力加成 |
| barracks | 兵营 | 攻防加成 |
| workshop | 工坊 | 金币产出 |
| crystal_mine | 水晶矿 | 水晶产出 |
| library | 图书馆 | 经验加成 |
| hospital | 医院 | 生命回复 |
| tower | 防御塔 | 高攻防加成 |
| market | 市场 | 金币+水晶产出 |

---

#### getBuildingAtPosition(x, y)

获取指定位置的建筑。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| x | number | X坐标 |
| y | number | Y坐标 |

**返回值：** `Building Object | null`

---

### 建造系统

#### startBuildBuilding(type, position, buildTime)

开始建造建筑（加入建造队列）。

**参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | string | - | 建筑类型 |
| position | Object | - | { x: number, y: number } |
| buildTime | number | 5000 | 建造时间(ms) |

**返回值：**
```javascript
{
    id: 'build_training_ground_1701676800000',
    type: 'training_ground',
    buildingType: 'training_ground',
    position: { x: 5, y: 5 },
    startTime: 1701676800000,
    endTime: 1701676805000,
    buildTime: 5000
}
```

**失败返回：** `null`

**示例：**
```javascript
const task = territorySystem.startBuildBuilding('training_ground', { x: 5, y: 5 });
if (task) {
    console.log('建造开始，预计完成:', new Date(task.endTime));
}
```

---

#### checkAndCompleteBuildings()

检查并完成所有已到期的建造任务。

**返回值：** `Building[]` - 完成的建筑列表

**示例：**
```javascript
// 游戏循环中定期调用
const completed = territorySystem.checkAndCompleteBuildings();
completed.forEach(building => {
    console.log(`${building.type} 建造完成!`);
});
```

---

#### instantCompleteBuild(taskId)

立即完成建造（用于测试或加速道具）。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| taskId | string | 建造任务ID |

**返回值：** `boolean` - 是否成功

---

#### debugBuildBuilding(type, position)

立即建造建筑（调试用，不进入队列）。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 建筑类型 |
| position | Object | { x: number, y: number } |

**返回值：** `boolean` - 是否成功

---

### 建造队列

#### getBuildTaskAtPosition(x, y)

获取指定位置的建造任务。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| x | number | X坐标 |
| y | number | Y坐标 |

**返回值：** `BuildTask Object | null`

---

#### getBuildProgress(buildTask)

获取建造任务的进度百分比。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| buildTask | Object | 建造任务对象 |

**返回值：** `number` - 进度 0-100

---

#### getBuildRemainingTime(buildTask)

获取建造任务剩余时间。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| buildTask | Object | 建造任务对象 |

**返回值：** `number` - 剩余秒数

---

### 升级和拆除

#### upgradeBuilding(buildingId)

升级建筑。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| buildingId | string | 建筑唯一ID |

**返回值：** `boolean` - 是否成功

**限制：**
- 检查资源是否足够
- 检查是否已达最高等级

---

#### demolishBuilding(buildingId)

拆除建筑。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| buildingId | string | 建筑唯一ID |

**返回值：** `boolean` - 是否成功

---

### 属性加成

#### getTotalAttributeBonuses()

获取所有建筑提供的总属性加成。

**返回值：**
```javascript
{
    attackBonus: number,   // 攻击力加成
    defenseBonus: number   // 防御力加成
}
```

**示例：**
```javascript
const bonuses = territorySystem.getTotalAttributeBonuses();
console.log(`领地加成: 攻击+${bonuses.attackBonus}, 防御+${bonuses.defenseBonus}`);
```

---

### 领地扩张

#### getExpansionStatus()

获取当前扩张状态。

**返回值：**
```javascript
{
    currentSlots: 6,           // 当前地块数
    maxSlots: 12,              // 最大地块数
    expansionCount: 0,         // 已扩张次数
    canExpand: true,           // 是否可扩张
    nextCost: {                // 下次扩张成本
        gold: 10000,
        crystal: 500,
        contractRequired: 1
    },
    requiredMainBaseLevel: 1,  // 需要主基地等级
    newSlotLevels: [0, 5]      // 新地块解锁等级
}
```

---

#### checkCanExpand()

检查是否可以进行领地扩张。

**返回值：**
```javascript
{
    canExpand: boolean,
    reason: string   // 不能扩张时的原因
}
```

**示例：**
```javascript
const result = territorySystem.checkCanExpand();
if (!result.canExpand) {
    console.log('无法扩张:', result.reason);
}
```

---

#### expandTerritory()

执行领地扩张。

**返回值：**
```javascript
{
    success: boolean,
    message: string,
    newSlots: [
        { index: 6, unlockLevel: 0 },
        { index: 7, unlockLevel: 5 }
    ]
}
```

---

#### getAllSlots()

获取所有地块信息（包括扩张的）。

**返回值：**
```javascript
[
    { index: 0, unlockLevel: 0, alwaysUnlocked: true },
    { index: 1, unlockLevel: 5, alwaysUnlocked: false },
    // ...
    { index: 6, unlockLevel: 0, alwaysUnlocked: false, isExpanded: true },
    // ...
]
```

---

#### getExpansionHistory()

获取扩张历史记录。

**返回值：** `Array` - 扩张记录

---

### 数据持久化

#### saveToLocalStorage()

保存领地数据到 LocalStorage。

**存储键：** `pet-plan-territory`

---

#### loadFromLocalStorage()

从 LocalStorage 加载领地数据。

**返回值：** `boolean` - 是否加载成功

---

#### clearTerritoryData()

清除领地数据（重置为初始状态）。

---

### 存档系统集成

#### getSaveData()

获取存档数据。

**返回值：**
```javascript
{
    level: 1,
    size: { width: 20, height: 20 },
    buildings: [
        { id: 'main_base_1', type: 'main_base', level: 1, position: { x: 10, y: 10 } }
    ],
    buildQueue: [],
    expansion: {
        currentSlots: 6,
        maxSlots: 12,
        expansionCount: 0,
        expandedSlots: []
    }
}
```

---

#### loadSaveData(data)

加载存档数据。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| data | Object | 存档数据 |

---

## 数据结构

### 领地数据

```javascript
{
    level: 1,
    size: { width: 20, height: 20 },
    buildings: [...],
    buildQueue: [...],
    expansion: {
        currentSlots: 6,
        maxSlots: 12,
        expansionCount: 0,
        expandedSlots: []
    }
}
```

### 建筑数据

```javascript
{
    id: 'training_ground_1701676800000',
    type: 'training_ground',
    level: 1,
    position: { x: 5, y: 5 }
}
```

### 建造任务

```javascript
{
    id: 'build_training_ground_1701676800000',
    type: 'training_ground',
    buildingType: 'training_ground',
    position: { x: 5, y: 5 },
    startTime: 1701676800000,
    endTime: 1701676805000,
    buildTime: 5000
}
```

---

## 建筑配置详情

### 主基地 (main_base)

| 等级 | 成本 | 生命值 | 建筑上限 |
|------|------|--------|----------|
| 1 | - | 1000 | 5 |
| 2 | 10000💰+500💎 | 1500 | 8 |

### 训练场 (training_ground)

| 等级 | 成本 | 攻击加成 |
|------|------|----------|
| 1 | 1000💰 | +5 |
| 2 | 5000💰+500💎 | +10 |
| 3 | 15000💰+1500💎 | +20 |

### 神庙 (temple)

| 等级 | 成本 | 防御加成 |
|------|------|----------|
| 1 | 1000💰 | +5 |
| 2 | 5000💰+500💎 | +10 |
| 3 | 15000💰+1500💎 | +20 |

### 工坊 (workshop)

| 等级 | 成本 | 金币产出/小时 |
|------|------|---------------|
| 1 | 3000💰+300💎 | 50 |
| 2 | 12000💰+1200💎 | 100 |
| 3 | 30000💰+3000💎 | 200 |

### 水晶矿 (crystal_mine)

| 等级 | 成本 | 水晶产出/小时 |
|------|------|---------------|
| 1 | 5000💰 | 10 |
| 2 | 20000💰+2000💎 | 25 |
| 3 | 50000💰+5000💎 | 50 |

---

## 扩张配置

| 扩张次数 | 成本 | 主基地等级要求 | 新地块 |
|----------|------|----------------|--------|
| 1 | 10000💰+500💎 | 1 | 2个 |
| 2 | 25000💰+1500💎 | 1 | 2个 |
| 3 | 50000💰+3000💎 | 2 | 2个 |

---

## 使用示例

### 建造建筑流程

```javascript
// 1. 检查是否可以建造
const buildingInfo = territorySystem.getBuildingInfo('training_ground');
const cost = buildingInfo.levels[0].cost;

if (resourceSystem.hasEnoughResources(cost)) {
    // 2. 开始建造
    const task = territorySystem.startBuildBuilding('training_ground', { x: 5, y: 5 });
    
    if (task) {
        // 3. 显示建造进度
        const interval = setInterval(() => {
            const progress = territorySystem.getBuildProgress(task);
            console.log(`建造进度: ${progress}%`);
            
            // 4. 检查是否完成
            const completed = territorySystem.checkAndCompleteBuildings();
            if (completed.length > 0) {
                clearInterval(interval);
                console.log('建造完成!');
            }
        }, 1000);
    }
}
```

### 领地扩张流程

```javascript
// 1. 检查是否可以扩张
const result = territorySystem.checkCanExpand();

if (result.canExpand) {
    // 2. 执行扩张
    const expansion = territorySystem.expandTerritory();
    
    if (expansion.success) {
        console.log(expansion.message);
        expansion.newSlots.forEach(slot => {
            console.log(`新地块 ${slot.index} 解锁等级: ${slot.unlockLevel}`);
        });
    }
} else {
    console.log('无法扩张:', result.reason);
}
```

---

## 注意事项

1. **资源系统依赖**：创建实例时需要传入 ResourceSystem
2. **单例模式**：使用 `getTerritorySystemInstance()` 获取实例
3. **建造队列**：建筑需要时间完成，使用 `checkAndCompleteBuildings()` 检查
4. **建筑上限**：受主基地等级限制
5. **离线完成**：加载存档时会自动完成离线期间到期的建造
