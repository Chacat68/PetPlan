# 编码规范

## 概述

本文档定义了 Pet Plan 项目的编码规范和最佳实践，旨在提高代码质量、可读性和可维护性。

## 通用规范

### 1. 命名规范

#### 变量命名
```javascript
// 使用驼峰命名法
const playerName = '孙悟空';
const maxHealth = 100;
const isGameRunning = true;

// 常量使用全大写
const MAX_LEVEL = 100;
const GAME_CONFIG = {
    width: 400,
    height: 435
};

// 私有变量使用下划线前缀
const _privateVariable = 'private';
```

#### 函数命名
```javascript
// 使用动词开头的驼峰命名法
function updatePlayer() { }
function calculateDamage() { }
function renderGame() { }

// 布尔值函数使用 is/has/can 前缀
function isPlayerAlive() { }
function hasEnoughCoins() { }
function canUpgrade() { }
```

#### 类命名
```javascript
// 使用帕斯卡命名法
class Game { }
class PlayerSystem { }
class CombatSystem { }
```

#### 文件命名
```javascript
// 使用小写字母和连字符
game-core.js
player-system.js
combat-system.js
```

### 2. 代码格式

#### 缩进
```javascript
// 使用 4 个空格缩进
function example() {
    if (condition) {
        console.log('Hello World');
    }
}
```

#### 大括号
```javascript
// 使用 K&R 风格
if (condition) {
    // 代码
} else {
    // 代码
}

// 函数声明
function example() {
    // 代码
}
```

#### 分号
```javascript
// 始终使用分号
const name = 'Pet Plan';
const version = '1.0.0';

function example() {
    console.log('Hello');
}
```

#### 引号
```javascript
// 使用单引号
const message = 'Hello World';
const html = '<div class="container"></div>';

// 字符串包含单引号时使用双引号
const text = "It's a beautiful day";
```

### 3. 注释规范

#### 单行注释
```javascript
// 这是单行注释
const player = new Player(); // 创建玩家实例
```

#### 多行注释
```javascript
/**
 * 这是多行注释
 * 用于描述复杂的功能
 */
function complexFunction() {
    // 实现代码
}
```

#### 函数注释
```javascript
/**
 * 升级玩家属性
 * @param {string} attribute - 要升级的属性名称
 * @param {number} increase - 增加的数值
 * @param {boolean} silent - 是否静默升级
 * @returns {void}
 */
function upgradeAttribute(attribute, increase, silent = false) {
    // 实现代码
}
```

#### 类注释
```javascript
/**
 * 游戏核心类
 * 负责管理游戏循环、渲染和事件处理
 */
class Game {
    /**
     * 构造函数
     */
    constructor() {
        // 初始化代码
    }
}
```

## JavaScript 规范

### 1. 变量声明

#### 使用 const 和 let
```javascript
// 优先使用 const
const player = new Player();
const gameConfig = { width: 400, height: 435 };

// 需要重新赋值时使用 let
let currentLevel = 1;
let gameState = 'running';

// 避免使用 var
// var oldVariable = 'avoid this';
```

#### 解构赋值
```javascript
// 对象解构
const { x, y, width, height } = player;

// 数组解构
const [first, second, third] = monsters;

// 函数参数解构
function updatePlayer({ x, y, health }) {
    // 使用解构的参数
}
```

### 2. 函数规范

#### 箭头函数
```javascript
// 简单函数使用箭头函数
const add = (a, b) => a + b;
const isEven = num => num % 2 === 0;

// 复杂函数使用普通函数
function complexCalculation(data) {
    // 复杂的计算逻辑
    return result;
}
```

#### 默认参数
```javascript
// 使用默认参数
function createMonster(type = 'goblin', level = 1) {
    // 实现代码
}

// 对象默认参数
function updatePlayer({ x = 0, y = 0, health = 100 } = {}) {
    // 实现代码
}
```

#### 剩余参数
```javascript
// 使用剩余参数
function calculateTotal(...numbers) {
    return numbers.reduce((sum, num) => sum + num, 0);
}
```

### 3. 对象和数组

#### 对象字面量
```javascript
// 使用对象字面量
const player = {
    name: '孙悟空',
    level: 1,
    health: 100,
    
    // 方法使用简写
    attack() {
        return this.level * 10;
    }
};
```

#### 数组方法
```javascript
// 使用数组方法
const numbers = [1, 2, 3, 4, 5];

// 使用 map 而不是 for 循环
const doubled = numbers.map(num => num * 2);

// 使用 filter 过滤数组
const evenNumbers = numbers.filter(num => num % 2 === 0);

// 使用 reduce 聚合数据
const sum = numbers.reduce((acc, num) => acc + num, 0);
```

#### 展开运算符
```javascript
// 数组展开
const newArray = [...oldArray, newItem];

// 对象展开
const newObject = { ...oldObject, newProperty: value };

// 函数参数展开
function example(...args) {
    // 处理参数
}
```

### 4. 异步编程

#### Promise
```javascript
// 使用 Promise
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// 使用 async/await
async function loadGameAssets() {
    try {
        const playerImage = await loadImage('player.png');
        const monsterImage = await loadImage('monster.png');
        return { playerImage, monsterImage };
    } catch (error) {
        console.error('加载资源失败:', error);
    }
}
```

### 5. 错误处理

#### try-catch
```javascript
// 使用 try-catch 处理错误
try {
    const result = riskyOperation();
    console.log('操作成功:', result);
} catch (error) {
    console.error('操作失败:', error);
    // 错误恢复逻辑
}
```

#### 错误类型
```javascript
// 自定义错误类型
class GameError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'GameError';
        this.code = code;
    }
}

// 使用自定义错误
throw new GameError('玩家不存在', 'PLAYER_NOT_FOUND');
```

## CSS 规范

### 1. 命名规范

#### BEM 命名法
```css
/* 块 (Block) */
.player { }

/* 元素 (Element) */
.player__avatar { }
.player__name { }
.player__health-bar { }

/* 修饰符 (Modifier) */
.player--active { }
.player--dead { }
.player__health-bar--low { }
```

#### 类名规范
```css
/* 使用小写字母和连字符 */
.game-container { }
.character-management-modal { }
.upgrade-button { }
```

### 2. 选择器规范

#### 选择器优先级
```css
/* 避免过深的选择器 */
.game .player .avatar .image { } /* 避免 */

/* 使用合适的选择器 */
.player-avatar { } /* 推荐 */
```

#### 属性顺序
```css
.element {
    /* 定位 */
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    
    /* 盒模型 */
    display: block;
    width: 100px;
    height: 100px;
    margin: 10px;
    padding: 5px;
    border: 1px solid #000;
    
    /* 外观 */
    background: #fff;
    color: #000;
    font-size: 14px;
    text-align: center;
    
    /* 其他 */
    cursor: pointer;
    transition: all 0.3s ease;
}
```

### 3. 响应式设计

#### 媒体查询
```css
/* 移动端优先 */
.container {
    width: 100%;
    padding: 10px;
}

/* 平板端 */
@media (min-width: 768px) {
    .container {
        width: 750px;
        margin: 0 auto;
    }
}

/* 桌面端 */
@media (min-width: 1024px) {
    .container {
        width: 1000px;
    }
}
```

#### 弹性布局
```css
/* 使用 Flexbox */
.flex-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
}

.flex-item {
    flex: 1;
    min-width: 200px;
}
```

## HTML 规范

### 1. 文档结构

#### DOCTYPE 声明
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pet Plan</title>
</head>
<body>
    <!-- 内容 -->
</body>
</html>
```

#### 语义化标签
```html
<!-- 使用语义化标签 -->
<header>
    <nav>
        <ul>
            <li><a href="#home">首页</a></li>
            <li><a href="#game">游戏</a></li>
        </ul>
    </nav>
</header>

<main>
    <section>
        <h1>游戏标题</h1>
        <p>游戏描述</p>
    </section>
</main>

<footer>
    <p>&copy; 2024 Pet Plan</p>
</footer>
```

### 2. 属性规范

#### 属性顺序
```html
<!-- 推荐的属性顺序 -->
<img src="image.jpg" 
     alt="描述" 
     class="image" 
     id="main-image" 
     width="100" 
     height="100" 
     loading="lazy">
```

#### 布尔属性
```html
<!-- 布尔属性不需要值 -->
<input type="checkbox" checked>
<button disabled>按钮</button>
<video autoplay muted loop>
```

### 3. 可访问性

#### alt 属性
```html
<!-- 图片必须有 alt 属性 -->
<img src="player.png" alt="玩家角色">
<img src="decoration.png" alt=""> <!-- 装饰性图片使用空 alt -->
```

#### 标签关联
```html
<!-- 表单元素与标签关联 -->
<label for="player-name">玩家姓名</label>
<input type="text" id="player-name" name="playerName">

<!-- 或者使用 label 包裹 -->
<label>
    玩家姓名
    <input type="text" name="playerName">
</label>
```

## 性能优化规范

### 1. 代码优化

#### 避免重复计算
```javascript
// 避免在循环中重复计算
// 错误示例
for (let i = 0; i < monsters.length; i++) {
    const distance = Math.sqrt(
        Math.pow(monsters[i].x - player.x, 2) + 
        Math.pow(monsters[i].y - player.y, 2)
    );
}

// 正确示例
const playerX = player.x;
const playerY = player.y;
for (let i = 0; i < monsters.length; i++) {
    const monster = monsters[i];
    const distance = Math.sqrt(
        Math.pow(monster.x - playerX, 2) + 
        Math.pow(monster.y - playerY, 2)
    );
}
```

#### 使用对象池
```javascript
// 使用对象池减少垃圾回收
class BulletPool {
    constructor() {
        this.pool = [];
    }
    
    get() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return { x: 0, y: 0, speed: 300, life: 2000 };
    }
    
    release(bullet) {
        bullet.x = 0;
        bullet.y = 0;
        bullet.life = 0;
        this.pool.push(bullet);
    }
}
```

### 2. DOM 操作优化

#### 批量 DOM 操作
```javascript
// 使用 DocumentFragment 批量操作
const fragment = document.createDocumentFragment();
for (let i = 0; i < 100; i++) {
    const div = document.createElement('div');
    div.textContent = `Item ${i}`;
    fragment.appendChild(div);
}
document.body.appendChild(fragment);
```

#### 缓存 DOM 查询
```javascript
// 缓存 DOM 元素
const elements = {
    player: document.getElementById('player'),
    score: document.getElementById('score'),
    health: document.getElementById('health')
};

// 避免重复查询
function updateUI() {
    elements.score.textContent = game.score;
    elements.health.textContent = game.health;
}
```

### 3. 事件处理优化

#### 事件委托
```javascript
// 使用事件委托
document.addEventListener('click', (e) => {
    if (e.target.matches('.upgrade-button')) {
        handleUpgrade(e.target);
    }
});

// 避免为每个元素绑定事件
// document.querySelectorAll('.upgrade-button').forEach(btn => {
//     btn.addEventListener('click', handleUpgrade);
// });
```

#### 防抖和节流
```javascript
// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
```

## 测试规范

### 1. 单元测试

#### 测试结构
```javascript
// 使用描述性的测试名称
describe('Player System', () => {
    describe('upgradeAttribute', () => {
        it('should increase attack when upgrading attack', () => {
            // 测试代码
        });
        
        it('should not upgrade when insufficient coins', () => {
            // 测试代码
        });
    });
});
```

#### 测试数据
```javascript
// 使用测试数据
const testPlayer = {
    attack: 20,
    coins: 100,
    upgradeCosts: { attack: 10 }
};

// 测试升级功能
it('should upgrade attack correctly', () => {
    const initialAttack = testPlayer.attack;
    upgradeAttribute('attack', 5);
    expect(testPlayer.attack).toBe(initialAttack + 5);
});
```

### 2. 集成测试

#### 游戏循环测试
```javascript
// 测试游戏循环
describe('Game Loop', () => {
    it('should update all systems', () => {
        const game = new Game();
        const initialMonsterCount = game.monsters.length;
        
        game.update(16.67); // 模拟一帧
        
        // 验证更新结果
        expect(game.monsters.length).toBeGreaterThanOrEqual(initialMonsterCount);
    });
});
```

## 文档规范

### 1. 代码文档

#### JSDoc 注释
```javascript
/**
 * 计算两个点之间的距离
 * @param {Object} point1 - 第一个点
 * @param {number} point1.x - X坐标
 * @param {number} point1.y - Y坐标
 * @param {Object} point2 - 第二个点
 * @param {number} point2.x - X坐标
 * @param {number} point2.y - Y坐标
 * @returns {number} 两点之间的距离
 * @example
 * const distance = getDistance({x: 0, y: 0}, {x: 3, y: 4});
 * console.log(distance); // 5
 */
function getDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
}
```

### 2. README 文档

#### 项目说明
```markdown
# 宠物计划

## 项目描述
宠物计划是一个基于 HTML5 Canvas 的宠物养成类游戏。

## 功能特性
- 实时战斗系统
- 角色升级系统
- 资源管理系统
- 响应式用户界面设计

## 技术栈
- HTML5 Canvas
- JavaScript (ES6+)
- CSS3

## 快速开始
1. 克隆项目
2. 启动本地服务器
3. 打开浏览器访问

## 开发指南
详见 [开发文档](./doc/development/)
```

## 版本控制规范

### 1. Git 提交规范

#### 提交信息格式
```bash
# 格式: <type>(<scope>): <subject>
# 类型: feat, fix, docs, style, refactor, test, chore

# 示例
git commit -m "feat(player): 添加角色升级功能"
git commit -m "fix(combat): 修复碰撞检测bug"
git commit -m "docs(api): 更新API文档"
```

#### 分支命名
```bash
# 功能分支
feature/player-upgrade
feature/combat-system

# 修复分支
fix/collision-detection
fix/memory-leak

# 发布分支
release/v1.0.0
```

### 2. 代码审查

#### 审查清单
- [ ] 代码符合编码规范
- [ ] 功能实现正确
- [ ] 性能优化合理
- [ ] 错误处理完善
- [ ] 测试覆盖充分
- [ ] 文档更新及时

## 最佳实践总结

### 1. 代码质量
- 保持代码简洁和可读性
- 使用有意义的变量和函数名
- 添加适当的注释和文档
- 遵循单一职责原则

### 2. 性能优化
- 避免不必要的计算和DOM操作
- 使用对象池和缓存
- 优化事件处理
- 监控性能指标

### 3. 错误处理
- 使用 try-catch 处理异常
- 提供友好的错误信息
- 实现优雅的降级处理
- 记录错误日志

### 4. 用户体验
- 提供即时反馈
- 优化加载性能
- 支持多种输入方式
- 确保可访问性
