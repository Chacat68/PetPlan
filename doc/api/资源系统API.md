# 资源系统 API 文档

## 概述

本文档描述了资源系统 (`ResourceSystem`) 的完整 API 接口。

## 模块导入

```javascript
import ResourceSystem from './modules/resource-system.js';
```

## 获取实例

```javascript
// 使用单例模式
const resourceSystem = ResourceSystem.getInstance();
```

## 核心 API

### 货币管理

#### 添加货币

##### addCoins(amount)

添加金币。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| amount | number | 添加数量（自动取整，负数无效） |

**示例：**
```javascript
resourceSystem.addCoins(100);
```

---

##### addRubies(amount)

添加红宝石。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| amount | number | 添加数量 |

---

##### addCrystals(amount)

添加水晶。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| amount | number | 添加数量 |

---

#### 消耗货币

##### spendCoins(amount)

消耗金币。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| amount | number | 消耗数量 |

**返回值：** `boolean` - 是否消耗成功

**示例：**
```javascript
if (resourceSystem.spendCoins(500)) {
    console.log('购买成功');
} else {
    console.log('金币不足');
}
```

---

##### spendRubies(amount)

消耗红宝石。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| amount | number | 消耗数量 |

**返回值：** `boolean` - 是否消耗成功

---

##### spendCrystals(amount)

消耗水晶。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| amount | number | 消耗数量 |

**返回值：** `boolean` - 是否消耗成功

---

#### 检查货币

##### hasEnoughCoins(amount)

检查金币是否足够。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| amount | number | 检查数量 |

**返回值：** `boolean`

---

##### hasEnoughRubies(amount)

检查红宝石是否足够。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| amount | number | 检查数量 |

**返回值：** `boolean`

---

##### hasEnoughCrystals(amount)

检查水晶是否足够。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| amount | number | 检查数量 |

**返回值：** `boolean`

---

#### 获取货币数量

##### getCoins()

获取当前金币数量。

**返回值：** `number`

---

##### getRubies()

获取当前红宝石数量。

**返回值：** `number`

---

##### getCrystals()

获取当前水晶数量。

**返回值：** `number`

---

#### 设置货币数量

##### setCoins(amount)

设置金币数量。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| amount | number | 设置数量 |

---

##### setRubies(amount)

设置红宝石数量。

---

##### setCrystals(amount)

设置水晶数量。

---

### 数字格式化

#### formatNumber(num)

将大数字格式化为带字母后缀的简写形式。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| num | number | 要格式化的数字 |

**返回值：** `string` - 格式化后的字符串

**格式规则：**
| 数值范围 | 示例 | 结果 |
|----------|------|------|
| 0-999 | 500 | "500" |
| 1K-999K | 1500 | "1.5A" |
| 1M-999M | 1500000 | "1.5B" |
| 1B+ | 1500000000 | "1.5C" |
| 超大数 | 10^81 | "1AA" |

**示例：**
```javascript
resourceSystem.formatNumber(1234);      // "1.23A"
resourceSystem.formatNumber(12345);     // "12.3A"
resourceSystem.formatNumber(123456);    // "123A"
resourceSystem.formatNumber(1234567);   // "1.23B"
```

---

### 批量操作（领地系统兼容）

#### hasEnoughResources(cost)

检查是否有足够的资源（金币和水晶）。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| cost | Object | { gold: number, crystal: number } |

**返回值：** `boolean`

**示例：**
```javascript
const buildingCost = { gold: 1000, crystal: 100 };
if (resourceSystem.hasEnoughResources(buildingCost)) {
    // 可以建造
}
```

---

#### spendResources(cost)

批量消耗资源（金币和水晶）。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| cost | Object | { gold: number, crystal: number } |

**返回值：** `boolean` - 是否消耗成功

---

### 属性别名

为兼容领地系统：

```javascript
// 只读属性
resourceSystem.gold     // 等同于 getCoins()
resourceSystem.crystal  // 等同于 getCrystals()
```

---

### 数据管理

#### getResourceData()

获取所有资源数据。

**返回值：**
```javascript
{
    coins: number,
    rubies: number,
    crystals: number
}
```

---

#### setResourceData(data)

设置所有资源数据。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| data | Object | 资源数据对象 |

**示例：**
```javascript
resourceSystem.setResourceData({
    coins: 5000,
    rubies: 100,
    crystals: 500
});
```

---

### UI 更新

#### updateCurrencyDisplay()

更新所有货币显示（自动调用）。

**更新的 DOM 元素：**
- `#coins` - 金币显示
- `#gems` - 红宝石显示
- `#crystals` - 水晶显示
- `.character-management-modal .resource-value` - 角色管理界面

---

#### updateCharacterManagementCurrency()

更新角色管理界面的货币显示。

---

### 持久化

#### saveToLocalStorage()

保存资源数据到 LocalStorage。

**存储键：** `pet-plan-resources`

**存储格式：**
```javascript
{
    coins: number,
    rubies: number,
    crystals: number,
    timestamp: number
}
```

---

#### loadFromLocalStorage()

从 LocalStorage 加载资源数据。

**返回值：** `boolean` - 是否加载成功

---

#### clearLocalStorage()

清除 LocalStorage 中的资源数据。

---

### 存档系统集成

#### getSaveData()

获取存档数据。

**返回值：**
```javascript
{
    coins: number,
    rubies: number,
    crystals: number
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

## 内部方法

### _sanitizeAmount(amount)

清洗数值输入。

- 非数字 → 0
- 无限值 → 0
- 负数 → 0
- 小数 → 取整

---

### _safeSum(base, delta)

安全加法，避免 NaN 和负数。

---

## 静态属性

### ResourceSystem.instance

单例实例引用。

---

## 实例属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| coins | number | 1000 | 金币数量 |
| rubies | number | 50 | 红宝石数量 |
| crystals | number | 200 | 水晶数量 |
| debug | boolean | false | 调试模式 |
| numberSuffixes | string[] | [...] | 数字后缀列表 |
| _lastDisplay | Object | {...} | 上次显示缓存 |

---

## 使用示例

### 基础使用

```javascript
// 获取实例
const rs = ResourceSystem.getInstance();

// 检查和消耗
if (rs.hasEnoughCoins(100)) {
    rs.spendCoins(100);
    console.log('购买成功！剩余金币:', rs.formatNumber(rs.getCoins()));
}

// 添加奖励
rs.addCoins(500);
rs.addRubies(10);
```

### 与战斗系统集成

```javascript
// 击杀怪物奖励
function onMonsterKilled(monster) {
    resourceSystem.addCoins(monster.coinReward);
    
    // 10% 概率掉落红宝石
    if (Math.random() < 0.1) {
        const rubyReward = 1 + Math.floor(Math.random() * 3);
        resourceSystem.addRubies(rubyReward);
    }
    
    // 5% 概率掉落水晶
    if (Math.random() < 0.05) {
        const crystalReward = 1 + Math.floor(Math.random() * 2);
        resourceSystem.addCrystals(crystalReward);
    }
}
```

### 与领地系统集成

```javascript
// 建造建筑
function buildBuilding(buildingType) {
    const cost = getBuildingCost(buildingType);
    
    if (resourceSystem.hasEnoughResources(cost)) {
        resourceSystem.spendResources(cost);
        // 执行建造逻辑
    }
}
```

### 存档管理

```javascript
// 保存
function saveGame() {
    const resourceData = resourceSystem.getSaveData();
    // 合并到总存档数据
    saveData.resources = resourceData;
}

// 加载
function loadGame(saveData) {
    if (saveData.resources) {
        resourceSystem.loadSaveData(saveData.resources);
    }
}
```

---

## 注意事项

1. **单例模式**：始终使用 `ResourceSystem.getInstance()` 获取实例
2. **自动UI更新**：货币变化会自动触发 UI 更新
3. **数值安全**：所有输入都会经过清洗，防止 NaN 和负数
4. **LocalStorage 限制**：注意浏览器存储容量限制
5. **领地兼容**：使用 `gold`/`crystal` 别名时注意它们是只读的
