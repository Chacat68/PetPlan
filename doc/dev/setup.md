# 开发环境

## 要求

- 现代桌面浏览器，或可横屏的移动浏览器。
- Python 3 用于本地静态服务。
- Node.js 用于自动化测试。
- 不需要打包器、第三方 npm 依赖或数据库。

## 启动

```bash
cd PetPlan
python3 -m http.server 4174 --directory .
```

在 `http://localhost:4174` 打开项目。ES Modules 不能通过 `file://` 运行；`index.html` 会在这种情况下给出本地服务提示。

## 修改与验证

每次修改 JavaScript 后至少运行统一的 Node 测试入口和差异检查：

```bash
npm test
git diff --check
```

`npm test` 不安装或调用第三方依赖；它会先检查 `main.js`、全部控制器、`combat-system.js`、`camera-system.js`、`expedition-run-system.js`、`expedition-world-system.js` 和本阶段基础模块的语法，再依次在独立的 Node 进程中运行控制器接口契约、核心逻辑、第一阶段回归、`extraction-rpg-smoke.mjs` 远征冒烟和 `world-exploration-smoke.mjs` 世界探索冒烟测试。

远征冒烟测试使用固定随机源，覆盖：

- 路线、搜索、战斗节点和撤离解锁的状态流。
- 快速拿取/彻底搜刮两种搜索策略、宠物被动加成、警戒变化、背包容量和高价值自动替换。
- 遭遇生成、宠物技能伤害与冷却、主角承伤。
- 撤离成功与失败保底结算，以及重复结算不重复发奖。

世界探索冒烟测试覆盖：

- 镜头坐标往返、四向边界和视口 resize。
- 世界边界、障碍碰撞与沿墙滑动、斜向输入等速。
- POI 追踪、发现、近距交互、同层分支失效和重复交互保护。
- 撤离只能在入口近距启动，离圈后倒计时暂停。
- 非零镜头偏移下的锁敌坐标，以及遭遇开始/结束不传送玩家。

Node 测试重点是规则、世界和门面逻辑。为了快速、稳定地验证状态机，它可以直接调用 `chooseRoute()` 或设置测试角色坐标，不会模拟真实用户连续走完整张 `3000×1900` 地图，也不验证 Canvas 像素结果。

浏览器集成测试需要先启动本地静态服务：

```bash
python3 -m http.server 4174 --directory .
```

然后打开 `http://localhost:4174/tests/browser-smoke.html`。浏览器测试会临时使用测试存档，并在测试结束后自动恢复原有存档；远征部分会验证：

- `3000×1900` 世界宽度大于 Canvas 视口，resize 边界已解耦。
- 按下和释放 `D` 后角色在世界坐标中向右移动。
- 点击路线卡只改变导航目标，不会直接进入节点。
- 把测试角色放到 POI 附近后，交互按钮可用并能进入搜索阶段。
- 搜索结算后的深度、威胁和背包 HUD 同步。

为控制浏览器冒烟时长，测试会在验证短距离键盘移动后把角色放到首个 POI 附近。以下内容仍属于手工验收边界：真实输入下连续走完整张地图、复杂障碍绕行体验、八方向 D-pad 多指组合、镜头平滑的视觉观感、小地图与迷雾像素效果，以及完整返程撤离的节奏。镜头边界、基础碰撞、撤离近距和离圈暂停已有 Node 逻辑测试兜底。

视觉改动在以下状态检查：

1. 桌面横屏的命运、远征战斗、领地场景。
2. 移动竖屏的旋转提示。
3. 旧 `territory.html` 是否跳转至 `index.html?scene=territory`。
4. 宠物、成就、玩家和设置弹窗是否能通过 Escape 关闭且焦点返回触发控件。
5. 远征整备后是否生成 `3000×1900` 世界；WASD、方向键和屏幕 D-pad 是否能八方向行进，斜向速度是否与单轴一致。
6. 路线卡是否只追踪地点；未靠近 POI 时不能进入，靠近后 `E` 与交互按钮是否可用。
7. 遗迹、岩石和水域是否阻挡玩家；镜头是否平滑跟随且不越界；小地图、探索比例、迷雾和屏外方向指示是否随行进更新。
8. 远征的搜索、安全屋、遭遇和撤离守点界面是否按状态只显示可用操作；搜索与安全屋阶段不能继续移动。
9. 遭遇是否围绕当前 POI 生成；玩家能否走位并用鼠标瞄准射击，固定弹道是否会打空、障碍是否会挡住弹丸，Canvas 瞄准坐标是否与镜头坐标一致，Q 是否只释放队长技能。
10. 探索 3 个区域后是否必须返回西侧入口才能撤离；离圈是否暂停倒计时、回圈是否继续，成功与失败是否只结算一次。
11. 宠物技能冷却、生命/威胁/背包、敌人数和撤离倒计时是否与面板一致。

## 调试

- 运行时游戏实例保留在 `window.game`。
- `window.game.combatSystem.getBattleState()` 可查看当前远征阶段、路线、背包、威胁、`world`、`interaction`、`extraction` 和可用操作。
- `window.game.combatSystem.runSystem.getState()` 可查看纯远征规则快照；调试时不要直接修改返回对象或内部状态。
- `window.game.combatSystem.worldSystem.getState(window.game.combatSystem.getHeroCenter())` 可查看世界尺寸、探索比例、障碍、地点状态、附近地点和追踪目标。
- `window.game.combatSystem.cameraSystem.getState()` 可查看镜头位置、Canvas 视口和世界边界；`screenToWorld(x, y)` 可辅助检查锁敌坐标。
- `window.game.combatSystem.setMovementInput(1, 0)` 可临时模拟向右输入，完成后必须调用 `clearMovementInput()`，避免角色持续行进。
- LocalStorage 的 `petplan_save_1` 是默认存档槽位；旧版 `petplan_save_slot1` 仅用于首次迁移回退。
- 清空站点数据前先从设置页导出存档。

## 部署

部署为普通静态站点即可。服务器必须允许 ES Module 文件以正确 MIME 类型返回，并保留 `index.html`、`territory.html`、`js/`、`css/` 和 `images/` 路径。
