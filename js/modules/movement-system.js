/**
 * MovementSystem - shared frame-based movement helpers.
 * Keeps actors moving by speed and deltaTime instead of teleporting.
 */

export class MovementSystem {
    moveToward(entity, targetX, targetY, speed, deltaTime, options = {}) {
        if (!entity || !Number.isFinite(targetX) || !Number.isFinite(targetY)) {
            return { moved: false, distance: Infinity, arrived: false };
        }

        const currentX = Number.isFinite(entity.x) ? entity.x : targetX;
        const currentY = Number.isFinite(entity.y) ? entity.y : targetY;
        const dx = targetX - currentX;
        const dy = targetY - currentY;
        const distance = Math.hypot(dx, dy);
        const arriveDistance = options.arriveDistance ?? 1;

        if (distance <= arriveDistance || distance <= 0.001) {
            entity.x = targetX;
            entity.y = targetY;
            this.clampToBounds(entity, options.bounds);
            return { moved: false, distance: 0, arrived: true };
        }

        const dt = Math.min(Math.max(deltaTime, 0), options.maxDeltaTime ?? 50) / 1000;
        const step = Math.min(distance, Math.max(0, speed) * dt);

        entity.x = currentX + (dx / distance) * step;
        entity.y = currentY + (dy / distance) * step;
        this.clampToBounds(entity, options.bounds);

        const remainingDistance = Math.max(0, distance - step);
        return {
            moved: step > 0,
            distance: remainingDistance,
            arrived: remainingDistance <= arriveDistance
        };
    }

    clampToBounds(entity, bounds) {
        if (!entity || !bounds) return;

        const width = entity.width || 0;
        const height = entity.height || 0;
        const minX = bounds.minX ?? 0;
        const minY = bounds.minY ?? 0;
        const maxX = bounds.maxX ?? Infinity;
        const maxY = bounds.maxY ?? Infinity;

        entity.x = Math.min(maxX - width, Math.max(minX, entity.x));
        entity.y = Math.min(maxY - height, Math.max(minY, entity.y));
    }

    getCenter(entity) {
        return {
            x: (entity?.x || 0) + (entity?.width || 0) / 2,
            y: (entity?.y || 0) + (entity?.height || 0) / 2
        };
    }
}
