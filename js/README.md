# JavaScript 模块结构

`main.js` 只负责系统装配、跨系统回调和高层场景协调。具体场景、模态与推荐交互由 `controllers/` 管理；业务状态保留在对应系统模块内，不由 DOM 或控制器复制。

## 主要模块

| 模块 | 责任 |
| --- | --- |
| `game-core.js` | Canvas 游戏循环、远征世界画面、自动保存计时 |
| `fate-coin-system.js` | 命运资源、自动结算、升级成本 |
| `player-system.js` | 主角属性、升级与战力 |
| `pet-system.js` | 宠物模板、解锁、编队、成长 |
| `expedition-world-system.js` | 单局大地图、8 个并存热点、障碍碰撞、迷雾发现、方向/距离区间导航与交互距离 |
| `camera-system.js` | 大地图跟随相机，以及屏幕坐标与世界坐标转换 |
| `expedition-run-system.js` | 可回访热点、搜索候选、威胁、补给、手动背包取舍、安全袋与撤离结算规则 |
| `expedition-meta-system.js` | 局外仓库、五类材料用途、配装、工坊、容量升级、装备保险和合约链 |
| `combat-system.js` | 玩家移动/射击/换弹、持续巡逻与视听感知、世界弹药拾取、宠物技能与奖励结算协调 |
| `territory-system.js` | 永久领地等级、固定建筑、生产、活动与远征加成 |
| `territory-world-system.js` | 基地世界移动、宠物跟随、邻近设施和活动过程 |
| `territory-art-config.js` | 梦幻庭院远景资源、街区标识和七类设施的统一渲染尺寸 |
| `resource-system.js` | 金币、红宝石、水晶 |
| `achievement-config.js` | 长期里程碑分类、指标、阈值与奖励目录 |
| `achievement-system.js` | 里程碑历史最高值、完成锁存、领取与存档 |
| `save-system.js` | 存档槽位和导入导出 |
| `ui-system.js` | Toast、确认框等基础 UI |
| `scene-router.js` | 主场景显示、HUD 状态、URL 同步 |
| `modal-focus-manager.js` | 模态焦点进入、Tab 限制、焦点恢复 |

## 控制器

| 控制器 | 责任 |
| --- | --- |
| `achievement-controller.js` | 里程碑分类模态、HUD 徽标与奖励领取 |
| `battle-scene-controller.js` | 键盘移动、地点追踪、就近交互、射击、`R` 换弹、`4` 补给、背包取舍、整备制作/扩容/保险与结算反馈 |
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

远征移动采用持续键盘输入：控制器把 WASD 或方向键归一为移动向量，`CombatSystem` 驱动角色并更新世界感知，`ExpeditionWorldSystem` 负责边界、障碍、8 个热点、发现和交互半径，`CameraSystem` 只负责视口跟随与坐标转换。点击地图地点只更新大致方向与距离区间，不提供自动寻路；真正进入地点必须靠近后按 `E` 或点击“交互”。热点完成后仍保留在地图上并允许回访，但规则层不会重复结算。

`CombatSystem.update()` 在整局存续期间推进环境敌人，不以 `combat` 阶段作为总开关。敌人状态在巡逻、调查、交战、搜索返程之间转换，视线和枪声分别更新感知；失去玩家后只追查最后已知位置。玩家在任意局内阶段都可射击，`R` 调用 `reloadWeapon()`，弹药完全耗尽后触发短距离弱近战；世界弹药拾取靠近后自动入账。入口撤离从开局可用，基础倒计时约 4 秒且仅在角色位于信标圈内时递减。

`ExpeditionRunSystem` 只管理单局：搜索生成 2–3 或 3–4 件候选，满包后进入待选队列，不执行自动价值替换；锁定物、任务物和安全袋物品不得被普通替换。主动退出的战斗金币与经验归零，只保留安全袋。`ExpeditionMetaSystem` 管理跨局仓库、五类材料、四张配方、仓库/背包/安全袋升级、按售价 20% 的装备保险和两段一次性主线；容量与保险在出发时由 `CombatSystem` 快照进本局。

领地同样是实际游戏场景：`TerritoryWorldSystem` 只保存当前页面会话里的位置、跟随宠物和短时活动，`TerritorySystem` 保存领地等级、建筑、生产与战备。控制器把两者组合到独立 Canvas 中，角色必须走近固定设施后才能操作；位置不写入存档，基地建设会立即写入槽位。

庭院的绘制入口统一由 `territory-art-config.js` 和 `TerritorySceneController` 管理：`images/territory-v4/` 保存与命运桌同色系的黄昏城市远景（AVIF 优先、WebP 回退），`images/territory-v5/` 保存以该远景为风格参考生成的大型次元探索门和七类透明 WebP 现代都市建筑。控制器初始化时不请求领地图片，只有进入领地才加载天空、探索门和主基地，随后按设施所需的庭院等级增量加载建筑；R2/R3 资源不会在 R0/R1 提前下载。场景道路不再绘制星标、信标、分区牌和网格分割，地面使用越过世界边界的连续渐变，避免镜头移动时出现断层。旧中世纪资源和生产 PNG 已清理。`tests/territory-art-preview.html` 用于构造隔离存档的 R5 全地图进行视觉验收。

## 扩展规则

1. 新玩法状态放入独立系统，并实现存档接口。
2. 新交互放入对应控制器，依赖在 `Game.init()` 中显式注入。
3. `main.js` 只保留装配、跨系统回调和高层场景协调。
4. 新主场景在 `SceneRouter` 注册；宠物、成就这类辅助页面保持为模态。
5. 新模态调用 `ModalFocusManager.activate()`，关闭时调用 `release()`。
6. 新增长驻监听或计时器时，同时实现幂等绑定和 `destroy()` 清理。
7. 浏览器直接访问的入口只能是 `index.html`；旧入口应重定向而不是复制系统状态。
