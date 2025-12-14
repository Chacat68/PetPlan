# 装备系统 API 文档

## 模块导出

```javascript
import { getEquipmentSystemInstance } from './modules/equipment-system.js';
import EquipmentUI from './modules/equipment-ui.js';
```

## EquipmentSystem

装备系统的核心类，管理装备、装配和属性计算。

### 单例模式

使用单例模式确保全局只有一个实例：

```javascript
const equipmentSystem = getEquipmentSystemInstance();
```

### 核心方法

#### `init()`

初始化装备系统。

```javascript
equipmentSystem.init();
```

**参数：** 无

**返回值：** `void`

---

#### `addEquipment(equipment)`

添加装备到玩家背包。

```javascript
const newEquipment = {
    id: 'sword_001',
    name: '铁剑',
    type: 'weapon',
    part: 'main_hand',
    quality: 1,
    baseAttack: 10
};
equipmentSystem.addEquipment(newEquipment);
```

**参数：**
- `equipment` (Object) - 装备对象

**返回值：** `boolean` - 是否添加成功

---

#### `removeEquipment(equipmentId)`

从背包移除装备。

```javascript
equipmentSystem.removeEquipment('sword_001');
```

**参数：**
- `equipmentId` (string) - 装备 ID

**返回值：** `boolean` - 是否移除成功

---

#### `equipItem(equipmentId, part)`

装备一个装备到指定部位。

```javascript
equipmentSystem.equipItem('sword_001', 'main_hand');
```

**参数：**
- `equipmentId` (string) - 装备 ID
- `part` (string) - 装备部位（如 'main_hand', 'head' 等）

**返回值：** `Object`
- `success` (boolean) - 是否成功
- `message` (string) - 提示信息
- `unequipped` (Object) - 卸下的装备（如有）

**支持的部位：**
- `head` - 头部
- `body` - 身体
- `hands` - 手部
- `feet` - 足部
- `main_hand` - 主武器
- `off_hand` - 副武器
- `accessory_1`, `accessory_2`, `accessory_3` - 饰品槽位

---

#### `unequipItem(part)`

卸下指定部位的装备。

```javascript
equipmentSystem.unequipItem('main_hand');
```

**参数：**
- `part` (string) - 装备部位

**返回值：** `Object`
- `success` (boolean) - 是否成功
- `unequipped` (Object) - 卸下的装备

---

#### `getEquippedItems()`

获取所有装备的装备信息。

```javascript
const equipped = equipmentSystem.getEquippedItems();
```

**参数：** 无

**返回值：** `Object` - 装备槽位信息

**返回值结构：**
```javascript
{
    head: equipmentObject or null,
    body: equipmentObject or null,
    hands: equipmentObject or null,
    feet: equipmentObject or null,
    mainHand: equipmentObject or null,
    offHand: equipmentObject or null,
    accessories: [equipmentObject, ...]
}
```

---

#### `getBackpackItems()`

获取背包中的所有装备。

```javascript
const backpack = equipmentSystem.getBackpackItems();
```

**参数：** 无

**返回值：** `Array<Object>` - 装备数组

---

#### `getEquipment(equipmentId)`

获取指定 ID 的装备。

```javascript
const equipment = equipmentSystem.getEquipment('sword_001');
```

**参数：**
- `equipmentId` (string) - 装备 ID

**返回值：** `Object` - 装备对象

---

#### `getTotalAttributeBonus()`

获取所有装备的总属性加成。

```javascript
const bonus = equipmentSystem.getTotalAttributeBonus();
// { attack: 50, defense: 30, hp: 100, ... }
```

**参数：** 无

**返回值：** `Object` - 属性加成对象

**返回值结构：**
```javascript
{
    attack: 50,
    defense: 30,
    hp: 100,
    speed: 10,
    // ... 其他属性
}
```

---

#### `upgradeEquipment(equipmentId, amount)`

升级装备。

```javascript
equipmentSystem.upgradeEquipment('sword_001', 100);
```

**参数：**
- `equipmentId` (string) - 装备 ID
- `amount` (number) - 升级所需的经验值

**返回值：** `Object`
- `success` (boolean) - 是否成功
- `newLevel` (number) - 新等级
- `message` (string) - 提示信息

---

#### `combineEquipment(equipmentId1, equipmentId2)`

合成两个装备为一个更高级的装备。

```javascript
const result = equipmentSystem.combineEquipment('sword_001', 'sword_002');
```

**参数：**
- `equipmentId1` (string) - 第一个装备 ID
- `equipmentId2` (string) - 第二个装备 ID

**返回值：** `Object`
- `success` (boolean) - 是否成功
- `newEquipment` (Object) - 合成得到的新装备
- `message` (string) - 提示信息

---

#### `calculateEquipmentPower(equipment)`

计算装备的战力。

```javascript
const power = equipmentSystem.calculateEquipmentPower(equipment);
```

**参数：**
- `equipment` (Object) - 装备对象

**返回值：** `number` - 战力值

---

#### `getSystemData()`

获取系统的完整数据（用于存档）。

```javascript
const data = equipmentSystem.getSystemData();
```

**参数：** 无

**返回值：** `Object` - 系统数据

---

#### `loadSystemData(data)`

加载系统数据（用于读档）。

```javascript
equipmentSystem.loadSystemData(savedData);
```

**参数：**
- `data` (Object) - 系统数据

**返回值：** `void`

---

## EquipmentUI

装备系统的 UI 管理类。

### 构造函数

```javascript
const ui = new EquipmentUI();
```

### 核心方法

#### `createUI()`

创建装备界面。

```javascript
ui.createUI();
```

**参数：** 无

**返回值：** `void`

---

#### `show()`

显示装备界面。

```javascript
ui.show();
```

**参数：** 无

**返回值：** `void`

---

#### `hide()`

隐藏装备界面。

```javascript
ui.hide();
```

**参数：** 无

**返回值：** `void`

---

#### `update()`

更新装备界面显示。

```javascript
ui.update();
```

**参数：** 无

**返回值：** `void`

---

## 事件和回调

### 装备穿戴事件

当装备穿戴时触发：

```javascript
equipmentSystem.on('item_equipped', (equipmentId, part) => {
    console.log(`装备 ${equipmentId} 穿戴到 ${part}`);
});
```

### 装备卸下事件

当装备卸下时触发：

```javascript
equipmentSystem.on('item_unequipped', (equipmentId, part) => {
    console.log(`从 ${part} 卸下装备 ${equipmentId}`);
});
```

### 装备升级事件

当装备升级时触发：

```javascript
equipmentSystem.on('item_upgraded', (equipmentId, newLevel) => {
    console.log(`装备 ${equipmentId} 升级到 ${newLevel} 级`);
});
```

## 使用示例

### 基础用法

```javascript
import { getEquipmentSystemInstance } from './modules/equipment-system.js';

const equipmentSystem = getEquipmentSystemInstance();

// 初始化
equipmentSystem.init();

// 添加装备到背包
const equipment = {
    id: 'sword_001',
    name: '铁剑',
    type: 'weapon',
    part: 'main_hand',
    quality: 1,
    baseAttack: 10
};
equipmentSystem.addEquipment(equipment);

// 装备到槽位
const result = equipmentSystem.equipItem('sword_001', 'main_hand');
if (result.success) {
    console.log('装备成功！');
}

// 获取总属性加成
const bonus = equipmentSystem.getTotalAttributeBonus();
console.log('总攻击加成：', bonus.attack);
```

### 与玩家系统集成

```javascript
import { getPlayerSystemInstance } from './modules/player-system.js';

const playerSystem = getPlayerSystemInstance();
const equipmentSystem = getEquipmentSystemInstance();

// 计算玩家总属性
const playerStats = {
    attack: playerSystem.baseAttack,
    defense: playerSystem.baseDefense,
    hp: playerSystem.maxHp
};

// 添加装备加成
const bonus = equipmentSystem.getTotalAttributeBonus();
playerStats.attack += bonus.attack;
playerStats.defense += bonus.defense;
playerStats.hp += bonus.hp;
```

### 与存档系统集成

```javascript
// 保存
const equipmentData = equipmentSystem.getSystemData();
saveGame.equipment = equipmentData;

// 加载
equipmentSystem.loadSystemData(loadedGame.equipment);
```

---

**版本**：v1.0.0  
**最后更新**：2025年12月14日
