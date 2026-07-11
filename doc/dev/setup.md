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

`npm test` 不安装或调用第三方依赖；它会先检查 `main.js`、全部控制器、`combat-system.js`、`expedition-run-system.js` 和本阶段基础模块的语法，再依次在独立的 Node 进程中运行控制器接口契约、核心逻辑、第一阶段回归和 `extraction-rpg-smoke.mjs` 远征冒烟测试。

远征冒烟测试使用固定随机源，覆盖：

- 路线、搜索、战斗节点和撤离解锁的状态流。
- 宠物侦察门槛、威胁变化、背包容量和高价值自动替换。
- 遭遇生成、宠物技能伤害与冷却、主角承伤。
- 撤离成功与失败保底结算，以及重复结算不重复发奖。

浏览器集成测试需要先启动本地静态服务：

```bash
python3 -m http.server 4174 --directory .
```

然后打开 `http://localhost:4174/tests/browser-smoke.html`。浏览器测试会临时使用测试存档，并在测试结束后自动恢复原有存档；远征部分会验证远征导航、开始远征、路线选择以及阶段和深度的 DOM 同步。

视觉改动在以下状态检查：

1. 桌面横屏的命运、远征战斗、领地场景。
2. 移动竖屏的旋转提示。
3. 旧 `territory.html` 是否跳转至 `index.html?scene=territory`。
4. 宠物、成就、玩家和设置弹窗是否能通过 Escape 关闭且焦点返回触发控件。
5. 远征的整备、路线、搜索、安全屋、遭遇和撤离守点界面是否按状态只显示可用操作。
6. Canvas 点击锁敌、宠物技能冷却、生命/威胁/背包刷新与撤离倒计时是否一致。

## 调试

- 运行时游戏实例保留在 `window.game`。
- `window.game.combatSystem.getBattleState()` 可查看当前远征阶段、路线、背包、威胁和可用操作。
- `window.game.combatSystem.runSystem.getState()` 可查看纯远征规则快照；调试时不要直接修改返回对象或内部状态。
- LocalStorage 的 `petplan_save_1` 是默认存档槽位；旧版 `petplan_save_slot1` 仅用于首次迁移回退。
- 清空站点数据前先从设置页导出存档。

## 部署

部署为普通静态站点即可。服务器必须允许 ES Module 文件以正确 MIME 类型返回，并保留 `index.html`、`territory.html`、`js/`、`css/` 和 `images/` 路径。
