# 系统架构设计

## 整体结构

PetPlan 是无构建步骤的 ES Module 单页游戏。HTML/CSS 管理场景和管理面板，Canvas 管理战斗画面，LocalStorage 保存进度。

```text
index.html
  -> Game (js/main.js：系统装配、跨系统回调、高层场景协调)
      -> GameCore / SceneRouter / ModalFocusManager
      -> controllers/（场景交互、模态和表现刷新）
      -> modules/（唯一的玩法系统实例）
      -> SaveSystem / UISystem
```

`territory.html` 仅保留旧链接兼容性，并重定向至 `index.html?scene=territory`；它不再有独立系统或资源数据。

## 运行时边界

| 组件 | 责任 |
| --- | --- |
| `Game` | 装配系统和控制器、连接跨系统回调、协调场景切换与全局刷新 |
| `controllers/` | 接收 DOM/Canvas 操作，调用系统能力并刷新所属场景或模态 |
| `GameCore` | Canvas 帧循环、战斗画面、自动保存计时 |
| `FateCoinSystem` | 命运资源、自动翻转、成长成本 |
| `CombatSystem` | 远征战斗门面：遭遇实体、远征生命、宠物技能、撤离倒计时、Canvas 渲染与最终奖励发放 |
| `ExpeditionRunSystem` | 单局远征规则：路线、节点、搜索、威胁、补给、背包、阶段流转与结算计算 |
| `SceneRouter` | 命运/战斗/领地显示状态、HUD 状态、`?scene=` URL |
| `ModalFocusManager` | 模态初始焦点、Tab 限制、关闭后的焦点恢复 |
| `TerritorySystem` | 地块、建筑、循环脉冲、长期资源产出 |
| `ProgressionSystem` | 首局目标、成长倾向、成就领取状态 |
| `progression-config.js` | 成本、脉冲权重、目标与倾向映射的唯一数值来源 |
| `SaveSystem` | 槽位存档、导入导出、系统数据汇总 |

`main.js` 不再承载具体场景或模态实现。控制器通过构造参数显式接收系统、基础设施和跨系统回调，不自行创建系统实例；命运、玩家、宠物、战斗、领地、资源、进度和存档系统在运行时仍各自只有一个实例。

## 控制器边界

| 控制器 | 责任 |
| --- | --- |
| `achievement-controller.js` | 成就/任务模态、奖励领取和模态内标签状态 |
| `battle-scene-controller.js` | 远征开始、路线选择、三种搜索、安全屋、补给、宠物技能、撤离/放弃、Canvas 锁敌、面板刷新和结算反馈 |
| `settings-controller.js` | 设置模态、显示设置、快捷存档/读档和存档状态 |
| `player-modal-controller.js` | 玩家属性模态、属性升级和升级按钮状态 |
| `pet-modal-controller.js` | 宠物编队、背包、图鉴以及解锁/上阵操作 |
| `territory-scene-controller.js` | 领地网格、建筑操作、扩建和循环进度反馈 |
| `shop-recommendation-controller.js` | 命运商店推荐、筛选、下一目标和成长提示 |
| `fate-scene-controller.js` | 命运桌翻面与购买、界面刷新、硬币反馈和助手动画 |

长驻控制器通过 `bind()` 或 `bindEvents()` 绑定一次监听；重绑或销毁前调用 `destroy()`，统一移除监听并清理命运场景的助手波次、硬币翻面等计时器。动态模态的监听随模态节点在 `close()` 时一并释放，避免重复绑定和后台动画残留。

## 数据流

```text
Game 初始化
  -> 获取唯一系统实例
  -> 显式注入控制器依赖
  -> 控制器 bind / bindEvents

用户操作（DOM / Canvas）
  -> 所属控制器
  -> 系统状态变更
  -> 系统回调交给 Game 做跨系统协调
  -> 相关控制器刷新场景、模态或提示
  -> SaveSystem 定时、手动或在领地结构变更后立即保存
  -> LocalStorage
```

场景路由只管理表现状态，不复制游戏数据。命运、远征、领地共享同一批系统实例和槽位存档。旧版独立领地键只在没有可用槽位时作为一次性迁移回退。`ProgressionSystem` 只保存领取状态；首局步骤和成长倾向始终从当前玩法状态派生。

### 远征战斗数据流

```text
路线 / 搜索 / 撤离 DOM 操作
  -> BattleSceneController
  -> CombatSystem（对外战斗门面）
  -> ExpeditionRunSystem（纯局内规则状态）
  -> CombatSystem 生成或清理 Canvas 遭遇实体
  -> getBattleState() 形成统一只读快照
  -> BattleSceneController 刷新路线、背包、威胁、技能与操作按钮

GameCore 帧循环
  -> CombatSystem.update(deltaTime)
  -> 怪物、投射物、宠物技能冷却与撤离倒计时
  -> 状态回调
  -> BattleSceneController.updateBattleDisplay(state)
```

`ExpeditionRunSystem` 不访问 DOM、Canvas 或永久资源；它只计算 `briefing`、`route`、`search`、`camp`、`combat`、`extraction-ready`、`extracting`、`extracted`、`defeat` 的状态流。`CombatSystem` 负责把规则结果转换为实时遭遇，并且只在整局结束时向资源和玩家系统发放一次奖励。

远征路线、生命、补给、威胁、背包、怪物和撤离倒计时都是瞬时状态。切换场景只暂停 `CombatSystem`，刷新或载入存档会丢弃当前远征；存档仅记录最深探索、成功撤离和失败次数。

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
├── js/controllers/
│   ├── achievement-controller.js
│   ├── battle-scene-controller.js
│   ├── settings-controller.js
│   ├── player-modal-controller.js
│   ├── pet-modal-controller.js
│   ├── territory-scene-controller.js
│   ├── shop-recommendation-controller.js
│   └── fate-scene-controller.js
├── js/modules/
│   ├── game-core.js
│   ├── fate-coin-system.js
│   ├── player-system.js
│   ├── pet-system.js
│   ├── combat-system.js
│   ├── expedition-run-system.js
│   ├── targeting-system.js
│   ├── territory-system.js
│   ├── resource-system.js
│   ├── save-system.js
│   ├── progression-system.js
│   ├── progression-config.js
│   ├── scene-router.js
│   └── modal-focus-manager.js
├── images/
├── doc/
└── tests/
    ├── extraction-rpg-smoke.mjs # 远征规则与战斗集成冒烟
    └── browser-smoke.html        # 主游戏浏览器集成诊断页
```

## 扩展原则

1. 玩法状态加入对应系统，并提供 `getSaveData()` / `loadSaveData()`。
2. 场景和模态交互加入对应控制器；`main.js` 只保留装配、跨系统回调和高层场景协调。
3. 动态模态打开后交给 `ModalFocusManager` 管理焦点。
4. 控制器依赖由 `Game` 显式注入，并为长驻监听和计时器提供可重复的绑定/销毁生命周期。
5. 所有入口都指向主游戏，避免为控制器或子系统创建第二份资源、存档或进度状态。
6. 影响成长节奏的常量只写入 `progression-config.js`，不得在 UI 推荐或领地模块中复制魔法数值。
7. 单局远征规则优先放入 `ExpeditionRunSystem`，DOM 操作留在 `BattleSceneController`，实体更新与 Canvas 表现留在 `CombatSystem`。
8. 随机路线、搜索和掉落必须支持注入随机函数，测试使用固定随机源，避免概率用例不稳定。
