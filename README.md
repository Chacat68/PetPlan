# PetPlan 宠物计划

<p align="center">
  <img src="./images/rw/rw3.png" alt="PetPlan Logo" width="100">
</p>

<p align="center">
  一款基于 HTML5 Canvas 的宠物养成类放置游戏
</p>

## 🎮 游戏简介

PetPlan（宠物计划）是一款结合了放置玩法、宠物收集和领地建设的休闲游戏。玩家可以收集各种独特的宠物，培养它们成长，建设自己的领地，并在战斗中获取资源。

## ✨ 主要特性

- 🐾 **宠物收集系统** - 8种独特宠物，5个稀有度等级
- ⚔️ **自动战斗系统** - 基于Canvas的实时2D战斗
- 🏰 **领地建设系统** - 建造升级多种功能建筑
- 📊 **角色成长系统** - 三维属性+多种战斗属性升级
- 💾 **多槽位存档** - 5个存档槽位，支持导入导出
- 📱 **响应式设计** - 适配移动端和桌面端

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | 原生 JavaScript (ES6+ Modules) |
| 渲染引擎 | HTML5 Canvas |
| 样式 | CSS3 (动画、响应式设计) |
| 数据持久化 | LocalStorage |

## 🚀 快速开始

### 本地运行

```bash
# 克隆项目
git clone https://github.com/Chacat68/PetPlan.git

# 进入项目目录
cd PetPlan

# 使用任意HTTP服务器运行，例如：
# Python 3
python -m http.server 8080

# 或使用 VS Code Live Server 插件
```

然后在浏览器中访问 `http://localhost:8080`

### 快捷键

| 按键 | 功能 |
|------|------|
| F5 | 快速保存 |
| F9 | 快速加载 |
| ESC | 关闭弹窗 |

## 📁 项目结构

```
PetPlan/
├── index.html          # 主游戏页面
├── territory.html      # 领地系统页面
├── css/                # 样式文件
│   ├── style.css       # 主样式
│   ├── menu.css        # 菜单样式
│   ├── character-management.css
│   ├── pet-system.css
│   └── save-system.css
├── js/                 # 脚本文件
│   ├── main.js         # 主入口
│   └── modules/        # 功能模块
│       ├── game-core.js
│       ├── player-system.js
│       ├── combat-system.js
│       ├── pet-system.js
│       ├── territory-system.js
│       ├── resource-system.js
│       ├── save-system.js
│       └── ui-system.js
├── images/             # 图片资源
│   ├── cw/             # 宠物图片
│   └── rw/             # 角色图片
└── doc/                # 项目文档
```

## 📖 文档

详细文档请参阅 [doc/README.md](./doc/README.md)

- [系统架构总览](./doc/architecture/系统架构总览.md)
- [宠物系统使用指南](./doc/宠物系统使用指南.md)
- [存档系统使用指南](./doc/存档系统使用指南.md)
- [开发环境搭建](./doc/development/环境搭建指南.md)

## 🎯 游戏系统

### 核心模块

| 模块 | 说明 |
|------|------|
| GameCore | 游戏循环、场景渲染、系统协调 |
| PlayerSystem | 玩家属性、升级、战力计算 |
| CombatSystem | 怪物生成、子弹系统、碰撞检测 |
| PetSystem | 宠物收集、养成、编队、战斗 |
| TerritorySystem | 领地建筑、资源产出、属性加成 |
| ResourceSystem | 货币管理、数字格式化 |
| SaveSystem | 存档保存、加载、导入导出 |

### 货币系统

| 货币 | 图标 | 用途 |
|------|------|------|
| 金币 | 💰 | 升级、建造、养成 |
| 红宝石 | 🔴 | 高级解锁、加速 |
| 水晶 | 💎 | 建筑升级、领地扩张 |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

- GitHub: [@Chacat68](https://github.com/Chacat68)
- 项目地址: [https://github.com/Chacat68/PetPlan](https://github.com/Chacat68/PetPlan)
