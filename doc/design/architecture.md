# 系统架构设计

## 整体结构

PetPlan 是无构建步骤的 ES Module 单页游戏。HTML/CSS 管理场景和管理面板，Canvas 管理战斗画面，LocalStorage 保存进度。

```text
index.html
  -> Game (js/main.js)
      -> SceneRouter / ModalFocusManager
      -> GameCore
          -> PlayerSystem / CombatSystem / PetSystem
      -> FateCoinSystem / TerritorySystem / ResourceSystem / ProgressionSystem
      -> SaveSystem / UISystem
```

`territory.html` 仅保留旧链接兼容性，并重定向至 `index.html?scene=territory`；它不再有独立系统或资源数据。

## 运行时边界

| 组件 | 责任 |
| --- | --- |
| `Game` | 初始化系统、连接跨系统回调、处理玩法流程 |
| `GameCore` | Canvas 帧循环、战斗画面、自动保存计时 |
| `FateCoinSystem` | 命运资源、自动翻转、成长成本 |
| `SceneRouter` | 命运/战斗/领地显示状态、HUD 状态、`?scene=` URL |
| `ModalFocusManager` | 模态初始焦点、Tab 限制、关闭后的焦点恢复 |
| `TerritorySystem` | 地块、建筑、循环脉冲、长期资源产出 |
| `ProgressionSystem` | 首局目标、成长倾向、成就领取状态 |
| `progression-config.js` | 成本、脉冲权重、目标与倾向映射的唯一数值来源 |
| `SaveSystem` | 槽位存档、导入导出、系统数据汇总 |

## 数据流

```text
用户操作
  -> 系统状态变更
  -> Game 更新表现层
  -> SaveSystem 定时或手动保存
  -> LocalStorage
```

场景路由只管理表现状态，不复制游戏数据。命运、战斗、领地共享同一批系统实例和存档。`ProgressionSystem` 只保存领取状态；首局步骤和成长倾向始终从当前玩法状态派生。

## 路由

- 默认地址打开命运场景。
- `?scene=dungeon` 打开战斗。
- `?scene=territory` 打开领地。
- HUD 场景切换会更新 URL，浏览器前进/后退会同步场景。
- 宠物和成就是模态页面，不写入场景 URL。

## 文件结构

```text
PetPlan/
├── index.html
├── territory.html              # 兼容跳转
├── css/style.css
├── js/main.js
├── js/modules/
│   ├── game-core.js
│   ├── fate-coin-system.js
│   ├── player-system.js
│   ├── pet-system.js
│   ├── combat-system.js
│   ├── territory-system.js
│   ├── resource-system.js
│   ├── save-system.js
│   ├── progression-system.js
│   ├── progression-config.js
│   ├── scene-router.js
│   └── modal-focus-manager.js
├── images/
├── doc/
└── tests/                      # 浏览器诊断页
```

## 扩展原则

1. 玩法状态加入对应系统，并提供 `getSaveData()` / `loadSaveData()`。
2. 场景显示行为放入 `SceneRouter` 或具体 presenter，不在系统模块中直接操作 DOM。
3. 动态模态打开后交给 `ModalFocusManager` 管理焦点。
4. 所有入口都指向主游戏，避免为子系统创建第二份资源、存档或进度状态。
5. 影响成长节奏的常量只写入 `progression-config.js`，不得在 UI 推荐或领地模块中复制魔法数值。
