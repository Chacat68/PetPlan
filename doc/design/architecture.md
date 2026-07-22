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
| `GameCore` | Canvas 帧循环、视口尺寸同步、远征整帧渲染入口、自动保存计时 |
| `FateCoinSystem` | 命运资源、自动翻转、成长成本 |
| `CombatSystem` | 远征战斗门面：规则/世界/镜头协调、玩家移动输入、POI 交互、世界坐标遭遇、远征生命、宠物技能、圈内撤离倒计时、Canvas 分层渲染与最终奖励发放 |
| `ExpeditionRunSystem` | 单局远征规则：路线、节点、搜索、威胁、补给、背包、阶段流转与结算计算 |
| `ExpeditionWorldSystem` | 单局大地图模型：`3000×1900` 世界、路线 POI、入口信标、障碍碰撞、探索网格、目标追踪与近距发现；不访问 DOM/Canvas |
| `CameraSystem` | Canvas 视口、世界边界内平滑跟随，以及屏幕坐标与世界坐标互转 |
| `SceneRouter` | 命运/战斗/领地显示状态、HUD 状态、`?scene=` URL |
| `ModalFocusManager` | 模态初始焦点、Tab 限制、关闭后的焦点恢复 |
| `TerritorySystem` | 地块、建筑、循环脉冲、长期资源产出 |
| `ProgressionSystem` | 首局目标与成长倾向；保留旧领取 ID 仅用于存档迁移 |
| `AchievementSystem` | 长期里程碑目录、历史最高指标、完成锁存、领取与奖励 |
| `progression-config.js` | 成本、脉冲权重、目标与倾向映射的唯一数值来源 |
| `SaveSystem` | 槽位存档、导入导出、系统数据汇总 |

`main.js` 不再承载具体场景或模态实现。控制器通过构造参数显式接收系统、基础设施和跨系统回调，不自行创建系统实例；命运、玩家、宠物、战斗、领地、资源、进度和存档系统在运行时仍各自只有一个实例。

## 控制器边界

| 控制器 | 责任 |
| --- | --- |
| `achievement-controller.js` | 里程碑模态、分类筛选、HUD 徽标和领取交互 |
| `battle-scene-controller.js` | WASD/方向键/屏幕 D-pad、`E` 与按钮交互、路线追踪、三种搜索、安全屋、补给、宠物技能、撤离/放弃、Canvas 锁敌、面板刷新和结算反馈 |
| `settings-controller.js` | 设置模态、显示设置、快捷存档/读档和存档状态 |
| `player-modal-controller.js` | 玩家属性模态、属性升级和升级按钮状态 |
| `pet-modal-controller.js` | 宠物编队、背包、图鉴以及解锁/上阵操作 |
| `territory-scene-controller.js` | 实际基地 Canvas、角色移动、设施交互、升阶与战备反馈 |
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

场景路由只管理表现状态，不复制游戏数据。命运、远征、领地共享同一批系统实例和槽位存档。旧版独立领地键只在没有可用槽位时作为一次性迁移回退。首局步骤和成长倾向始终从当前玩法状态派生；`AchievementSystem` 单独保存里程碑完成时间、历史最高值和领取状态，并迁移旧版 `ProgressionSystem` 领取 ID。

### 大地图远征数据流

```text
键盘 / D-pad 输入
  -> BattleSceneController 归一化方向
  -> CombatSystem.setMovementInput(x, y)
  -> PlayerSystem.updateBattleMovement(deltaTime)
  -> CombatSystem.updateHeroMovement(player, deltaTime)
  -> ExpeditionWorldSystem.moveEntity() 处理世界边界与障碍
  -> CameraSystem 跟随玩家

路线卡 / E / 交互按钮
  -> BattleSceneController
  -> CombatSystem.trackLocation() / interactWithNearbyLocation()
  -> ExpeditionWorldSystem（追踪、距离与 POI 状态）
  -> 靠近 POI 后才调用 ExpeditionRunSystem.chooseNode()

搜索 / 安全屋 / 撤离 DOM 操作
  -> BattleSceneController
  -> CombatSystem（对外远征门面）
  -> ExpeditionRunSystem（纯局内规则状态）
  -> CombatSystem 在当前 POI 世界坐标生成或清理遭遇实体
  -> ExpeditionWorldSystem 完成地点并同步下一深度 POI
  -> getBattleState() 形成统一只读快照
  -> BattleSceneController 刷新追踪、近距交互、路线、背包、威胁、技能与操作按钮

GameCore 帧循环
  -> PlayerSystem.update(deltaTime) 处理玩家世界移动
  -> CombatSystem.update(deltaTime) 处理远征与遭遇
  -> PetSystem.update(deltaTime) 处理伙伴跟随与接敌
  -> 世界发现、镜头、怪物、投射物、宠物技能冷却与圈内撤离倒计时
  -> 状态回调
  -> BattleSceneController.updateBattleDisplay(state)

GameCore.render()
  -> CombatSystem.renderExplorationFrame(ctx)
  -> 屏幕背景
  -> CameraSystem 世界偏移
  -> 世界地形 / POI / 玩家 / 怪物 / 宠物 / 世界浮字
  -> 恢复屏幕坐标
  -> 迷雾 / 导航箭头 / 小地图 / 撤离条 / 阶段提示 / 横幅
```

`ExpeditionRunSystem` 不访问 DOM、Canvas 或永久资源；它只计算 `briefing`、`route`、`search`、`camp`、`combat`、`extraction-ready`、`extracting`、`extracted`、`defeat` 的状态流。`route` 仍是规则阶段名，但在表现层代表可自由行进的大地图探索。`ExpeditionWorldSystem` 不复制规则，只把当前 `routeChoices` 映射为世界 POI，并维护地点、碰撞和发现状态；`CameraSystem` 只处理视口。

`CombatSystem` 是三者的协调门面：路线卡只调用 `trackLocation()`，玩家进入 POI 近距范围后，`interactWithNearbyLocation()` 才调用规则层的 `chooseNode()`。战斗实体始终使用世界坐标，Canvas 点击经镜头转换后锁敌。撤离信标固定在入口，倒计时只有玩家位于信标圈内时才推进。最终奖励仍只在整局结束时发放一次。

远征世界坐标、探索网格、地点状态、路线、生命、补给、威胁、背包、怪物和撤离倒计时都是瞬时状态。切换场景只暂停 `CombatSystem` 并清空移动输入，刷新或载入存档会丢弃当前远征；存档仅记录最深探索、成功撤离和失败次数。

Canvas 视口和世界尺寸必须保持独立。`GameCore` 在 resize 或固定分辨率切换时调用 `CombatSystem.setViewportSize()`，该方法只更新视口与镜头，不缩放世界或夹取玩家到屏幕范围。

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
│   ├── expedition-world-system.js
│   ├── camera-system.js
│   ├── targeting-system.js
│   ├── territory-system.js
│   ├── resource-system.js
│   ├── save-system.js
│   ├── achievement-config.js
│   ├── achievement-system.js
│   ├── progression-system.js
│   ├── progression-config.js
│   ├── scene-router.js
│   └── modal-focus-manager.js
├── images/
├── doc/
└── tests/
    ├── extraction-rpg-smoke.mjs # 远征规则与战斗集成冒烟
    ├── world-exploration-smoke.mjs # 世界、镜头、移动、POI 与撤离边界
    └── browser-smoke.html        # 主游戏浏览器集成诊断页
```

## 扩展原则

1. 玩法状态加入对应系统，并提供 `getSaveData()` / `loadSaveData()`。
2. 场景和模态交互加入对应控制器；`main.js` 只保留装配、跨系统回调和高层场景协调。
3. 动态模态打开后交给 `ModalFocusManager` 管理焦点。
4. 控制器依赖由 `Game` 显式注入，并为长驻监听和计时器提供可重复的绑定/销毁生命周期。
5. 所有入口都指向主游戏，避免为控制器或子系统创建第二份资源、存档或进度状态。
6. 影响成长节奏的常量只写入 `progression-config.js`，不得在 UI 推荐或领地模块中复制魔法数值。
7. 单局远征规则优先放入 `ExpeditionRunSystem`；世界坐标、POI、障碍和发现状态放入 `ExpeditionWorldSystem`；视口转换放入 `CameraSystem`；DOM/输入操作留在 `BattleSceneController`；实体协调与 Canvas 表现留在 `CombatSystem`。
8. 世界坐标不得从 Canvas 尺寸派生。resize 只调用 `setViewportSize()`；点击或触摸命中世界实体前必须先执行 `screenToWorld()`。
9. `route` 作为规则兼容阶段继续保留。UI 追踪地点不得直接调用 `chooseNode()`，实际进入节点必须通过近距交互门槛。
10. 随机路线、搜索和掉落必须支持注入随机函数，测试使用固定随机源，避免概率用例不稳定。
11. 自动化测试应区分规则门面、世界逻辑和真实交互：Node 测试可直接调用兼容接口验证状态机，并独立覆盖镜头坐标、边界、障碍滑动、斜向等速、POI 近距、撤离圈和非零镜头锁敌；浏览器测试至少覆盖视口/世界解耦、键盘移动、追踪不触发节点和近距交互。Canvas 像素、小地图/迷雾视觉、整图连续返程和真实 D-pad 手势仍需手工验收。
