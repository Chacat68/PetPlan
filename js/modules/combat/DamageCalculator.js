/**
 * 伤害计算器
 * 负责所有的伤害公式计算，纯逻辑类
 */
class DamageCalculator {
  /**
   * 计算最终伤害
   * @param {Object} attacker 攻击者数据 (attack, crit, critDamage等)
   * @param {Object} defender 防御者数据 (defense, dodge等)
   * @param {Object} randomizer 随机数生成器 (可选，方便测试)
   * @returns {Object} { damage: number, isCrit: boolean, isDodge: boolean }
   */
  static calculateDamage(attacker, defender, randomizer = Math.random) {
    // 1. 闪避判定
    const dodgeRate = defender.dodge || 0;
    if (randomizer() * 100 < dodgeRate) {
      return { damage: 0, isCrit: false, isDodge: true };
    }

    // 2. 基础伤害 = 攻击力 - 防御力
    // 确保至少造成 1 点伤害
    let damage = Math.max(1, (attacker.damage || 0) - (defender.defense || 0));

    // 3. 暴击判定
    const critRate = attacker.crit || 0;
    const isCrit = randomizer() * 100 < critRate;

    if (isCrit) {
      const critDamagePercent = attacker.critDamage || 150; // 默认150%
      damage = Math.floor(damage * (critDamagePercent / 100));
    }

    return {
      damage: Math.floor(damage),
      isCrit: isCrit,
      isDodge: false,
    };
  }
}

export default DamageCalculator;
