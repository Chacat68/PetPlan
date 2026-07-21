# 战斗动画规范

## 资源清单

战斗单位统一提供 `idle`、`move`、`attack` 三个动作，共 15 个单位、45 张动作表。

| 分类 | 单位 |
| --- | --- |
| 角色 | `hero` |
| 宠物 | `fire_dog`、`ice_cat`、`thunder_bird`、`earth_bear`、`storm_dragon`、`unicorn`、`shadow_wolf`、`phoenix` |
| 怪物 | `slime`、`bat`、`skeleton`、`goblin`、`demon`、`dragon` |

## 帧协议

- 每个动作固定 12 帧，满足 10–15 帧的动作预算。
- 动作在 `512×512` 工作画布中制作，输出帧固定下采样为透明 `256×256` PNG 单元，足以覆盖游戏内最大显示尺寸并控制加载体积。
- 每张横向动作表固定为 `3072×256`。
- 角色主体使用统一内容预算、脚底基线和安全边距；动作特效也必须完整留在单帧内。
- `idle` 和 `move` 无缝循环；`attack` 使用前摇、命中峰值、后摇的单次曲线。

## 动作细节

- `idle`：呼吸缩放、轻微上下位移和柔和亮度脉冲，首尾连续。
- `move`：两组步态起伏、水平重心变化、轻微身体旋转，以及按元素或怪物类型区分的拖尾细节。
- `attack`：连续的蓄力—命中—恢复强度曲线；英雄保留枪口火光，宠物和怪物使用各自元素特效，并限制最大膨胀比例以避免裁切。

## 生成与校验

- 统一运行时配置：`js/modules/character-art-config.js`
- 生成脚本：`scripts/generate_battle_state_sprites.py`
- 机器可读清单：`images/sprites/battle/animation-manifest.json`
- 系统头像：`images/portraits/{hero,pets,monsters}/*.png`，从对应单位的新版待机首帧自动导出。
- 分类接触表：`images/sprites/battle/qa/*-contact-sheet.png`
- 逐动作循环预览：`images/sprites/battle/qa/previews/**/*.gif`

生成器会逐帧下采样以防相邻单元串色，并拒绝尺寸错误、空帧或贴住单帧外边缘的结果。运行 `npm test` 会再次核对 45 张动作表、12 帧数量和 `3072×256` PNG 尺寸。

## 系统接入

- 战斗、塔防：角色、宠物和怪物按 `idle / move / attack` 状态读取统一动作表。
- 领地：主角与跟随宠物使用同一帧数、帧宽和动作状态；不再按旧 512px 帧宽裁图。
- 主角档案、宠物中枢：使用从新版待机动作导出的 256×256 头像。
- 图片加载失败降级：角色、宠物、怪物仍回退到同套新版头像，不再回退到旧 `_table.png` 素材。
