# 玩家系统API

## 概述

玩家系统API提供了管理游戏主角的所有功能，包括角色属性、升级系统、动画效果、生命值管理等核心功能。

## 玩家数据API

### player 对象

```javascript
game.player
```

**类型**: object

**功能**: 玩家数据对象

#### 位置属性

##### x

```javascript
game.player.x
```

**类型**: number

**功能**: 玩家X坐标

**默认值**: 35

**示例**:
```javascript
// 获取玩家X坐标
const playerX = game.player.x;

// 设置玩家X坐标
game.player.x = 50;
```

##### y

```javascript
game.player.y
```

**类型**: number

**功能**: 玩家Y坐标

**默认值**: canvas.height / 2 - 25.5

**示例**:
```javascript
// 获取玩家Y坐标
const playerY = game.player.y;
```

##### width

```javascript
game.player.width
```

**类型**: number

**功能**: 玩家宽度

**默认值**: 51

**示例**:
```javascript
// 获取玩家宽度
const playerWidth = game.player.width;
```

##### height

```javascript
game.player.height
```

**类型**: number

**功能**: 玩家高度

**默认值**: 51

**示例**:
```javascript
// 获取玩家高度
const playerHeight = game.player.height;
```

#### 移动属性

##### speed

```javascript
game.player.speed
```

**类型**: number

**功能**: 玩家移动速度

**默认值**: 50

**示例**:
```javascript
// 获取移动速度
const speed = game.player.speed;

// 设置移动速度
game.player.speed = 100;
```

##### direction

```javascript
game.player.direction
```

**类型**: number

**功能**: 玩家朝向

**值**: 1 (右) 或 -1 (左)

**默认值**: 1

**示例**:
```javascript
// 获取朝向
const direction = game.player.direction;

// 设置朝向
game.player.direction = -1; // 向左
```

##### animationFrame

```javascript
game.player.animationFrame
```

**类型**: number

**功能**: 动画帧数

**默认值**: 0

**示例**:
```javascript
// 获取动画帧数
const frame = game.player.animationFrame;
```

#### 战斗属性

##### level

```javascript
game.player.level
```

**类型**: number

**功能**: 玩家等级

**默认值**: 1

**示例**:
```javascript
// 获取玩家等级
const level = game.player.level;

// 设置玩家等级
game.player.level = 10;
```

##### hp

```javascript
game.player.hp
```

**类型**: number

**功能**: 当前生命值

**默认值**: 100

**示例**:
```javascript
// 获取当前生命值
const currentHp = game.player.hp;

// 设置当前生命值
game.player.hp = 150;
```

##### maxHp

```javascript
game.player.maxHp
```

**类型**: number

**功能**: 最大生命值

**默认值**: 100

**示例**:
```javascript
// 获取最大生命值
const maxHp = game.player.maxHp;

// 设置最大生命值
game.player.maxHp = 200;
```

##### attack

```javascript
game.player.attack
```

**类型**: number

**功能**: 攻击力

**默认值**: 20

**示例**:
```javascript
// 获取攻击力
const attack = game.player.attack;

// 设置攻击力
game.player.attack = 50;
```

##### hpRegen

```javascript
game.player.hpRegen
```

**类型**: number

**功能**: 生命恢复速度

**默认值**: 1

**示例**:
```javascript
// 获取生命恢复速度
const hpRegen = game.player.hpRegen;

// 设置生命恢复速度
game.player.hpRegen = 5;
```

##### critDamage

```javascript
game.player.critDamage
```

**类型**: number

**功能**: 暴击伤害百分比

**默认值**: 150

**示例**:
```javascript
// 获取暴击伤害
const critDamage = game.player.critDamage;

// 设置暴击伤害
game.player.critDamage = 200;
```

##### attackSpeed

```javascript
game.player.attackSpeed
```

**类型**: number

**功能**: 攻击速度

**默认值**: 1.0

**示例**:
```javascript
// 获取攻击速度
const attackSpeed = game.player.attackSpeed;

// 设置攻击速度
game.player.attackSpeed = 2.0;
```

##### crit

```javascript
game.player.crit
```

**类型**: number

**功能**: 暴击率百分比

**默认值**: 5

**示例**:
```javascript
// 获取暴击率
const crit = game.player.crit;

// 设置暴击率
game.player.crit = 20;
```

##### multiShot

```javascript
game.player.multiShot
```

**类型**: number

**功能**: 连射数量

**默认值**: 1

**示例**:
```javascript
// 获取连射数量
const multiShot = game.player.multiShot;

// 设置连射数量
game.player.multiShot = 3;
```

##### tripleShot

```javascript
game.player.tripleShot
```

**类型**: number

**功能**: 三连射概率百分比

**默认值**: 0

**示例**:
```javascript
// 获取三连射概率
const tripleShot = game.player.tripleShot;

// 设置三连射概率
game.player.tripleShot = 50;
```

#### 升级成本

##### upgradeCosts

```javascript
game.player.upgradeCosts
```

**类型**: object

**功能**: 各属性升级成本

**属性**:
- `attack` (number): 攻击力升级成本
- `hp` (number): 生命值升级成本
- `hpRegen` (number): 生命恢复升级成本
- `critDamage` (number): 暴击伤害升级成本
- `attackSpeed` (number): 攻击速度升级成本
- `crit` (number): 暴击率升级成本
- `multiShot` (number): 连射升级成本
- `tripleShot` (number): 三连射升级成本

**示例**:
```javascript
// 获取攻击力升级成本
const attackCost = game.player.upgradeCosts.attack;

// 设置攻击力升级成本
game.player.upgradeCosts.attack = 100;
```

## 升级系统API

### upgradeAttribute(attribute, increase, silent)

```javascript
upgradeAttribute(attribute, increase, silent = false)
```

**功能**: 升级玩家属性

**参数**:
- `attribute` (string): 要升级的属性名称
- `increase` (number): 增加的数值
- `silent` (boolean): 是否静默升级（不显示动画）

**返回值**: void

**示例**:
```javascript
// 升级攻击力
game.upgradeAttribute('attack', 5);

// 静默升级生命值
game.upgradeAttribute('hp', 20, true);
```

**支持的属性**:
- `attack`: 攻击力
- `hp`: 生命值
- `hpRegen`: 生命恢复
- `critDamage`: 暴击伤害
- `attackSpeed`: 攻击速度
- `crit`: 暴击率
- `multiShot`: 连射
- `tripleShot`: 三连射

### bulkUpgradeAttribute(attribute, times)

```javascript
bulkUpgradeAttribute(attribute, times)
```

**功能**: 批量升级属性

**参数**:
- `attribute` (string): 要升级的属性名称
- `times` (number): 升级次数

**返回值**: void

**示例**:
```javascript
// 批量升级攻击力10次
game.bulkUpgradeAttribute('attack', 10);
```

### canUpgrade(attribute, times)

```javascript
canUpgrade(attribute, times = 1)
```

**功能**: 检查属性是否可以升级

**参数**:
- `attribute` (string): 属性名称
- `times` (number): 升级次数，默认为1

**返回值**: boolean

**示例**:
```javascript
// 检查攻击力是否可以升级
if (game.canUpgrade('attack')) {
    console.log('可以升级攻击力');
}

// 检查是否可以批量升级10次
if (game.canUpgrade('attack', 10)) {
    console.log('可以批量升级10次');
}
```

### getBulkUpgradeCost(attribute, times)

```javascript
getBulkUpgradeCost(attribute, times)
```

**功能**: 计算批量升级的总成本

**参数**:
- `attribute` (string): 属性名称
- `times` (number): 升级次数

**返回值**: object

**返回对象**:
- `totalCost` (number): 总成本
- `allowedTimes` (number): 允许的升级次数

**示例**:
```javascript
// 计算攻击力升级10次的成本
const cost = game.getBulkUpgradeCost('attack', 10);
console.log(`总成本: ${cost.totalCost}, 允许次数: ${cost.allowedTimes}`);
```

### getMaxAffordableUpgrades(attribute)

```javascript
getMaxAffordableUpgrades(attribute)
```

**功能**: 计算当前金币能升级的最高次数

**参数**:
- `attribute` (string): 属性名称

**返回值**: number

**示例**:
```javascript
// 计算攻击力最多能升级多少次
const maxUpgrades = game.getMaxAffordableUpgrades('attack');
console.log(`最多能升级 ${maxUpgrades} 次`);
```

## 总战力计算API

### calculateTotalPower()

```javascript
calculateTotalPower()
```

**功能**: 计算玩家总战力

**返回值**: number

**示例**:
```javascript
// 计算总战力
const totalPower = game.calculateTotalPower();
console.log(`总战力: ${totalPower}`);
```

**计算公式**:
- 攻击力: `attack * 10`
- 暴击伤害: `critDamage * 2`
- 攻击速度: `attackSpeed * 50`
- 暴击率: `crit * 3`
- 连射: `multiShot * 20`
- 三连射: `tripleShot * 5`

### updateTotalPower()

```javascript
updateTotalPower()
```

**功能**: 更新总战力显示

**返回值**: void

**示例**:
```javascript
// 更新总战力显示
game.updateTotalPower();
```

## 升级按钮管理API

### updateUpgradeButtons()

```javascript
updateUpgradeButtons()
```

**功能**: 更新所有升级按钮的状态

**返回值**: void

**示例**:
```javascript
// 更新升级按钮状态
game.updateUpgradeButtons();
```

### updateUpgradeItems()

```javascript
updateUpgradeItems()
```

**功能**: 更新升级项目的显示信息

**返回值**: void

**示例**:
```javascript
// 更新升级项目显示
game.updateUpgradeItems();
```

## 动画和视觉效果API

### showUpgradeSuccess(button, attribute)

```javascript
showUpgradeSuccess(button, attribute)
```

**功能**: 显示升级成功动画

**参数**:
- `button` (HTMLElement): 升级按钮元素
- `attribute` (string): 升级的属性名称

**返回值**: void

**示例**:
```javascript
// 显示升级成功动画
const button = document.getElementById('upgradeAttack');
game.showUpgradeSuccess(button, 'attack');
```

### showInsufficientCoins(button)

```javascript
showInsufficientCoins(button)
```

**功能**: 显示金币不足动画

**参数**:
- `button` (HTMLElement): 升级按钮元素

**返回值**: void

**示例**:
```javascript
// 显示金币不足动画
const button = document.getElementById('upgradeAttack');
game.showInsufficientCoins(button);
```

## 长按升级菜单API

### bindLongPressUpgradeMenu()

```javascript
bindLongPressUpgradeMenu()
```

**功能**: 绑定长按升级菜单功能

**返回值**: void

**示例**:
```javascript
// 绑定长按升级菜单
game.bindLongPressUpgradeMenu();
```

### showUpgradeMenu(button, attribute, event)

```javascript
showUpgradeMenu(button, attribute, event)
```

**功能**: 显示升级子菜单

**参数**:
- `button` (HTMLElement): 升级按钮元素
- `attribute` (string): 属性名称
- `event` (Event): 触发事件

**返回值**: void

**示例**:
```javascript
// 显示升级菜单
const button = document.getElementById('upgradeAttack');
game.showUpgradeMenu(button, 'attack', event);
```

### hideUpgradeMenu()

```javascript
hideUpgradeMenu()
```

**功能**: 隐藏升级子菜单

**返回值**: void

**示例**:
```javascript
// 隐藏升级菜单
game.hideUpgradeMenu();
```

### bindUpgradeMenuButtons()

```javascript
bindUpgradeMenuButtons()
```

**功能**: 绑定子菜单按钮事件

**返回值**: void

**示例**:
```javascript
// 绑定子菜单按钮事件
game.bindUpgradeMenuButtons();
```

### updateUpgradeMenuButtons(attribute)

```javascript
updateUpgradeMenuButtons(attribute)
```

**功能**: 更新子菜单按钮状态

**参数**:
- `attribute` (string): 属性名称

**返回值**: void

**示例**:
```javascript
// 更新子菜单按钮状态
game.updateUpgradeMenuButtons('attack');
```

## 属性增量配置API

### attributeIncreases

```javascript
game.attributeIncreases
```

**类型**: object

**功能**: 各属性每次升级的增量

**属性**:
- `attack` (number): 攻击力增量
- `hp` (number): 生命值增量
- `hpRegen` (number): 生命恢复增量
- `critDamage` (number): 暴击伤害增量
- `attackSpeed` (number): 攻击速度增量
- `crit` (number): 暴击率增量
- `multiShot` (number): 连射增量
- `tripleShot` (number): 三连射增量

**示例**:
```javascript
// 获取攻击力增量
const attackIncrease = game.attributeIncreases.attack;

// 设置攻击力增量
game.attributeIncreases.attack = 10;
```

## 升级限制API

### 升级上限检查

```javascript
// 检查连射上限
if (game.player.multiShot >= 100) {
    console.log('连射已达到上限');
}

// 检查暴击上限
if (game.player.crit >= 126.2) {
    console.log('暴击已达到上限');
}

// 检查攻击速度上限
if (game.player.attackSpeed >= 8.08) {
    console.log('攻击速度已达到上限');
}

// 检查三连射上限
if (game.player.tripleShot >= 100) {
    console.log('三连射已达到上限');
}
```

### 等级上限检查

```javascript
// 检查连射等级上限
const multiShotLevel = Math.floor((game.player.multiShot - 1) / 1) + 1;
if (multiShotLevel >= 1001) {
    console.log('连射已达到最高等级');
}

// 检查暴击等级上限
const critLevel = Math.floor((game.player.crit - 5) / 1) + 1;
if (critLevel >= 1001) {
    console.log('暴击已达到最高等级');
}

// 检查攻击速度等级上限
const attackSpeedLevel = Math.floor((game.player.attackSpeed - 1.0) / 0.1) + 1;
if (attackSpeedLevel >= 201) {
    console.log('攻击速度已达到最高等级');
}

// 检查三连射等级上限
const tripleShotLevel = Math.floor((game.player.tripleShot - 0) / 5) + 1;
if (tripleShotLevel >= 1001) {
    console.log('三连射已达到最高等级');
}
```

## 玩家更新API

### updatePlayer(deltaTime)

```javascript
updatePlayer(deltaTime)
```

**功能**: 更新玩家状态

**参数**:
- `deltaTime` (number): 时间差

**返回值**: void

**示例**:
```javascript
// 更新玩家状态
game.updatePlayer(16.67);
```

**更新内容**:
- 动画帧数递增
- 保持固定朝向
- 生命值自动恢复

## 玩家渲染API

### drawPlayer()

```javascript
drawPlayer()
```

**功能**: 渲染玩家角色

**返回值**: void

**示例**:
```javascript
// 渲染玩家
game.drawPlayer();
```

**渲染内容**:
- 角色图片或占位符
- 奔跑动画效果
- 脚部阴影
- 攻击范围指示器
- 生命值条

## 生命值条API

### drawHealthBar(x, y, width, currentHp, maxHp, bgColor, fillColor)

```javascript
drawHealthBar(x, y, width, currentHp, maxHp, bgColor, fillColor)
```

**功能**: 绘制生命值条

**参数**:
- `x` (number): X坐标
- `y` (number): Y坐标
- `width` (number): 生命值条宽度
- `currentHp` (number): 当前生命值
- `maxHp` (number): 最大生命值
- `bgColor` (string): 背景颜色
- `fillColor` (string): 填充颜色

**返回值**: void

**示例**:
```javascript
// 绘制生命值条
game.drawHealthBar(100, 100, 200, 80, 100, '#ff4757', '#2ed573');
```

## 最佳实践

### 1. 属性升级

```javascript
// 检查是否可以升级
if (game.canUpgrade('attack')) {
    // 检查金币是否足够
    const cost = game.player.upgradeCosts.attack;
    if (game.coins >= cost) {
        game.upgradeAttribute('attack', 5);
    }
}
```

### 2. 批量升级

```javascript
// 批量升级前检查
const maxUpgrades = game.getMaxAffordableUpgrades('attack');
if (maxUpgrades > 0) {
    game.bulkUpgradeAttribute('attack', maxUpgrades);
}
```

### 3. 属性限制检查

```javascript
// 升级前检查上限
function safeUpgrade(attribute, increase) {
    if (game.canUpgrade(attribute)) {
        game.upgradeAttribute(attribute, increase);
    } else {
        console.log(`${attribute} 已达到上限`);
    }
}
```

### 4. 总战力监控

```javascript
// 监控总战力变化
let lastPower = 0;
function monitorPower() {
    const currentPower = game.calculateTotalPower();
    if (currentPower !== lastPower) {
        console.log(`总战力变化: ${lastPower} -> ${currentPower}`);
        lastPower = currentPower;
    }
}
```

### 5. 错误处理

```javascript
// 安全的属性访问
function getPlayerAttribute(attribute) {
    try {
        return game.player[attribute];
    } catch (error) {
        console.error(`获取属性 ${attribute} 失败:`, error);
        return null;
    }
}
```
