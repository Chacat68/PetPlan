# 存档系统 API 文档

## 概述

本文档描述了存档系统 (`SaveSystem`) 的完整 API 接口。

## 模块导入

```javascript
import SaveSystem, { getSaveSystemInstance } from './modules/save-system.js';
```

## 获取实例

```javascript
// 推荐：使用单例模式
const saveSystem = getSaveSystemInstance();
```

## 系统配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| savePrefix | 'petplan_save_' | 存档键名前缀 |
| autoSaveInterval | 30000 | 自动保存间隔(ms) |
| maxSaveSlots | 5 | 最大存档槽位数 |

## 核心 API

### 系统设置

#### setSystems(playerSystem, territorySystem, resourceSystem, combatSystem, petSystem)

设置各系统的引用，用于获取和恢复游戏状态。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| playerSystem | PlayerSystem | 玩家系统实例 |
| territorySystem | TerritorySystem | 领地系统实例 |
| resourceSystem | ResourceSystem | 资源系统实例 |
| combatSystem | CombatSystem | 战斗系统实例 |
| petSystem | PetSystem | 宠物系统实例 (可选) |

**示例：**
```javascript
saveSystem.setSystems(
    playerSystem,
    territorySystem,
    resourceSystem,
    combatSystem,
    petSystem
);
```

---

### 保存操作

#### saveGame(slot)

保存游戏到指定槽位。

**参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| slot | number | 1 | 存档槽位 (1-5) |

**返回值：** `boolean` - 是否保存成功

**示例：**
```javascript
const success = saveSystem.saveGame(2);
if (success) {
    console.log('保存成功');
}
```

---

#### quickSave()

快速保存到槽位1（快捷键 F5 调用）。

**返回值：** `boolean`

---

#### autoSave()

自动保存到槽位1，并显示保存提示。

---

#### updateAutoSave(deltaTime)

更新自动保存计时器（在游戏循环中调用）。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| deltaTime | number | 帧间隔时间(ms) |

**示例：**
```javascript
// 在 GameCore.update() 中调用
update(deltaTime) {
    // ... 其他更新
    if (this.saveSystem) {
        this.saveSystem.updateAutoSave(deltaTime);
    }
}
```

---

### 加载操作

#### loadGame(slot)

从指定槽位加载游戏。

**参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| slot | number | 1 | 存档槽位 (1-5) |

**返回值：** `boolean` - 是否加载成功

**示例：**
```javascript
const success = saveSystem.loadGame(2);
if (success) {
    console.log('加载成功');
}
```

---

#### quickLoad()

快速加载槽位1（快捷键 F9 调用）。

**返回值：** `boolean`

---

### 存档管理

#### getAllSaves()

获取所有存档信息。

**返回值：**
```javascript
[
    {
        slot: 1,
        exists: true,
        slotInfo: {
            slot: 1,
            savedAt: '2025/12/04 10:30:00',
            playerLevel: 15,
            coins: 50000
        }
    },
    {
        slot: 2,
        exists: false
    },
    // ... 共5个槽位
]
```

**示例：**
```javascript
const saves = saveSystem.getAllSaves();
saves.forEach(save => {
    if (save.exists) {
        console.log(`槽位${save.slot}: Lv.${save.slotInfo.playerLevel}`);
    } else {
        console.log(`槽位${save.slot}: 空`);
    }
});
```

---

#### deleteSave(slot)

删除指定槽位的存档。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| slot | number | 存档槽位 (1-5) |

**返回值：** `boolean` - 是否删除成功

---

#### clearAllSaves()

清空所有存档。

---

### 导入导出

#### exportSave(slot)

导出存档为 JSON 文件（触发下载）。

**参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| slot | number | 1 | 存档槽位 |

**导出文件名格式：** `petplan_save_slot{n}_{timestamp}.json`

**示例：**
```javascript
saveSystem.exportSave(1);
// 会下载: petplan_save_slot1_1701676800000.json
```

---

#### importSave(file, slot)

从 JSON 文件导入存档。

**参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| file | File | - | JSON 文件对象 |
| slot | number | 1 | 目标槽位 |

**返回值：** `Promise<boolean>` - 是否导入成功

**示例：**
```javascript
// 配合文件选择器使用
const fileInput = document.getElementById('importFile');
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const success = await saveSystem.importSave(file, 3);
    if (success) {
        console.log('导入成功');
    }
});
```

---

### 状态管理

#### getGameState()

获取当前游戏状态数据。

**返回值：**
```javascript
{
    version: '1.0.0',
    timestamp: 1701676800000,
    player: { ... },      // PlayerSystem.getSaveData()
    territory: { ... },   // TerritorySystem.getSaveData()
    resources: { ... },   // ResourceSystem.getSaveData()
    combat: { ... },      // CombatSystem.getSaveData()
    pets: { ... }         // PetSystem.getSaveData()
}
```

---

#### setGameState(gameState)

恢复游戏状态。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| gameState | Object | 游戏状态数据 |

**返回值：** `boolean` - 是否恢复成功

**恢复顺序：**
1. 资源系统
2. 领地系统
3. 玩家系统
4. 战斗系统
5. 宠物系统

---

### UI 反馈

#### showAutoSaveNotification()

显示自动保存提示通知。

**样式：**
- 位置：右上角
- 背景：半透明黑色
- 文字：绿色 "游戏已自动保存"
- 持续：2秒后消失

---

## 存档数据结构

### 完整存档格式

```javascript
{
    // 元信息
    version: '1.0.0',
    timestamp: 1701676800000,
    
    // 槽位信息
    slotInfo: {
        slot: 1,
        savedAt: '2025/12/04 10:30:00',
        playerLevel: 15,
        coins: 50000
    },
    
    // 玩家数据
    player: {
        level: 15,
        player: {
            x: 35,
            y: 200,
            level: 15,
            hp: 500,
            maxHp: 500,
            attack: 100,
            hpRegen: 5,
            critDamage: 200,
            attackSpeed: 1.5,
            crit: 20,
            multiShot: 5,
            tripleShot: 10,
            upgradeCosts: { ... }
        }
    },
    
    // 领地数据
    territory: {
        level: 1,
        size: { width: 20, height: 20 },
        buildings: [
            { id: 'main_base_1', type: 'main_base', level: 1, position: { x: 10, y: 10 } },
            // ...
        ],
        buildQueue: [],
        expansion: {
            currentSlots: 6,
            maxSlots: 12,
            expansionCount: 0,
            expandedSlots: []
        }
    },
    
    // 资源数据
    resources: {
        coins: 50000,
        rubies: 100,
        crystals: 500
    },
    
    // 战斗数据
    combat: {
        monsterSpawnInterval: 2000,
        attackInterval: 800,
        attackRange: 500
    },
    
    // 宠物数据
    pets: {
        ownedPets: [
            {
                instanceId: 1701676800000.123,
                templateId: 1,
                level: 5,
                exp: 50,
                expToNext: 150,
                // ...
            }
        ],
        slots: {
            front: [1701676800000.123, null, null],
            back: [null, null, null]
        }
    }
}
```

---

## LocalStorage 键名

| 键名 | 说明 |
|------|------|
| petplan_save_slot1 | 槽位1存档 |
| petplan_save_slot2 | 槽位2存档 |
| petplan_save_slot3 | 槽位3存档 |
| petplan_save_slot4 | 槽位4存档 |
| petplan_save_slot5 | 槽位5存档 |

---

## 使用示例

### 完整集成示例

```javascript
// 1. 初始化存档系统
const saveSystem = getSaveSystemInstance();

// 2. 设置系统引用
saveSystem.setSystems(
    playerSystem,
    territorySystem,
    resourceSystem,
    combatSystem,
    petSystem
);

// 3. 在游戏核心中添加自动保存
class GameCore {
    update(deltaTime) {
        // ... 其他更新
        this.saveSystem.updateAutoSave(deltaTime);
    }
}

// 4. 快捷键支持
window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
        e.preventDefault();
        saveSystem.quickSave();
    }
    if (e.key === 'F9') {
        e.preventDefault();
        saveSystem.quickLoad();
    }
});

// 5. 页面关闭前保存
window.addEventListener('beforeunload', () => {
    saveSystem.quickSave();
});
```

### 存档UI示例

```javascript
// 显示存档列表
function renderSaveList() {
    const saves = saveSystem.getAllSaves();
    const container = document.getElementById('saveList');
    
    saves.forEach(save => {
        const item = document.createElement('div');
        
        if (save.exists) {
            item.innerHTML = `
                <div>槽位 ${save.slot}</div>
                <div>Lv.${save.slotInfo.playerLevel}</div>
                <div>${save.slotInfo.savedAt}</div>
                <button onclick="loadSlot(${save.slot})">加载</button>
                <button onclick="deleteSlot(${save.slot})">删除</button>
            `;
        } else {
            item.innerHTML = `
                <div>槽位 ${save.slot} - 空</div>
                <button onclick="saveSlot(${save.slot})">保存</button>
            `;
        }
        
        container.appendChild(item);
    });
}
```

---

## 错误处理

```javascript
try {
    const success = saveSystem.saveGame(1);
    if (!success) {
        console.error('保存失败');
    }
} catch (error) {
    console.error('保存异常:', error);
    // 可能是 LocalStorage 已满
}
```

---

## 注意事项

1. **系统引用**：必须先调用 `setSystems()` 才能正常保存/加载
2. **槽位范围**：槽位编号为 1-5，超出范围会返回失败
3. **存储限制**：LocalStorage 通常限制 5-10MB
4. **版本兼容**：存档包含版本号，未来升级时需考虑迁移
5. **数据验证**：导入存档时会验证基本格式
6. **自动保存**：需要在游戏循环中调用 `updateAutoSave()`
