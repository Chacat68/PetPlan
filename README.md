# PetPlan 宠物计划

PetPlan 是一款以横屏街机舞台呈现的宠物养成放置游戏。玩家在命运桌积累正反面资源、购买自动化与训练成长，再进入可操控的大地图“宠物远征”，在持续巡逻的敌群中搜索、交战并自主决定何时撤离。带回的物资可用于工坊制作、设施扩容、装备与保险、合约推进或出售，并由领地承接长期成长。

## 核心循环

1. 在命运桌点击硬币并积累正面、反面与桌面硬币。
2. 按商店推荐购买自动结算、小助手、主角或宠物训练。
3. 进入宠物远征，亲自移动探索迷雾地图，追踪地点、搜索物资、击败敌人，并在合适时机返回入口撤离。
4. 回到可自由行走的基地，修复设施、准备下一次远征并推动领地永久升阶。

宠物编队和成就位于 HUD 导航中，以模态页面打开。

## 运行项目

PetPlan 使用 ES Modules，必须通过 HTTP 服务打开：

```bash
cd PetPlan
python3 -m http.server 4174 --directory .
```

访问 [http://localhost:4174](http://localhost:4174)。直接双击 `index.html` 时，页面会显示本地服务提示。

游戏采用 16:9 舞台；移动设备竖屏进入时会显示旋转引导，切换横屏后会保留当前场景与远征进度。

## 操作

| 输入 | 行为 |
| --- | --- |
| 点击命运硬币 | 结算正面或反面 |
| HUD 场景按钮 | 切换命运与领地；远征从领地西侧入口进入 |
| WASD / 方向键 | 在远征大地图中移动 |
| 鼠标 / 触摸战场 | 任何局内阶段瞄准并射击；空弹且无备弹时改为近战 |
| E / 屏幕“交互”按钮 | 靠近地点后进入、搜索或启动撤离 |
| Q / 队伍技能按钮 | 释放队长宠物的主动技能 |
| R / 屏幕“换弹”按钮 | 手动更换弹匣 |
| 4 / 屏幕“补给”按钮 | 条件允许时使用一份补给恢复生命 |
| M / 顶部目标条 | 在可探索地点、事件和撤离点之间轮换追踪 |
| B / 顶部“背包” | 打开或关闭远征背包；整理时世界不会暂停 |
| A / D、左右方向键 / 屏幕左右键 | 在领地基地中横向移动 |
| E / 领地“交互”按钮 | 靠近基地设施后建造、升级、活动或收取 |
| 宠物 / 成就 | 打开辅助管理页面 |
| F5 / F9 | 保存 / 加载槽位 1 |
| Escape | 远征中打开退出确认；其他场景关闭当前弹窗 |

每局地图一次生成 8 个热点，已探索热点仍可回访，不会因为选择其他路线而消失。环境敌人会巡逻，并按视线和枪声调查玩家；脱离感知范围后会搜索最后位置再返回巡逻。快速搜索会给出 2–3 件候选，彻底搜刮给出 3–4 件候选且风险更高；背包满时由玩家手动留下、替换或放弃，并可锁定重要物资、放入容量有限的安全袋。

入口撤离从开局即开放，回到西侧信标后约 4 秒即可撤离；离圈只暂停倒计时，世界与敌人仍继续运行。主动退出不是撤离，不结算战斗金币或经验，只能带回安全袋中的物品。基础掉落池包含 16 种战利品，材料进一步分为机械、医疗、情报、宠物素材与稀有核心五类用途，用于工坊配方、仓库/背包/安全袋升级、装备保险与两段主线等局外目标。

## 项目结构

```text
PetPlan/
├── index.html                    # 唯一主游戏入口
├── territory.html                # 兼容旧链接，跳转到主入口的领地场景
├── css/style.css                 # 横屏舞台、场景和弹窗样式
├── js/main.js                    # 系统装配与玩法协调
├── js/modules/
│   ├── game-core.js              # Canvas 循环、远征画面渲染与相机接入
│   ├── fate-coin-system.js       # 命运资源与自动结算
│   ├── player-system.js          # 主角属性与升级
│   ├── pet-system.js             # 宠物收集、养成、编队
│   ├── combat-system.js          # 大地图移动、近距战斗、技能与结算协调
│   ├── expedition-world-system.js # 地图地点、碰撞、探索迷雾与交互距离
│   ├── camera-system.js          # 世界坐标、屏幕坐标与跟随相机
│   ├── expedition-run-system.js  # 地点事件、搜索、威胁、背包与撤离规则
│   ├── expedition-meta-system.js # 局外仓库、工坊、配装、保险、容量与合约
│   ├── territory-system.js       # 永久领地等级、建筑、生产与战备
│   ├── territory-world-system.js # 基地移动、跟随、邻近设施与场景活动
│   ├── territory-art-config.js   # 领地完整环境与建筑美术资源清单
│   ├── resource-system.js        # 金币、红宝石、水晶
│   ├── save-system.js            # LocalStorage 存档
│   ├── scene-router.js           # 主场景与 URL 状态
│   └── modal-focus-manager.js    # 模态焦点管理
├── images/                       # 角色、宠物、怪物与精灵资源
├── doc/                          # 玩家、设计与开发文档
└── tests/                        # 浏览器诊断页
```

## 文档

- [快速开始](./doc/QUICKSTART.md)
- [玩家指南](./doc/player-guide.md)
- [产品体验设计](./doc/design/product-experience.md)
- [连续搜打撤重构（当前规则）](./doc/design/duckov-continuous-raid-rework-20260724.md)
- [远征玩法精简改版（历史）](./doc/design/expedition-gameplay-simplification-20260723.md)
- [远征情境交互改版（当前界面）](./doc/design/expedition-context-interaction-20260723.md)
- [宠物远征初版设计（历史）](./doc/design/extraction-rpg-rework.md)
- [实际基地领地设计](./doc/design/territory-world-rework.md)
- [系统架构](./doc/design/architecture.md)
- [系统规则](./doc/design/systems.md)
- [开发环境](./doc/dev/setup.md)

## 存档

存档保存在当前浏览器的 LocalStorage。槽位 1 会自动保存；清除站点数据会清空进度。设置页面提供槽位的保存、加载及导入导出入口。
