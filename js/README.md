# JavaScript 模块结构

`main.js` 负责装配系统、连接玩法回调和渲染管理界面。业务状态应保留在对应系统模块内，不应由 DOM 保存。

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

## 扩展规则

1. 新玩法状态放入独立系统，并实现存档接口。
2. 跨系统依赖在 `Game.init()` 中注入。
3. 新主场景在 `SceneRouter` 注册；宠物、成就这类辅助页面保持为模态。
4. 新模态调用 `ModalFocusManager.activate()`，关闭时调用 `release()`。
5. 浏览器直接访问的入口只能是 `index.html`；旧入口应重定向而不是复制系统状态。
