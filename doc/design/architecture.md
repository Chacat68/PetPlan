# 系统架构设计

## 整体架构

PetPlan 采用单页面应用 (SPA) 架构，基于 HTML5 Canvas 技术构建。

```
┌─────────────────────────────────────┐
│            UI 表现层                │
│  (HTML + CSS + Canvas 渲染)        │
├─────────────────────────────────────┤
│           游戏逻辑层                 │
│     (Game 类 + 各子系统)           │
├─────────────────────────────────────┤
│           数据管理层                 │
│    (玩家数据 + 游戏状态)            │
├─────────────────────────────────────┤
│           持久化层                   │
│   (LocalStorage + 存档系统)        │
└─────────────────────────────────────┘
```

---

## 核心组件

| 组件                | 文件                             | 职责                               |
| ------------------- | -------------------------------- | ---------------------------------- |
| **Game**            | `js/main.js`                     | 游戏主控制器，初始化和协调各子系统 |
| **GameCore**        | `js/modules/game-core.js`        | 游戏循环、场景渲染、帧率控制       |
| **PlayerSystem**    | `js/modules/player-system.js`    | 玩家属性、升级、战力计算           |
| **CombatSystem**    | `js/modules/combat-system.js`    | 怪物、子弹、碰撞检测、伤害         |
| **PetSystem**       | `js/modules/pet-system.js`       | 宠物收集、养成、编队、战斗         |
| **TerritorySystem** | `js/modules/territory-system.js` | 领地建设、建筑升级、资源产出       |
| **ResourceSystem**  | `js/modules/resource-system.js`  | 金币/红宝石/水晶管理               |
| **SaveSystem**      | `js/modules/save-system.js`      | 存档管理、导入导出                 |
| **UISystem**        | `js/modules/ui-system.js`        | 界面渲染、弹窗、交互               |

---

## 模块依赖关系

```
                    ┌─────────────┐
                    │   Game      │
                    │  (main.js)  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   GameCore    │  │   SaveSystem  │  │   UISystem    │
└───────┬───────┘  └───────────────┘  └───────────────┘
        │
┌───────┴──────────────────────────────────────┐
│                                              │
├──▶ PlayerSystem                              │
├──▶ CombatSystem ◀───▶ PetSystem              │
├──▶ TerritorySystem                           │
└──▶ ResourceSystem (单例，被所有系统引用)      │
```

---

## 游戏主循环

```
requestAnimationFrame
    ↓
GameCore.gameLoop()
    ↓
┌───────────────────────────────────────────┐
│  GameCore.update(deltaTime)               │
│    ├── PlayerSystem.update()              │
│    ├── CombatSystem.update()              │
│    │     └── PetSystem.update()           │
│    ├── UISystem.update()                  │
│    └── SaveSystem.updateAutoSave()        │
└───────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────┐
│  GameCore.render(ctx)                     │
│    ├── 绘制场景 (天空、山、地面、云)      │
│    ├── PlayerSystem.render()              │
│    ├── PetSystem.render()                 │
│    └── CombatSystem.render()              │
└───────────────────────────────────────────┘
```

---

## 数据流

### 游戏状态数据流

```
用户操作 → 事件处理 → 游戏逻辑更新 → 数据状态变更 → UI 更新 → 渲染更新
```

### 存档数据流

```
用户触发保存
    ↓
SaveSystem.saveGame()
    ↓
┌───────────────────────────────────────────┐
│  getGameState()                           │
│    ├── PlayerSystem.getSaveData()         │
│    ├── TerritorySystem.getSaveData()      │
│    ├── ResourceSystem.getSaveData()       │
│    ├── CombatSystem.getSaveData()         │
│    └── PetSystem.getSaveData()            │
└───────────────────────────────────────────┘
    ↓
JSON.stringify() → LocalStorage
```

---

## 设计原则

### 单例模式

关键系统采用单例模式，确保全局唯一实例：

- ResourceSystem
- TerritorySystem
- SaveSystem
- PetSystem

### 单一职责原则

每个模块只负责特定功能：

- GameCore 负责游戏循环和场景渲染
- PlayerSystem 只管理玩家相关逻辑
- CombatSystem 只处理战斗相关功能

### 松耦合设计

模块间通过明确的接口通信：

- 使用 `setSystems()` 方法设置系统引用
- 通过 `getSaveData()` / `loadSaveData()` 统一存档接口

---

## 文件结构

```
PetPlan/
├── index.html              # 主游戏页面
├── territory.html          # 领地系统页面
├── css/
│   ├── style.css           # 主样式
│   ├── menu.css            # 菜单样式
│   ├── character-management.css
│   ├── pet-system.css
│   └── save-system.css
├── js/
│   ├── main.js             # 游戏入口和 Game 类
│   └── modules/
│       ├── game-core.js
│       ├── player-system.js
│       ├── combat-system.js
│       ├── pet-system.js
│       ├── territory-system.js
│       ├── resource-system.js
│       ├── save-system.js
│       └── ui-system.js
├── images/
│   ├── cw/                 # 宠物图片
│   └── rw/                 # 角色图片
├── doc/                    # 文档
└── tests/                  # 测试文件
```

---

## 性能优化

| 策略             | 实现方式                                         |
| ---------------- | ------------------------------------------------ |
| **渲染优化**     | requestAnimationFrame、60 FPS 限制、禁用图像平滑 |
| **DOM 更新优化** | 货币显示缓存对比、批量 DOM 操作                  |
| **内存管理**     | 及时清理过期对象、单例模式、对象复用             |
| **计算优化**     | 数值清洗避免 NaN、安全加法避免溢出               |

---

## 扩展指南

添加新系统模块：

```javascript
// 1. 创建新模块
class NewSystem { ... }

// 2. 在 main.js 中导入和初始化
import NewSystem from './modules/new-system.js';
this.newSystem = new NewSystem();

// 3. 设置系统引用
this.gameCore.setSystems(..., this.newSystem);

// 4. 实现存档接口
getSaveData() { ... }
loadSaveData(data) { ... }
```
