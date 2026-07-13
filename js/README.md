# JavaScript 模块结构

`main.js` 只负责系统装配、跨系统回调和高层场景协调。具体场景、模态与推荐交互由 `controllers/` 管理；业务状态保留在对应系统模块内，不由 DOM 或控制器复制。

## 主要模块

| 模块 | 责任 |
| --- | --- |
| `game-core.js` | Canvas 游戏循环、远征世界画面、自动保存计时 |
| `fate-coin-system.js` | 命运资源、自动结算、升级成本 |
| `player-system.js` | 主角属性、升级与战力 |
| `pet-system.js` | 宠物模板、解锁、编队、成长 |
| `expedition-world-system.js` | 单局大地图、地点布置、障碍碰撞、迷雾发现、追踪与交互距离 |
| `camera-system.js` | 大地图跟随相机，以及屏幕坐标与世界坐标转换 |
| `expedition-run-system.js` | 地点事件、搜索、威胁、补给、背包与撤离结算规则 |
| `combat-system.js` | 玩家移动、世界状态、自动近距战斗、主动技能与奖励结算协调 |
| `territory-system.js` | 永久领地等级、固定建筑、生产、活动与远征加成 |
| `territory-world-system.js` | 基地世界移动、宠物跟随、邻近设施和活动过程 |
| `territory-art-config.js` | 领地天空、地表、环境道具、边界和七类建筑的统一资源清单与渲染尺寸 |
| `resource-system.js` | 金币、红宝石、水晶 |
| `save-system.js` | 存档槽位和导入导出 |
| `ui-system.js` | Toast、确认框等基础 UI |
| `scene-router.js` | 主场景显示、HUD 状态、URL 同步 |
| `modal-focus-manager.js` | 模态焦点进入、Tab 限制、焦点恢复 |

## 控制器

| 控制器 | 责任 |
| --- | --- |
| `achievement-controller.js` | 成就/任务模态与奖励领取 |
| `battle-scene-controller.js` | 键盘与屏幕方向输入、地点追踪、就近交互、补给、技能、撤离与结算反馈 |
| `settings-controller.js` | 设置模态、显示设置与快捷存档/读档 |
| `player-modal-controller.js` | 玩家属性展示与升级交互 |
| `pet-modal-controller.js` | 宠物编队、背包、图鉴与解锁交互 |
| `territory-scene-controller.js` | 实际基地 Canvas、横向移动、设施交互、升阶与战备反馈 |
| `shop-recommendation-controller.js` | 商店推荐、筛选、下一目标与成长提示 |
| `fate-scene-controller.js` | 命运桌操作、购买、界面刷新与助手动画 |

## 装配与生命周期

```text
main.js 获取唯一系统实例
  -> 通过构造参数显式注入控制器
  -> bind() / bindEvents()
  -> 用户操作进入控制器
  -> 系统变更状态
  -> Game 协调跨系统回调
  -> 控制器刷新所属界面
```

控制器不自行创建玩法系统，因此各系统实例和槽位存档仍全局唯一。长驻监听只绑定一次，并在重绑或销毁前通过 `destroy()` 移除；命运场景的助手波次、硬币翻面等计时器也在 `destroy()` 中清理。动态模态在 `close()` 时移除节点及其监听。

远征移动采用持续输入：控制器把 WASD、方向键或屏幕方向键归一为移动向量，`CombatSystem` 驱动角色并更新世界感知，`ExpeditionWorldSystem` 负责边界、障碍、地点发现和交互半径，`CameraSystem` 只负责视口跟随与坐标转换。点击地图地点只更新追踪目标，不提供自动寻路；真正进入地点必须靠近后按 `E` 或点击“交互”。撤离必须回到入口信标附近启动，撤离计时仅在角色位于信标范围内时递减。

领地同样是实际游戏场景：`TerritoryWorldSystem` 只保存当前页面会话里的位置、跟随宠物和短时活动，`TerritorySystem` 保存领地等级、建筑、生产与战备。控制器把两者组合到独立 Canvas 中，角色必须走近固定设施后才能操作；位置不写入存档，基地建设会立即写入槽位。

领地专属美术统一放在 `images/territory-v2/`，由 `territory-art-config.js` 提供唯一清单。天空、道路、路标、灯具、施工台、远征门、边界障碍和建筑不能再回退为代码矩形或引用旧 `images/territory/` 资源；`tests/territory-art-preview.html` 用于构造隔离存档的 R5 全地图进行视觉验收。

## 扩展规则

1. 新玩法状态放入独立系统，并实现存档接口。
2. 新交互放入对应控制器，依赖在 `Game.init()` 中显式注入。
3. `main.js` 只保留装配、跨系统回调和高层场景协调。
4. 新主场景在 `SceneRouter` 注册；宠物、成就这类辅助页面保持为模态。
5. 新模态调用 `ModalFocusManager.activate()`，关闭时调用 `release()`。
6. 新增长驻监听或计时器时，同时实现幂等绑定和 `destroy()` 清理。
7. 浏览器直接访问的入口只能是 `index.html`；旧入口应重定向而不是复制系统状态。
