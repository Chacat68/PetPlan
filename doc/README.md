# 宠物计划 项目文档

## 项目概述

宠物计划是一个基于 HTML5 Canvas 的宠物养成类放置游戏，采用纯前端技术栈开发。游戏包含宠物系统、领地系统、战斗系统、角色成长系统、存档系统等多个功能模块。

## 文档结构

```
doc/
├── README.md                    # 项目文档总览（本文件）
│
├── 宠物系统使用指南.md           # 宠物系统用户指南
├── 存档系统使用指南.md           # 存档系统用户指南
├── 领地功能整理.md               # 领地功能说明
├── 后台建造功能说明.md           # 后台建造功能说明
│
├── architecture/                # 架构设计文档
│   ├── 系统架构总览.md          # 系统整体架构
│   ├── 模块结构设计.md          # 模块拆分设计
│   └── 数据流设计.md            # 数据流向设计
│
├── features/                    # 功能模块文档
│   ├── 游戏核心系统.md          # GameCore 系统
│   ├── 玩家系统.md              # PlayerSystem
│   ├── 战斗系统.md              # CombatSystem
│   ├── 宠物系统.md              # PetSystem ⭐新增
│   ├── 领地系统.md              # TerritorySystem
│   ├── 资源系统.md              # ResourceSystem ⭐新增
│   └── 存档系统.md              # SaveSystem
│
├── api/                         # API 接口文档
│   ├── 游戏核心API.md           # GameCore API
│   ├── 玩家系统API.md           # PlayerSystem API
│   ├── 用户界面系统API.md       # UISystem API
│   ├── 宠物系统API.md           # PetSystem API ⭐新增
│   ├── 资源系统API.md           # ResourceSystem API ⭐新增
│   ├── 存档系统API.md           # SaveSystem API ⭐新增
│   └── 领地系统API.md           # TerritorySystem API ⭐新增
│
├── development/                 # 开发文档
│   ├── 环境搭建指南.md          # 开发环境配置
│   └── 编码规范.md              # 代码规范
│
└── assets/                      # 资源文档
    ├── 图片资源说明.md          # 图片资源
    └── 样式资源说明.md          # CSS 样式
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | 原生 JavaScript (ES6+ Modules) |
| 渲染引擎 | HTML5 Canvas 2D |
| 样式 | CSS3 (动画、Flexbox、响应式) |
| 数据持久化 | LocalStorage |
| 构建工具 | 无（纯前端项目） |
| 浏览器支持 | Chrome, Firefox, Safari, Edge |

## 核心模块

| 模块 | 文件 | 功能 |
|------|------|------|
| GameCore | game-core.js | 游戏循环、场景渲染、系统协调 |
| PlayerSystem | player-system.js | 玩家属性、升级、战力计算 |
| CombatSystem | combat-system.js | 怪物生成、子弹、碰撞检测 |
| PetSystem | pet-system.js | 宠物收集、养成、编队、战斗 |
| TerritorySystem | territory-system.js | 领地建筑、资源产出 |
| ResourceSystem | resource-system.js | 货币管理、数字格式化 |
| SaveSystem | save-system.js | 存档保存、加载、导入导出 |
| UISystem | ui-system.js | 界面交互、弹窗管理 |

## 核心特性

### 🐾 宠物系统
- 8种独特宠物（普通到传说）
- 宠物收集、升级、养成
- 前后排编队（6槽位）
- 自动战斗和技能释放

### ⚔️ 战斗系统
- 基于 Canvas 的实时2D战斗
- 怪物自动生成和掉落
- 子弹轨迹和爆炸效果
- 暴击和闪避机制

### 🏰 领地系统
- 10种功能建筑
- 建造队列和时间
- 资源产出和属性加成
- 领地扩张功能

### 📊 成长系统
- 三维属性（力量/敏捷/智力）
- 多种战斗属性升级
- 批量升级支持
- 总战力计算

### 💾 存档系统
- 5个存档槽位
- 自动保存（30秒）
- 存档导入/导出
- 快捷键支持（F5/F9）

### 💰 资源系统
- 三种货币（金币/红宝石/水晶）
- 大数字格式化（1A/1B...）
- 战斗掉落和建筑产出

## 快速开始

### 运行游戏
```bash
# 克隆项目
git clone https://github.com/Chacat68/PetPlan.git
cd PetPlan

# 使用 HTTP 服务器运行
python -m http.server 8080
# 或使用 VS Code Live Server
```

### 快捷键
| 按键 | 功能 |
|------|------|
| F5 | 快速保存 |
| F9 | 快速加载 |
| ESC | 关闭弹窗 |

## 开发指南

### 目录结构
```
PetPlan/
├── index.html          # 主游戏页面
├── territory.html      # 领地系统页面
├── css/                # 样式文件
├── js/
│   ├── main.js         # 主入口
│   └── modules/        # 功能模块
├── images/             # 图片资源
└── doc/                # 项目文档
```

### 模块依赖关系
```
main.js
  ├── GameCore
  │     ├── PlayerSystem
  │     ├── CombatSystem ←→ PetSystem
  │     ├── TerritorySystem
  │     ├── ResourceSystem
  │     └── SaveSystem
  └── UISystem
        ├── SaveUI
        └── PetUI
```

### 添加新功能
1. 在 `js/modules/` 创建新模块
2. 在 `main.js` 中导入并初始化
3. 实现 `getSaveData()` 和 `loadSaveData()` 用于存档
4. 更新相关文档

## 文档导航

### 新手入门
- [环境搭建指南](./development/环境搭建指南.md)
- [系统架构总览](./architecture/系统架构总览.md)

### 功能了解
- [宠物系统使用指南](./宠物系统使用指南.md)
- [存档系统使用指南](./存档系统使用指南.md)
- [领地功能整理](./领地功能整理.md)

### 开发参考
- [编码规范](./development/编码规范.md)
- [API 文档](./api/)
- [功能模块文档](./features/)

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/NewFeature`)
3. 提交更改 (`git commit -m 'Add NewFeature'`)
4. 推送到分支 (`git push origin feature/NewFeature`)
5. 创建 Pull Request

请遵循 [编码规范](./development/编码规范.md)

## 版本历史

### v1.0.0 (2025-01)
- ✅ 宠物收集和养成系统
- ✅ 自动战斗和技能系统
- ✅ 领地建设和扩张
- ✅ 多槽位存档系统
- ✅ 完整的 UI 界面

## 许可证

本项目采用 MIT 许可证
