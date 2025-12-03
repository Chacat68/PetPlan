/**
 * 模块索引文件
 * 统一导出所有模块，方便管理和使用
 */

export { default as GameCore } from './game-core.js';
export { default as PlayerSystem } from './player-system.js';
export { default as CombatSystem } from './combat-system.js';
export { default as UISystem } from './ui-system.js';
export { default as ResourceSystem } from './resource-system.js';
export { default as TerritorySystem } from './territory-system.js';
export { default as PetSystem, getPetSystemInstance } from './pet-system.js';
export { default as PetUI, getPetUIInstance } from './pet-ui.js';
export { default as SaveSystem, getSaveSystemInstance } from './save-system.js';
export { default as SaveUI } from './save-ui.js';
