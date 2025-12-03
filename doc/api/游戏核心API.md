# 游戏核心API

## 概述

游戏核心API提供了Pet Plan游戏的主要功能接口，包括游戏初始化、游戏循环、渲染系统、事件处理等核心功能。

## Game 类

### 构造函数

```javascript
new Game()
```

**功能**: 创建游戏实例

**返回值**: Game实例

**示例**:
```javascript
const game = new Game();
```

### 核心方法

#### gameLoop(currentTime)

```javascript
gameLoop(currentTime = 0)
```

**功能**: 游戏主循环

**参数**:
- `currentTime` (number): 当前时间戳，默认为0

**返回值**: void

**示例**:
```javascript
// 手动调用游戏循环
game.gameLoop(performance.now());
```

#### update(deltaTime)

```javascript
update(deltaTime)
```

**功能**: 更新游戏逻辑

**参数**:
- `deltaTime` (number): 距离上一帧的时间差（毫秒）

**返回值**: void

**示例**:
```javascript
// 更新游戏逻辑
game.update(16.67); // 约60FPS的时间差
```

#### render()

```javascript
render()
```

**功能**: 渲染游戏画面

**返回值**: void

**示例**:
```javascript
// 渲染游戏画面
game.render();
```

#### init()

```javascript
init()
```

**功能**: 初始化游戏

**返回值**: void

**示例**:
```javascript
// 初始化游戏
game.init();
```

## 数字格式化API

### formatNumber(num)

```javascript
formatNumber(num)
```

**功能**: 将大数字转换为易读格式

**参数**:
- `num` (number): 要格式化的数字

**返回值**: string - 格式化后的字符串

**示例**:
```javascript
game.formatNumber(1000);    // "1A"
game.formatNumber(1000000); // "1B"
game.formatNumber(1000000000); // "1C"
game.formatNumber(1000000000000); // "1AA"
```

**格式化规则**:
- 小于1000: 直接显示整数
- 1000-999999: 使用单字母后缀 (A-Z)
- 1000000+: 使用双字母后缀 (AA, AB, AC...)

## 事件系统API

### bindEvents()

```javascript
bindEvents()
```

**功能**: 绑定所有用户交互事件

**返回值**: void

**示例**:
```javascript
// 绑定事件
game.bindEvents();
```

### bindUpgradeButton(buttonId, attribute, increase)

```javascript
bindUpgradeButton(buttonId, attribute, increase)
```

**功能**: 绑定升级按钮事件

**参数**:
- `buttonId` (string): 按钮元素ID
- `attribute` (string): 要升级的属性名称
- `increase` (number): 每次升级的增量

**返回值**: void

**示例**:
```javascript
// 绑定攻击力升级按钮
game.bindUpgradeButton('upgradeAttack', 'attack', 5);
```

### bindStatusIconEvents()

```javascript
bindStatusIconEvents()
```

**功能**: 绑定状态图标事件

**返回值**: void

**示例**:
```javascript
// 绑定状态图标事件
game.bindStatusIconEvents();
```

### bindNavigationEvents()

```javascript
bindNavigationEvents()
```

**功能**: 绑定导航栏事件

**返回值**: void

**示例**:
```javascript
// 绑定导航栏事件
game.bindNavigationEvents();
```

### addTouchFeedback()

```javascript
addTouchFeedback()
```

**功能**: 添加触摸反馈效果

**返回值**: void

**示例**:
```javascript
// 添加触摸反馈
game.addTouchFeedback();
```

## 工具提示API

### showStatusTooltip(element, message)

```javascript
showStatusTooltip(element, message)
```

**功能**: 显示状态图标的工具提示

**参数**:
- `element` (HTMLElement): 触发元素
- `message` (string): 提示信息

**返回值**: void

**示例**:
```javascript
// 显示工具提示
const icon = document.querySelector('.status-icon');
game.showStatusTooltip(icon, '商城');
```

## 游戏状态API

### 属性访问

#### isRunning

```javascript
game.isRunning
```

**类型**: boolean

**功能**: 游戏运行状态

**示例**:
```javascript
// 检查游戏是否运行
if (game.isRunning) {
    console.log('游戏正在运行');
}
```

#### lastTime

```javascript
game.lastTime
```

**类型**: number

**功能**: 上一帧的时间戳

**示例**:
```javascript
// 获取上一帧时间
const lastFrameTime = game.lastTime;
```

#### canvas

```javascript
game.canvas
```

**类型**: HTMLCanvasElement

**功能**: 游戏画布元素

**示例**:
```javascript
// 获取画布元素
const canvas = game.canvas;
```

#### ctx

```javascript
game.ctx
```

**类型**: CanvasRenderingContext2D

**功能**: 画布2D渲染上下文

**示例**:
```javascript
// 获取渲染上下文
const ctx = game.ctx;
```

## 地图和画布API

### mapWidth

```javascript
game.mapWidth
```

**类型**: number

**功能**: 地图宽度

**示例**:
```javascript
// 获取地图宽度
const width = game.mapWidth;
```

### mapHeight

```javascript
game.mapHeight
```

**类型**: number

**功能**: 地图高度

**示例**:
```javascript
// 获取地图高度
const height = game.mapHeight;
```

## 资源管理API

### coins

```javascript
game.coins
```

**类型**: number

**功能**: 玩家金币数量

**示例**:
```javascript
// 获取金币数量
const coins = game.coins;

// 设置金币数量
game.coins = 1000;
```

### rubies

```javascript
game.rubies
```

**类型**: number

**功能**: 玩家红宝石数量

**示例**:
```javascript
// 获取红宝石数量
const rubies = game.rubies;

// 设置红宝石数量
game.rubies = 50;
```

## 玩家系统API

### player

```javascript
game.player
```

**类型**: object

**功能**: 玩家数据对象

**属性**:
- `x` (number): X坐标
- `y` (number): Y坐标
- `width` (number): 宽度
- `height` (number): 高度
- `level` (number): 等级
- `hp` (number): 当前生命值
- `maxHp` (number): 最大生命值
- `attack` (number): 攻击力
- `hpRegen` (number): 生命恢复速度
- `critDamage` (number): 暴击伤害百分比
- `attackSpeed` (number): 攻击速度
- `crit` (number): 暴击率百分比
- `multiShot` (number): 连射数量
- `tripleShot` (number): 三连射概率百分比

**示例**:
```javascript
// 获取玩家攻击力
const attack = game.player.attack;

// 设置玩家生命值
game.player.hp = 100;
```

## 战斗系统API

### monsters

```javascript
game.monsters
```

**类型**: Array

**功能**: 怪物数组

**示例**:
```javascript
// 获取怪物数量
const monsterCount = game.monsters.length;

// 遍历所有怪物
game.monsters.forEach(monster => {
    console.log(monster.hp);
});
```

### bullets

```javascript
game.bullets
```

**类型**: Array

**功能**: 子弹数组

**示例**:
```javascript
// 获取子弹数量
const bulletCount = game.bullets.length;
```

### explosions

```javascript
game.explosions
```

**类型**: Array

**功能**: 爆炸效果数组

**示例**:
```javascript
// 获取爆炸效果数量
const explosionCount = game.explosions.length;
```

### combatTexts

```javascript
game.combatTexts
```

**类型**: Array

**功能**: 战斗文字数组

**示例**:
```javascript
// 获取战斗文字数量
const textCount = game.combatTexts.length;
```

## 图片资源API

### playerImage

```javascript
game.playerImage
```

**类型**: HTMLImageElement

**功能**: 玩家角色图片

**示例**:
```javascript
// 检查图片是否加载完成
if (game.playerImageLoaded) {
    console.log('角色图片已加载');
}
```

### playerImageLoaded

```javascript
game.playerImageLoaded
```

**类型**: boolean

**功能**: 玩家图片加载状态

**示例**:
```javascript
// 检查图片加载状态
if (game.playerImageLoaded) {
    console.log('图片加载成功');
} else {
    console.log('图片加载失败');
}
```

## 游戏配置API

### monsterSpawnInterval

```javascript
game.monsterSpawnInterval
```

**类型**: number

**功能**: 怪物生成间隔（毫秒）

**示例**:
```javascript
// 设置怪物生成间隔
game.monsterSpawnInterval = 1500; // 1.5秒
```

### attackInterval

```javascript
game.attackInterval
```

**类型**: number

**功能**: 攻击间隔（毫秒）

**示例**:
```javascript
// 设置攻击间隔
game.attackInterval = 600; // 0.6秒
```

### attackRange

```javascript
game.attackRange
```

**类型**: number

**功能**: 攻击范围（像素）

**示例**:
```javascript
// 设置攻击范围
game.attackRange = 500;
```

## 错误处理API

### 初始化错误处理

```javascript
// 检查画布元素
if (!game.canvas) {
    console.error('无法找到游戏画布元素');
}

// 检查渲染上下文
if (!game.ctx) {
    console.error('无法获取画布上下文');
}
```

### 图片加载错误处理

```javascript
// 图片加载成功
game.playerImage.onload = () => {
    game.playerImageLoaded = true;
    console.log('角色图片加载成功');
};

// 图片加载失败
game.playerImage.onerror = () => {
    console.error('角色图片加载失败:', game.playerImage.src);
    game.playerImageLoaded = false;
};
```

## 性能监控API

### 帧率监控

```javascript
// 监控帧率
let frameCount = 0;
let lastFpsTime = 0;

function updateFPS(currentTime) {
    frameCount++;
    if (currentTime - lastFpsTime >= 1000) {
        console.log('FPS:', frameCount);
        frameCount = 0;
        lastFpsTime = currentTime;
    }
}
```

### 内存监控

```javascript
// 监控内存使用
function checkMemory() {
    if (performance.memory) {
        console.log('内存使用:', {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        });
    }
}
```

## 调试API

### 调试模式

```javascript
// 调试模式开关
const DEBUG_MODE = true;

if (DEBUG_MODE) {
    // 显示调试信息
    game.drawDebugInfo();
    
    // 记录性能数据
    game.recordPerformance();
}
```

### 调试信息显示

```javascript
// 显示调试信息
function drawDebugInfo() {
    const ctx = game.ctx;
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText(`FPS: ${Math.round(1000 / deltaTime)}`, 10, 20);
    ctx.fillText(`Monsters: ${game.monsters.length}`, 10, 40);
    ctx.fillText(`Bullets: ${game.bullets.length}`, 10, 60);
}
```

## 扩展API

### 自定义事件

```javascript
// 触发自定义事件
game.emit('custom:event', { data: 'value' });

// 监听自定义事件
game.on('custom:event', (data) => {
    console.log('收到自定义事件:', data);
});
```

### 插件系统

```javascript
// 注册插件
game.registerPlugin('myPlugin', {
    init: function() {
        console.log('插件初始化');
    },
    update: function(deltaTime) {
        // 插件更新逻辑
    },
    render: function(ctx) {
        // 插件渲染逻辑
    }
});
```

## 最佳实践

### 1. 游戏初始化

```javascript
// 正确的游戏初始化
document.addEventListener('DOMContentLoaded', () => {
    try {
        const game = new Game();
        window.gameInstance = game;
        console.log('游戏初始化成功');
    } catch (error) {
        console.error('游戏初始化失败:', error);
    }
});
```

### 2. 错误处理

```javascript
// 添加错误处理
try {
    game.update(deltaTime);
} catch (error) {
    console.error('游戏更新失败:', error);
    // 实现错误恢复逻辑
}
```

### 3. 性能优化

```javascript
// 使用requestAnimationFrame
function gameLoop(currentTime) {
    game.update(currentTime - lastTime);
    game.render();
    lastTime = currentTime;
    requestAnimationFrame(gameLoop);
}
```

### 4. 资源管理

```javascript
// 预加载资源
function preloadResources() {
    const images = ['player.png', 'monster.png'];
    const promises = images.map(src => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = reject;
            img.src = src;
        });
    });
    
    return Promise.all(promises);
}
```
