# 📚 PetPlan 项目文档

欢迎来到 PetPlan（宠物计划）项目文档中心。本文档库包含了完整的游戏设计、实现和使用指南。

## 🎯 快速导航

### 👤 玩家和新手
- **[QUICKSTART.md](./QUICKSTART.md)** ⭐ - 5分钟快速开始指南
- **[../README.md](../README.md)** - 项目简介和功能特性

### 👨‍💻 开发者
- **[架构文档](#系统架构)** - 了解项目设计
- **[功能文档](#功能系统)** - 学习各个系统实现
- **[API 文档](#api-文档)** - 查看接口调用方法
- **[development/](./development/)** - 开发环境和规范

---

## 📚 文档分类

### 系统架构

项目采用模块化架构设计，清晰的职责分离：

| 文档 | 说明 |
|------|------|
| [architecture/系统架构总览.md](./architecture/系统架构总览.md) | 整体架构设计、模块间交互、数据流 |
| [architecture/模块结构设计.md](./architecture/模块结构设计.md) | 详细的模块设计、依赖关系、扩展方案 |
| [architecture/数据流设计.md](./architecture/数据流设计.md) | 状态管理、数据持久化、事件系统 |

### 功能系统

按系统模块组织的详细功能文档：

#### 核心系统
| 文档 | 说明 |
|------|------|
| [features/游戏核心系统.md](./features/游戏核心系统.md) | Game 类、渲染循环、帧率控制、场景管理 |
| [features/玩家系统.md](./features/玩家系统.md) | 玩家属性、升级系统、战力计算 |
| [features/资源系统.md](./features/资源系统.md) | 金币、红宝石、水晶的管理和获取 |

#### 游戏系统
| 文档 | 说明 |
|------|------|
| [features/战斗系统.md](./features/战斗系统.md) | 怪物、子弹、碰撞检测、伤害计算 |
| [features/宠物系统.md](./features/宠物系统.md) | 宠物收集、升级、编队、属性加成、养成 |
| [features/领地系统.md](./features/领地系统.md) | 建筑建造、升级、资源产出、属性加成 |

#### 高级系统
| 文档 | 说明 |
|------|------|
| [features/存档系统.md](./features/存档系统.md) | 存档管理、导入导出、自动保存 |
| [features/成就系统.md](./features/成就系统.md) | 成就、日常任务、奖励系统 |
| [features/装备系统.md](./features/装备系统.md) | 装备获取、合成、属性加成 |
| [features/离线系统.md](./features/离线系统.md) | 离线收益计算、后台产出 |

#### 玩家指南
| 文档 | 说明 |
|------|------|
| [guides/玩家指南.md](./guides/玩家指南.md) | 完整的游戏玩法和系统说明（新玩家必读）|

### API 文档

各系统的接口调用手册：

| 文档 | 说明 |
|------|------|
| [api/游戏核心API.md](./api/游戏核心API.md) | Game 类方法、事件系统、状态管理 |
| [api/玩家系统API.md](./api/玩家系统API.md) | 玩家数据操作、属性升级 |
| [api/资源系统API.md](./api/资源系统API.md) | 货币管理、数值操作 |
| [api/战斗系统API.md](./api/战斗系统API.md) | 怪物管理、战斗控制 |
| [api/宠物系统API.md](./api/宠物系统API.md) | 宠物操作、升级、编队 |
| [api/领地系统API.md](./api/领地系统API.md) | 建筑操作、升级、产出管理 |
| [api/存档系统API.md](./api/存档系统API.md) | 存档操作、导入导出 |
| [api/用户界面系统API.md](./api/用户界面系统API.md) | UI 提示、对话框、动画 |
| [api/成就系统API.md](./api/成就系统API.md) | 任务管理、成就追踪 |
| [api/装备系统API.md](./api/装备系统API.md) | 装备操作、属性加成 |
| [api/离线系统API.md](./api/离线系统API.md) | 离线收益计算、数据查询 |

### 开发文档

项目开发相关的指南和规范：

| 文档 | 说明 |
|------|------|
| [development/环境搭建指南.md](./development/环境搭建指南.md) | 开发环境搭建、调试、部署 |
| [development/编码规范.md](./development/编码规范.md) | 代码风格、命名规范、最佳实践 |

### 资源文档

项目资源的使用说明：

| 文档 | 说明 |
|------|------|
| [assets/图片资源说明.md](./assets/图片资源说明.md) | 图片资源位置、使用方法 |
| [assets/样式资源说明.md](./assets/样式资源说明.md) | CSS 样式、类名、主题 |

### 项目维护

项目的更新历史和版本信息：

| 文档 | 说明 |
|------|------|
| [CHANGELOG.md](./CHANGELOG.md) | 更新日志、版本历史、修复记录 |
| [CODE_REVIEW_REPORT.md](./CODE_REVIEW_REPORT.md) | 代码审查结果、建议、质量评估 |

---

## 📖 推荐阅读顺序

### 对于新玩家
1. [../README.md](../README.md) - 了解游戏概况（5分钟）
2. [QUICKSTART.md](./QUICKSTART.md) - 学习基本操作（15分钟）

### 对于新开发者
1. [../README.md](../README.md) - 项目概况
2. [architecture/系统架构总览.md](./architecture/系统架构总览.md) - 了解设计
3. [development/环境搭建指南.md](./development/环境搭建指南.md) - 搭建环境
4. 选择感兴趣的系统文档深入学习

### 对于代码维护者
1. [CODE_REVIEW_REPORT.md](./CODE_REVIEW_REPORT.md) - 代码质量和建议
2. [CHANGELOG.md](./CHANGELOG.md) - 版本历史
3. 相关系统的 features 和 api 文档
4. [development/编码规范.md](./development/编码规范.md) - 确保一致性

---

## 🔍 文档查询

### 如何找到想要的文档？

**按功能查找：** 使用上面的系统功能表格
**按文件查找：** 使用 [CHANGELOG.md](./CHANGELOG.md) 搜索特定系统
**按开发阶段查找：** 使用推荐阅读顺序
**快速参考：** 查看 [js/modules/QUICK_REFERENCE.md](../js/modules/QUICK_REFERENCE.md)

---

## 📊 文档统计

- 📁 **总文件数：** 40+ 个文档
- 📊 **覆盖系统：** 10+ 个游戏系统
- 💾 **总容量：** 500+ KB 文档
- ✅ **完整度：** 95%+

---

## ❓ 常见问题

**Q: 如何快速开始开发？**  
A: 参考 [development/环境搭建指南.md](./development/环境搭建指南.md)

**Q: 我想修改某个系统，但不知道从何开始？**  
A: 先查看对应系统的 `features/` 文档了解设计，再查看 `api/` 文档学习接口

**Q: 项目的代码质量如何？**  
A: 查看 [CODE_REVIEW_REPORT.md](./CODE_REVIEW_REPORT.md)

**Q: 如何贡献代码？**  
A: 遵循 [development/编码规范.md](./development/编码规范.md)，参考 CHANGELOG 的版本管理方式

---

## 📝 文档维护

- **最后更新：** 2025年12月14日
- **维护者：** PetPlan 开发团队
- **反馈方式：** 通过项目 Issue 或 PR

---

**提示：** 使用浏览器的查找功能（Ctrl+F 或 Cmd+F）可以快速在文档中定位关键词。
