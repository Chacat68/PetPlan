# JavaScript 模块结构

`main.js` 只负责系统装配、跨系统回调和高层场景协调。具体场景、模态与推荐交互由 `controllers/` 管理；业务状态保留在对应系统模块内，不由 DOM 或控制器复制。

## 主要模块

| 模块 | 责任 |
| --- | --- |
| `game-core.js` | Canvas 游戏循环、战斗画面、自动保存计时 |
| `fate-coin-system.js` | 命运资源、自动结算、升级成本 |
| `player-system.js` | 主角属性、升级与战力 |
| `pet-system.js` | 宠物模板、解锁、编队、成长 |
| `combat-system.js` | 怪物、子弹、伤害与奖励 |
| `territory-system.js` | 地块、建筑、循环进度、产出 |
| `resource-system.js` | 金币、红宝石、水晶 |
| `save-system.js` | 存档槽位和导入导出 |
| `ui-system.js` | Toast、确认框等基础 UI |
| `scene-router.js` | 主场景显示、HUD 状态、URL 同步 |
| `modal-focus-manager.js` | 模态焦点进入、Tab 限制、焦点恢复 |

## 控制器

| 控制器 | 责任 |
| --- | --- |
| `achievement-controller.js` | 成就/任务模态与奖励领取 |
| `battle-scene-controller.js` | 战斗操作、选塔、面板刷新与结算反馈 |
| `settings-controller.js` | 设置模态、显示设置与快捷存档/读档 |
| `player-modal-controller.js` | 玩家属性展示与升级交互 |
| `pet-modal-controller.js` | 宠物编队、背包、图鉴与解锁交互 |
| `territory-scene-controller.js` | 领地网格、建筑、扩建与进度反馈 |
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

## 扩展规则

1. 新玩法状态放入独立系统，并实现存档接口。
2. 新交互放入对应控制器，依赖在 `Game.init()` 中显式注入。
3. `main.js` 只保留装配、跨系统回调和高层场景协调。
4. 新主场景在 `SceneRouter` 注册；宠物、成就这类辅助页面保持为模态。
5. 新模态调用 `ModalFocusManager.activate()`，关闭时调用 `release()`。
6. 新增长驻监听或计时器时，同时实现幂等绑定和 `destroy()` 清理。
7. 浏览器直接访问的入口只能是 `index.html`；旧入口应重定向而不是复制系统状态。
