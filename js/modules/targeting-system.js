/**
 * TargetingSystem - shared enemy acquisition helpers.
 * Keeps "who should I attack" in one place for hero, pets, and combat shots.
 */

export class TargetingSystem {
    getAliveTargets(candidates = []) {
        return candidates.filter(target => target && target.hp > 0);
    }

    acquireTarget(origin, candidates = [], options = {}) {
        return this.getTargets(origin, candidates, { ...options, limit: 1 })[0] || null;
    }

    getTargets(origin, candidates = [], options = {}) {
        const originPoint = this.getPoint(origin);
        const strategy = options.strategy || 'nearest';
        const maxRange = options.maxRange ?? Infinity;
        const limit = options.limit ?? Infinity;

        return this.getAliveTargets(candidates)
            .map(target => {
                const targetPoint = this.getCenter(target);
                return {
                    target,
                    distance: Math.hypot(targetPoint.x - originPoint.x, targetPoint.y - originPoint.y),
                    laneDelta: Math.abs(targetPoint.y - originPoint.y),
                    ahead: targetPoint.x >= originPoint.x,
                    hpRatio: target.maxHp > 0 ? target.hp / target.maxHp : 1,
                    x: targetPoint.x
                };
            })
            .filter(item => item.distance <= maxRange)
            .sort((a, b) => this.compareTargets(a, b, strategy))
            .slice(0, limit)
            .map(item => item.target);
    }

    compareTargets(a, b, strategy) {
        if (strategy === 'ahead') {
            const aheadDelta = Number(b.ahead) - Number(a.ahead);
            if (aheadDelta !== 0) return aheadDelta;
            return a.distance - b.distance;
        }

        if (strategy === 'lane') {
            return a.laneDelta - b.laneDelta || a.distance - b.distance;
        }

        if (strategy === 'weakest') {
            return a.hpRatio - b.hpRatio || a.distance - b.distance;
        }

        if (strategy === 'frontline') {
            return a.x - b.x || a.distance - b.distance;
        }

        return a.distance - b.distance;
    }

    getPoint(entity) {
        if (!entity) {
            return { x: 0, y: 0 };
        }

        return {
            x: Number.isFinite(entity.x) ? entity.x : 0,
            y: Number.isFinite(entity.y) ? entity.y : 0
        };
    }

    getCenter(entity) {
        if (!entity) {
            return { x: 0, y: 0 };
        }

        return {
            x: (Number.isFinite(entity.x) ? entity.x : 0) + (entity.width || 0) / 2,
            y: (Number.isFinite(entity.y) ? entity.y : 0) + (entity.height || 0) / 2
        };
    }
}
