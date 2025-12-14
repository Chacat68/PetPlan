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

- 🐾 **宠物收集系统** - 8种独特宠物，5个稀有度等级，支持编队和宠物养成
- ⚔️ **自动战斗系统** - 基于Canvas的实时2D战斗，支持多种怪物类型
- 🏰 **领地建设系统** - 建造升级多种功能建筑，自动资源产出
- 📊 **角色成长系统** - 三维属性+8种战斗属性升级，强大的属性加成系统
- 🎖️ **成就系统** - 每日任务、长期成就、任务奖励
- 💾 **多槽位存档** - 5个存档槽位，支持导入导出，自动存档
- 🛠️ **装备系统** - 装备获取、装备合成、属性加成
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
├── index.html                    # 主游戏页面
├── territory.html                # 领地系统页面
├── README.md                     # 项目说明文档
├── CHANGELOG.md                  # 更新日志
├── CODE_REVIEW_REPORT.md         # 代码审查报告
├── css/                          # 样式文件
│   ├── style.css                 # 主样式
│   ├── menu.css                  # 菜单样式
│   ├── character-management.css  # 角色管理样式
│   ├── pet-system.css            # 宠物系统样式
│   ├── achievement.css           # 成就系统样式
│   └── save-system.css           # 存档系统样式
├── js/                           # 脚本文件
│   ├── main.js                   # 主入口文件
│   ├── README.md                 # JS模块说明
│   └── modules/                  # 功能模块
│       ├── game-core.js          # 游戏核心（循环、渲染）
│       ├── player-system.js      # 玩家系统（升级、属性）
│       ├── combat-system.js      # 战斗系统（怪物、战斗）
│       ├── pet-system.js         # 宠物系统（收集、养成）
│       ├── pet-ui.js             # 宠物UI
│       ├── territory-system.js   # 领地系统（建筑、产出）
│       ├── resource-system.js    # 资源系统（货币管理）
│       ├── equipment-system.js   # 装备系统（装备管理）
│       ├── equipment-ui.js       # 装备UI
│       ├── save-system.js        # 存档系统（保存、加载）
│       ├── save-ui.js            # 存档UI
│       ├── ui-system.js          # UI系统（提示、确认）
│       ├── achievement-system.js # 成就系统（任务、成就）
│       ├── achievement-ui.js     # 成就UI
│       ├── offline-system.js     # 离线系统（离线收益）
│       └── index.js              # 模块索引
├── images/                       # 图片资源
│   ├── cw/                       # 宠物图片
│   └── rw/                       # 角色图片
└── doc/                          # 完整项目文档
    ├── architecture/             # 架构设计文档
    ├── features/                 # 功能模块文档
    ├── api/                      # API接口文档
    ├── development/              # 开发指南
    └── assets/                   # 资源文档
```

## 📖 文档

详细文档请参阅 [doc/](./doc/) 文件夹

### 系统设计文档
- [系统架构总览](./doc/architecture/系统架构总览.md) - 项目整体架构
- [模块结构设计](./doc/architecture/模块结构设计.md) - 模块划分和职责
- [数据流设计](./doc/architecture/数据流设计.md) - 数据流向和状态管理

### 功能文档
- [游戏核心系统](./doc/features/游戏核心系统.md) - 游戏循环和渲染
- [宠物系统使用指南](./doc/宠物系统使用指南.md) - 宠物收集和养成
- [存档系统使用指南](./doc/存档系统使用指南.md) - 存档管理
- [领地功能整理](./doc/领地功能整理.md) - 领地建设系统

### API文档
- [游戏核心API](./doc/api/游戏核心API.md) - GameCore接口
- [玩家系统API](./doc/api/玩家系统API.md) - PlayerSystem接口
- [存档系统API](./doc/api/存档系统API.md) - SaveSystem接口
- [宠物系统API](./doc/api/宠物系统API.md) - PetSystem接口

### 开发指南
- [开发环境搭建](./doc/development/环境搭建指南.md) - 环境配置
- [编码规范](./doc/development/编码规范.md) - 代码规范

### 代码质量
- [代码审查报告](./CODE_REVIEW_REPORT.md) - 最新代码审查结果

## 🎯 游戏系统

### 核心模块

| 模块 | 说明 | 主要功能 |
|------|------|----------|
| **GameCore** | 游戏循环、场景渲染 | 维护游戏主循环，协调各系统更新和渲染 |
| **PlayerSystem** | 玩家属性管理 | 角色升级、属性提升、战力计算、快捷键升级 |
| **CombatSystem** | 战斗逻辑 | 怪物生成、子弹系统、碰撞检测、伤害计算、爆炸效果 |
| **PetSystem** | 宠物管理 | 宠物收集、升级、编队、宠物战斗、稀有度系统 |
| **PetUI** | 宠物界面 | 宠物列表展示、编队管理、详情查看 |
| **TerritorySystem** | 领地建设 | 建筑建造、升级、资源产出、属性加成、领地扩张 |
| **ResourceSystem** | 资源管理 | 金币、红宝石、水晶管理、资源消费 |
| **EquipmentSystem** | 装备系统 | 装备获取、装备穿戴、属性加成 |
| **SaveSystem** | 存档管理 | 存档保存、加载、导入导出、自动保存 |
| **UISystem** | UI框架 | Toast提示、确认弹窗、界面管理 |
| **AchievementSystem** | 成就系统 | 每日任务、长期成就、任务奖励、进度追踪 |
| **OfflineSystem** | 离线系统 | 离线收益计算、离线领地产出 |

### 货币系统

| 货币 | 图标 | 获取方式 | 用途 |
|------|------|---------|------|
| **金币** | 💰 | 怪物掉落、领地产出 | 角色升级、宠物养成、装备升级 |
| **红宝石** | 🔴 | 成就奖励、稀有掉落 | 高级功能解锁、加速建造 |
| **水晶** | 💎 | 领地产出、任务奖励 | 建筑升级、领地扩张、重要升级 |

### 稀有度系统

| 稀有度 | 颜色 | 属性倍数 | 难度 |
|--------|------|---------|------|
| **普通** | 灰色 | 1.0x | 常见掉落 |
| **优秀** | 绿色 | 1.2x | 较少掉落 |
| **稀有** | 蓝色 | 1.5x | 稀有掉落 |
| **卓越** | 紫色 | 2.0x | 很少掉落 |
| **传说** | 金色 | 3.0x | 极其稀有 |

## 🚦 项目状态

### 当前版本：v1.0.1

✅ **已完成功能**
- 核心游戏循环和战斗系统
- 完整的宠物收集和养成系统
- 领地建设和自动产出系统
- 5槽位存档和导入导出
- 成就和每日任务系统
- 装备系统和属性加成
- 离线收益系统

🔄 **最新改进** (v1.0.1)
- 修复游戏初始化失败问题
- 修复存档数据读取问题
- 优化 UISystem 初始化流程
- 修复 CSS 兼容性问题
- 删除重复导入，优化代码结构

🔮 **未来计划**
- 多人对战功能
- 宠物图鉴和收集挑战
- 特殊事件和季节活动
- 成就徽章系统
- 排行榜功能

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 🐛 报告问题

发现问题？请通过以下方式报告：
1. 查看 [Issues](https://github.com/Chacat68/PetPlan/issues) 中是否已有相同问题
2. 如果没有，请创建新的 Issue，附带详细的问题描述和复现步骤
3. 查看 [CODE_REVIEW_REPORT.md](./CODE_REVIEW_REPORT.md) 了解已知问题

## � 代码质量

- ✅ **模块化设计**: 完整的ES6模块系统
- ✅ **异常处理**: 完善的try-catch和错误提示
- ✅ **代码审查**: 定期进行代码审查和优化
- ✅ **文档完整**: 详细的API文档和使用指南
- 📈 **性能优化**: Canvas渲染优化、事件委托、缓存策略

最新代码审查报告：[CODE_REVIEW_REPORT.md](./CODE_REVIEW_REPORT.md)

## 🛠️ 故障排除

### 游戏无法加载
1. 检查浏览器是否支持 ES6 Module
2. 使用最新版本的 Chrome、Firefox 或 Safari
3. 查看浏览器控制台是否有错误信息
4. 尝试在 [诊断页面](./diagnostic.html) 中运行诊断

### 存档无法保存
1. 检查浏览器是否允许 LocalStorage
2. 检查浏览器隐私模式设置
3. 清空浏览器缓存后重试

### 性能问题
1. 关闭浏览器其他标签页
2. 降低浏览器硬件加速设置
3. 在现代浏览器中运行（推荐 Chrome 或 Edge）

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

- **GitHub**: [@Chacat68](https://github.com/Chacat68)
- **项目地址**: [https://github.com/Chacat68/PetPlan](https://github.com/Chacat68/PetPlan)
- **在线玩**: [PetPlan Demo](https://chacat68.github.io/PetPlan/)

## 🙏 致谢

感谢所有贡献者和玩家的支持！

---

**最后更新**: 2025年12月14日  
**版本**: v1.0.1
