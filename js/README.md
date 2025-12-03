# Pet Plan - 模块化代码结构

## 概述

Pet Plan 项目已经按照系统模块进行了代码拆分，将原本的单一 `game.js` 文件重构为多个独立的模块，提高了代码的可维护性和可扩展性。

## 目录结构

```
js/
├── main.js                 # 主入口文件
├── modules/               # 模块目录
│   ├── index.js          # 模块索引文件
│   ├── game-core.js      # 游戏核心模块
│   ├── player-system.js  # 玩家系统模块
│   ├── combat-system.js  # 战斗系统模块
│   ├── ui-system.js      # UI系统模块
│   └── resource-system.js # 资源系统模块
└── README.md             # 本文件
```

## 模块说明

### 1. GameCore (游戏核心模块)
- **文件**: `modules/game-core.js`
- **职责**: 游戏循环、渲染管理、事件处理等核心功能
- **主要功能**:
  - 游戏主循环 (`gameLoop`)
  - 渲染系统 (`render`)
  - 地图绘制 (草地、云朵等)
  - 系统协调

### 2. PlayerSystem (玩家系统模块)
- **文件**: `modules/player-system.js`
- **职责**: 玩家角色数据、升级系统、动画效果等
- **主要功能**:
  - 玩家数据管理
  - 属性升级系统
  - 批量升级功能
  - 角色渲染和动画
  - 战力计算

### 3. CombatSystem (战斗系统模块)
- **文件**: `modules/combat-system.js`
- **职责**: 怪物生成、子弹系统、碰撞检测、爆炸效果等
- **主要功能**:
  - 怪物生成和管理
  - 子弹系统和轨迹
  - 碰撞检测
  - 爆炸效果
  - 战斗文字显示

### 4. UISystem (UI系统模块)
- **文件**: `modules/ui-system.js`
- **职责**: 用户界面、弹窗、事件绑定等UI相关功能
- **主要功能**:
  - 界面更新和显示
  - 弹窗管理
  - 事件绑定
  - 触摸反馈
  - 消息提示

### 5. ResourceSystem (资源系统模块)
- **文件**: `modules/resource-system.js`
- **职责**: 游戏货币、数字格式化等资源相关功能
- **主要功能**:
  - 金币和红宝石管理
  - 数字格式化 (1000=1A)
  - 本地存储
  - 资源显示更新

## 使用方法

### 导入模块

```javascript
// 导入单个模块
import GameCore from './modules/game-core.js';
import PlayerSystem from './modules/player-system.js';

// 或者从索引文件导入
import { GameCore, PlayerSystem } from './modules/index.js';
```

### 初始化游戏

```javascript
// 创建游戏实例
const game = new Game();
await game.init();
```

## 模块间通信

各个模块通过以下方式进行通信：

1. **依赖注入**: 在构造函数中传入需要的其他模块实例
2. **事件系统**: 通过事件进行模块间的解耦通信
3. **数据共享**: 通过共享的数据对象进行状态同步

## 扩展指南

### 添加新模块

1. 在 `modules/` 目录下创建新的模块文件
2. 在 `modules/index.js` 中添加导出
3. 在 `main.js` 中导入并初始化新模块
4. 更新相关模块的依赖关系

### 修改现有模块

1. 确保修改不会破坏模块的公共接口
2. 更新相关的文档和注释
3. 测试模块间的交互是否正常

## 注意事项

1. **ES6 模块**: 项目使用 ES6 模块系统，需要支持 `import/export` 的现代浏览器
2. **模块依赖**: 注意模块间的依赖关系，避免循环依赖
3. **接口稳定**: 保持模块公共接口的稳定性，避免频繁变更
4. **性能考虑**: 模块化可能会带来轻微的性能开销，但提高了代码质量

## 迁移说明

从原来的 `game.js` 迁移到模块化结构的主要变化：

1. **文件结构**: 单一文件拆分为多个模块文件
2. **类组织**: 原来的 `Game` 类拆分为多个专门的系统类
3. **依赖管理**: 通过构造函数注入管理模块依赖
4. **初始化流程**: 在 `main.js` 中统一管理初始化流程

## 调试支持

- 游戏实例可以通过 `window.game` 访问
- 各个模块实例可以通过游戏实例访问
- 支持浏览器开发者工具进行调试

```javascript
// 在浏览器控制台中访问游戏实例
console.log(window.game.getGameState());
```
