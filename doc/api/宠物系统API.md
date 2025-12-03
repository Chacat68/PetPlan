# 宠物系统 API 文档

## 概述

本文档描述了宠物系统 (`PetSystem`) 的完整 API 接口。

## 模块导入

```javascript
import PetSystem, { getPetSystemInstance } from './modules/pet-system.js';
```

## 获取实例

```javascript
// 推荐：使用单例模式
const petSystem = getPetSystemInstance(gameCore, resourceSystem);
```

## 核心 API

### 宠物收集

#### unlockPet(petId)

解锁并添加宠物到背包。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| petId | number | 宠物模板ID (1-8) |

**返回值：**
```javascript
{
    success: boolean,    // 是否成功
    message: string,     // 结果消息
    pet?: Object         // 成功时返回宠物实例
}
```

**示例：**
```javascript
const result = petSystem.unlockPet(1);
if (result.success) {
    console.log('解锁成功:', result.pet.name);
}
```

---

#### createPet(petId, level)

创建宠物实例（内部方法）。

**参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| petId | number | - | 宠物模板ID |
| level | number | 1 | 初始等级 |

**返回值：** `Pet Object | null`

---

### 宠物编队

#### equipPet(petInstanceId, position, slotIndex)

将宠物装备到指定槽位。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| petInstanceId | number | 宠物实例ID |
| position | string | 位置: 'front' \| 'back' |
| slotIndex | number | 槽位索引: 0-2 |

**返回值：**
```javascript
{
    success: boolean,
    message: string
}
```

**示例：**
```javascript
// 将宠物装备到前排第一个槽位
const result = petSystem.equipPet(pet.instanceId, 'front', 0);
```

---

#### unequipPet(petInstanceId)

从槽位卸下宠物。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| petInstanceId | number | 宠物实例ID |

**返回值：**
```javascript
{
    success: boolean,
    message: string
}
```

---

### 宠物养成

#### upgradePet(petInstanceId)

升级宠物（需要足够经验）。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| petInstanceId | number | 宠物实例ID |

**返回值：**
```javascript
{
    success: boolean,
    message: string
}
```

**升级效果：**
- 攻击力 +5
- 最大生命值 +20
- 防御力 +2
- 升级经验需求 ×1.5

---

#### feedPet(petInstanceId)

喂食宠物。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| petInstanceId | number | 宠物实例ID |

**返回值：**
```javascript
{
    success: boolean,
    message: string
}
```

**效果：**
- 饱腹度 +30
- 精力 +20
- 好感度 +2
- 消耗: 50 × 等级 金币

---

#### trainPet(petInstanceId)

训练宠物获取经验。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| petInstanceId | number | 宠物实例ID |

**返回值：**
```javascript
{
    success: boolean,
    message: string
}
```

**效果：**
- 获得经验: 20 + 等级 × 5
- 好感度 +1
- 消耗: 100 × 等级 金币
- 消耗: 20 精力

---

### 查询接口

#### getEquippedPets()

获取所有已装备的宠物列表。

**返回值：** `Pet[]`

**示例：**
```javascript
const equippedPets = petSystem.getEquippedPets();
equippedPets.forEach(pet => {
    console.log(`${pet.name} - Lv.${pet.level}`);
});
```

---

#### getTotalPowerBonus()

获取已装备宠物提供的总战力加成。

**返回值：**
```javascript
{
    attack: number,   // 攻击力加成总和
    defense: number   // 防御力加成总和
}
```

---

#### getRarityConfig(rarity)

获取稀有度配置信息。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| rarity | string | 稀有度: common/uncommon/rare/epic/legendary |

**返回值：**
```javascript
{
    color: string,   // 显示颜色
    name: string,    // 中文名称
    star: number     // 星级 1-5
}
```

---

### 战斗相关

#### setCombatSystem(combatSystem)

设置战斗系统引用，建立双向通信。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| combatSystem | CombatSystem | 战斗系统实例 |

---

#### update(deltaTime)

更新宠物系统状态（每帧调用）。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| deltaTime | number | 帧间隔时间(ms) |

**更新内容：**
- 宠物状态（饱腹度、精力）
- 宠物战斗（普通攻击、技能）
- 子弹移动和碰撞
- 技能特效

---

#### render(ctx)

渲染宠物系统（每帧调用）。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| ctx | CanvasRenderingContext2D | Canvas 上下文 |

**渲染内容：**
- 宠物图标和生命条
- 宠物子弹
- 技能特效

---

### 存档接口

#### getSaveData()

获取存档数据。

**返回值：**
```javascript
{
    ownedPets: [{
        instanceId: number,
        templateId: number,
        level: number,
        exp: number,
        expToNext: number,
        attack: number,
        hp: number,
        maxHp: number,
        defense: number,
        friendship: number,
        hunger: number,
        energy: number,
        lastFeedTime: number,
        lastTrainTime: number,
        position: Object | null
    }],
    slots: {
        front: [number | null, number | null, number | null],
        back: [number | null, number | null, number | null]
    }
}
```

---

#### loadSaveData(data)

加载存档数据。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| data | Object | 存档数据对象 |

---

#### resetAll()

清空所有宠物数据（用于测试或重置）。

---

## 内部方法

### 战斗相关

| 方法 | 说明 |
|------|------|
| updatePetStates(deltaTime) | 更新宠物养成状态 |
| updatePetCombat(deltaTime) | 更新宠物战斗逻辑 |
| petNormalAttack(pet, position, slotIndex) | 宠物普通攻击 |
| petUseSkill(pet, position, slotIndex) | 宠物释放技能 |
| applySkillEffect(effect) | 应用技能效果 |
| findNearestMonster(pet, position, slotIndex) | 寻找最近怪物 |
| getPetPosition(position, slotIndex) | 计算宠物Canvas位置 |

### 子弹系统

| 方法 | 说明 |
|------|------|
| updatePetBullets(deltaTime) | 更新子弹移动 |
| renderPetBullets(ctx) | 渲染子弹 |

### 技能特效

| 方法 | 说明 |
|------|------|
| updateSkillEffects(deltaTime) | 更新技能特效 |
| renderSkillEffects(ctx) | 渲染技能特效 |
| renderFireball(ctx, effect) | 渲染火球术 |
| renderFrostNova(ctx, effect) | 渲染冰霜新星 |
| renderChainLightning(ctx, effect) | 渲染连锁闪电 |

### 渲染

| 方法 | 说明 |
|------|------|
| renderPets(ctx) | 渲染宠物图标和生命条 |

---

## 数据结构

### 宠物模板 (petDatabase)

```javascript
{
    id: 1,
    name: '火焰犬',
    rarity: 'common',        // common/uncommon/rare/epic/legendary
    type: 'fire',            // fire/ice/thunder/earth/wind/light/dark/phoenix
    baseAttack: 15,
    baseHp: 80,
    baseDefense: 5,
    attackSpeed: 1.0,
    skill: {
        id: 'fireball',
        name: '火球术',
        cooldown: 5000,
        damage: 50,
        description: '发射火球造成范围伤害'
    },
    image: '🔥🐕',
    description: '忠诚的火系伙伴',
    unlockLevel: 1,
    unlockCost: { coins: 500, gems: 0 }
}
```

### 宠物实例

```javascript
{
    instanceId: 1234567890.123,  // 唯一标识
    templateId: 1,               // 模板ID
    
    // 基础信息
    name: '火焰犬',
    rarity: 'common',
    type: 'fire',
    image: '🔥🐕',
    
    // 成长属性
    level: 1,
    exp: 0,
    expToNext: 100,
    
    // 战斗属性
    attack: 15,
    hp: 80,
    maxHp: 80,
    currentHp: 80,
    defense: 5,
    attackSpeed: 1.0,
    
    // 养成属性
    friendship: 0,         // 好感度 0-100
    hunger: 100,           // 饱腹度 0-100
    energy: 100,           // 精力 0-100
    lastFeedTime: number,  // 上次喂食时间戳
    lastTrainTime: number, // 上次训练时间戳
    
    // 状态
    position: { type: 'front'|'back', index: 0-2 } | null,
    isInBattle: false,
    buffs: [],
    debuffs: [],
    
    // 技能
    skill: { ... }
}
```

### 子弹数据

```javascript
{
    petId: number,      // 所属宠物ID
    x: number,          // 当前X坐标
    y: number,          // 当前Y坐标
    targetX: number,    // 目标X坐标
    targetY: number,    // 目标Y坐标
    damage: number,     // 伤害值
    speed: 300,         // 移动速度
    type: 'fire',       // 宠物类型(决定颜色)
    size: 6,            // 子弹大小
    life: 3000          // 生命周期(ms)
}
```

### 技能特效数据

```javascript
{
    petId: number,      // 所属宠物ID
    skillId: string,    // 技能ID
    x: number,          // 释放X坐标
    y: number,          // 释放Y坐标
    type: string,       // 宠物类型
    damage: number,     // 伤害值
    duration: number,   // 持续时间
    life: number,       // 剩余时间
    targets: number,    // 目标数量
    // 其他技能特有属性...
}
```

---

## 使用示例

### 完整流程示例

```javascript
// 1. 初始化宠物系统
const petSystem = getPetSystemInstance(gameCore, resourceSystem);
petSystem.setCombatSystem(combatSystem);

// 2. 解锁宠物
const result = petSystem.unlockPet(1); // 解锁火焰犬
if (result.success) {
    const pet = result.pet;
    
    // 3. 装备到前排第一个槽位
    petSystem.equipPet(pet.instanceId, 'front', 0);
    
    // 4. 养成宠物
    petSystem.feedPet(pet.instanceId);  // 喂食
    petSystem.trainPet(pet.instanceId); // 训练
    
    // 5. 查看战力加成
    const bonus = petSystem.getTotalPowerBonus();
    console.log(`攻击力加成: +${bonus.attack}`);
}

// 6. 游戏循环中调用
function gameLoop(deltaTime) {
    petSystem.update(deltaTime);
    petSystem.render(ctx);
}

// 7. 存档
const saveData = petSystem.getSaveData();
localStorage.setItem('pet-data', JSON.stringify(saveData));

// 8. 加载存档
const loadedData = JSON.parse(localStorage.getItem('pet-data'));
petSystem.loadSaveData(loadedData);
```

---

## 注意事项

1. **单例模式**：使用 `getPetSystemInstance()` 获取实例，确保全局唯一
2. **系统依赖**：需要先设置 `combatSystem` 引用才能进行战斗
3. **存档时机**：建议在 `SaveSystem` 中统一管理存档
4. **性能优化**：`update` 和 `render` 方法每帧调用，注意性能
5. **状态衰减**：宠物的饱腹度会随时间减少，需定期喂食
