# 📚 PetPlan 文档中心

宠物计划 (PetPlan) 是一款基于 HTML5 Canvas 的宠物养成放置游戏，战斗采用“宠物远征·单局 RPG 搜打撤”玩法。

---

## 快速导航

| 文档                                 | 说明           | 适合谁   |
| ------------------------------------ | -------------- | -------- |
| [QUICKSTART.md](./QUICKSTART.md)     | 5 分钟快速开始 | 新玩家   |
| [player-guide.md](./player-guide.md) | 完整玩法指南   | 所有玩家 |
| [design/product-experience.md](./design/product-experience.md) | 横屏体验与玩家路径 | 产品与开发 |
| [design/extraction-rpg-rework.md](./design/extraction-rpg-rework.md) | 宠物远征搜打撤设计 | 产品与开发 |
| [design/](./design/)                 | 系统设计文档   | 开发者   |
| [dev/](./dev/)                       | 开发环境和规范 | 贡献者   |
| [CHANGELOG.md](./CHANGELOG.md)       | 版本更新日志   | 所有人   |

---

## 文档结构

```
doc/
├── README.md          # 本文件
├── CHANGELOG.md       # 更新日志
├── QUICKSTART.md      # 快速开始
├── player-guide.md    # 玩家指南
├── design/            # 技术设计
│   ├── architecture.md             # 系统架构
│   ├── systems.md                  # 游戏系统
│   ├── product-experience.md       # 横屏体验与玩家路径
│   └── extraction-rpg-rework.md    # 单局 RPG 搜打撤设计
└── dev/               # 开发者文档
    ├── setup.md          # 环境搭建
    ├── coding-style.md   # 编码规范
    └── api-reference.md  # API 参考
```

---

## 核心系统

| 系统        | 功能                  | 文档                                 |
| ----------- | --------------------- | ------------------------------------ |
| 🎮 游戏核心 | Canvas 渲染、游戏循环 | [架构](./design/architecture.md)     |
| 👤 玩家系统 | 属性、升级、战力      | [系统](./design/systems.md#战斗系统) |
| ⚔️ 宠物远征 | 路线、搜索、战斗、撤离 | [远征设计](./design/extraction-rpg-rework.md) |
| 🐾 宠物系统 | 收集、养成、编队      | [系统](./design/systems.md#宠物与成就) |
| 🏰 领地系统 | 建筑、资源产出        | [系统](./design/systems.md#领地系统) |
| 💾 存档系统 | 保存、导入导出        | [系统](./design/systems.md#资源与存档) |

---

**最后更新**: 2026 年 7 月 11 日
