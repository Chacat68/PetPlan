/**
 * @file 建筑资源配置
 * @description 包含建筑图标、SVG、名称和描述
 */

import { BuildingType } from './territory-config.js';

export const BUILDING_ICONS = {
    [BuildingType.TRAINING_GROUND]: '🏋️',
    [BuildingType.TEMPLE]: '🏛️',
    [BuildingType.MAIN_BASE]: '🏰',
    [BuildingType.BARRACKS]: '🏕️',
    [BuildingType.WORKSHOP]: '🔨',
    [BuildingType.CRYSTAL_MINE]: '💎',
    [BuildingType.LIBRARY]: '📚',
    [BuildingType.HOSPITAL]: '🏥',
    [BuildingType.TOWER]: '🗼',
    [BuildingType.MARKET]: '🏪'
};

export const BUILDING_SVGS = {
    [BuildingType.MAIN_BASE]: `<svg viewBox="0 0 100 100" width="100%" height="100%"><defs><linearGradient id="wallGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#bdc3c7;stop-opacity:1" /><stop offset="100%" style="stop-color:#95a5a6;stop-opacity:1" /></linearGradient><linearGradient id="roofGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#e74c3c;stop-opacity:1" /><stop offset="100%" style="stop-color:#c0392b;stop-opacity:1" /></linearGradient></defs><rect x="30" y="40" width="40" height="50" fill="url(#wallGrad)" /><polygon points="30,40 50,10 70,40" fill="url(#roofGrad)" /><rect x="45" y="60" width="10" height="30" fill="#555" rx="5" /><rect x="10" y="50" width="20" height="40" fill="url(#wallGrad)" /><polygon points="10,50 20,30 30,50" fill="url(#roofGrad)" /><rect x="70" y="50" width="20" height="40" fill="url(#wallGrad)" /><polygon points="70,50 80,30 90,50" fill="url(#roofGrad)" /></svg>`,
    [BuildingType.CRYSTAL_MINE]: `<svg viewBox="0 0 100 100" width="100%" height="100%"><defs><linearGradient id="crystalGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#a2d9ff;stop-opacity:0.9" /><stop offset="100%" style="stop-color:#0077be;stop-opacity:0.9" /></linearGradient></defs><path d="M50 10 L70 40 L50 90 L30 40 Z" fill="url(#crystalGrad)" stroke="white" stroke-width="1"/><path d="M20 60 L35 50 L30 80 Z" fill="url(#crystalGrad)" stroke="white" stroke-width="1"/><path d="M80 60 L65 50 L70 80 Z" fill="url(#crystalGrad)" stroke="white" stroke-width="1"/></svg>`,
    [BuildingType.TRAINING_GROUND]: `<svg viewBox="0 0 100 100" width="100%" height="100%"><ellipse cx="50" cy="80" rx="40" ry="10" fill="#e67e22" /><rect x="45" y="40" width="10" height="40" fill="#8e44ad" /><circle cx="50" cy="40" r="20" fill="#ecf0f1" stroke="#c0392b" stroke-width="5" /><circle cx="50" cy="40" r="10" fill="#c0392b" /><path d="M70 70 L90 50 L85 45 L65 65 Z" fill="#bdc3c7" /><rect x="62" y="62" width="8" height="8" fill="#f1c40f" transform="rotate(45 66 66)" /></svg>`,
    [BuildingType.TEMPLE]: `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="10" y="80" width="80" height="10" fill="#ecf0f1" /><rect x="15" y="75" width="70" height="5" fill="#bdc3c7" /><rect x="20" y="35" width="10" height="40" fill="#ecf0f1" /><rect x="45" y="35" width="10" height="40" fill="#ecf0f1" /><rect x="70" y="35" width="10" height="40" fill="#ecf0f1" /><polygon points="10,35 50,10 90,35" fill="#f1c40f" /><rect x="10" y="35" width="80" height="5" fill="#bdc3c7" /></svg>`,
    [BuildingType.BARRACKS]: `<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M20 80 L50 20 L80 80 Z" fill="#27ae60" /><path d="M45 80 L50 20 L55 80 Z" fill="#2ecc71" /><path d="M40 80 L50 50 L60 80 Z" fill="#2c3e50" /><line x1="50" y1="20" x2="50" y2="5" stroke="#7f8c8d" stroke-width="2" /><polygon points="50,5 70,10 50,15" fill="#e74c3c" /></svg>`,
    [BuildingType.WORKSHOP]: `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="20" y="40" width="60" height="40" fill="#d35400" /><polygon points="20,40 50,20 80,40" fill="#e67e22" /><rect x="65" y="25" width="10" height="20" fill="#7f8c8d" /><circle cx="50" cy="60" r="15" fill="#95a5a6" stroke="#7f8c8d" stroke-width="5" stroke-dasharray="5,5" /></svg>`,
    [BuildingType.LIBRARY]: `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="20" y="30" width="60" height="50" fill="#3498db" rx="5" /><rect x="25" y="35" width="50" height="40" fill="#ecf0f1" /><rect x="30" y="40" width="40" height="5" fill="#bdc3c7" /><rect x="30" y="50" width="40" height="5" fill="#bdc3c7" /><rect x="30" y="60" width="40" height="5" fill="#bdc3c7" /></svg>`,
    [BuildingType.HOSPITAL]: `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="25" y="30" width="50" height="50" fill="#ecf0f1" stroke="#bdc3c7" stroke-width="2" /><polygon points="20,30 50,10 80,30" fill="#e74c3c" /><rect x="45" y="45" width="10" height="20" fill="#e74c3c" /><rect x="40" y="50" width="20" height="10" fill="#e74c3c" /></svg>`,
    [BuildingType.TOWER]: `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="35" y="30" width="30" height="60" fill="#7f8c8d" /><rect x="30" y="20" width="40" height="10" fill="#95a5a6" /><rect x="32" y="15" width="6" height="5" fill="#95a5a6" /><rect x="47" y="15" width="6" height="5" fill="#95a5a6" /><rect x="62" y="15" width="6" height="5" fill="#95a5a6" /><rect x="45" y="40" width="10" height="15" fill="#2c3e50" rx="5" /></svg>`,
    [BuildingType.MARKET]: `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="20" y="50" width="60" height="30" fill="#f39c12" /><rect x="20" y="80" width="10" height="10" fill="#d35400" /><rect x="70" y="80" width="10" height="10" fill="#d35400" /><path d="M15 50 L85 50 L75 30 L25 30 Z" fill="#e74c3c" /><path d="M25 30 L35 50 L45 30 L55 50 L65 30 L75 50" fill="none" stroke="#ecf0f1" stroke-width="2" /></svg>`
};

export const BUILDING_NAMES = {
    [BuildingType.TRAINING_GROUND]: '训练场',
    [BuildingType.TEMPLE]: '神庙',
    [BuildingType.MAIN_BASE]: '主基地',
    [BuildingType.BARRACKS]: '兵营',
    [BuildingType.WORKSHOP]: '工坊',
    [BuildingType.CRYSTAL_MINE]: '水晶矿',
    [BuildingType.LIBRARY]: '图书馆',
    [BuildingType.HOSPITAL]: '医院',
    [BuildingType.TOWER]: '防御塔',
    [BuildingType.MARKET]: '市场'
};

export function getBuildingDescription(buildingType, levelInfo) {
    const descriptions = {
        [BuildingType.TRAINING_GROUND]: `攻击力 +${levelInfo.attackBonus || 0}`,
        [BuildingType.TEMPLE]: `防御力 +${levelInfo.defenseBonus || 0}`,
        [BuildingType.MAIN_BASE]: `生命值 ${levelInfo.hp || 0}，建筑上限 ${levelInfo.buildLimit || 0}`,
        [BuildingType.BARRACKS]: `生命值 ${levelInfo.hp || 0}，攻击+${levelInfo.attackBonus || 0}，防御+${levelInfo.defenseBonus || 0}`,
        [BuildingType.WORKSHOP]: `金币产出 +${levelInfo.goldProduction || 0}/小时`,
        [BuildingType.CRYSTAL_MINE]: `宝石产出 +${levelInfo.crystalProduction || 0}/小时`,
        [BuildingType.LIBRARY]: `经验加成 +${levelInfo.experienceBonus || 0}%`,
        [BuildingType.HOSPITAL]: `生命值 ${levelInfo.hp || 0}，治疗率 +${levelInfo.healingRate || 0}/小时`,
        [BuildingType.TOWER]: `攻击+${levelInfo.attackBonus || 0}，防御+${levelInfo.defenseBonus || 0}`,
        [BuildingType.MARKET]: `金币+${levelInfo.goldProduction || 0}/小时，宝石+${levelInfo.crystalProduction || 0}/小时`
    };
    return descriptions[buildingType] || '提供属性加成';
}
