# PetPlan 宠物计划

PetPlan 是一款以横屏街机舞台呈现的宠物养成放置游戏。玩家在命运桌积累正反面资源、购买自动化与训练成长，在战斗中获取通用资源，并以领地建筑承接中期进度。

## 核心循环

1. 在命运桌点击硬币并积累正面、反面与桌面硬币。
2. 按商店推荐购买自动结算、小助手、主角或宠物训练。
3. 进入战斗，将主角与宠物成长转化为资源收益。
4. 在领地消耗资源、解锁地块与建筑，获得长期属性和产出。

宠物编队和成就位于 HUD 导航中，以模态页面打开。

## 运行项目

PetPlan 使用 ES Modules，必须通过 HTTP 服务打开：

```bash
cd PetPlan
python3 -m http.server 4174 --directory .
```

访问 [http://localhost:4174](http://localhost:4174)。直接双击 `index.html` 时，页面会显示本地服务提示。

游戏采用横屏 16:9 舞台。移动设备请旋转为横屏后进入。

## 操作

| 输入 | 行为 |
| --- | --- |
| 点击命运硬币 | 结算正面或反面 |
| HUD 场景按钮 | 切换命运、战斗、领地 |
| 宠物 / 成就 | 打开辅助管理页面 |
| F5 / F9 | 保存 / 加载槽位 1 |
| Escape | 关闭当前弹窗 |

## 项目结构

```text
PetPlan/
├── index.html                    # 唯一主游戏入口
├── territory.html                # 兼容旧链接，跳转到主入口的领地场景
├── css/style.css                 # 横屏舞台、场景和弹窗样式
├── js/main.js                    # 系统装配与玩法协调
├── js/modules/
│   ├── game-core.js              # Canvas 循环与战斗画面渲染
│   ├── fate-coin-system.js       # 命运资源与自动结算
│   ├── player-system.js          # 主角属性与升级
│   ├── pet-system.js             # 宠物收集、养成、编队
│   ├── combat-system.js          # 怪物、攻击、战斗奖励
│   ├── territory-system.js       # 地块、建筑、长期进度
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
- [系统架构](./doc/design/architecture.md)
- [系统规则](./doc/design/systems.md)
- [开发环境](./doc/dev/setup.md)

## 存档

存档保存在当前浏览器的 LocalStorage。槽位 1 会自动保存；清除站点数据会清空进度。设置页面提供槽位的保存、加载及导入导出入口。
