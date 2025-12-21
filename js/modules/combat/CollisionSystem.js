/**
 * 碰撞系统
 * 负责检测游戏对象之间的碰撞
 */
class CollisionSystem {
    /**
     * 检测点与矩形的碰撞 (用于子弹 vs 怪物)
     * @param {Object} point {x, y}
     * @param {Object} rect {x, y, width, height}
     * @param {number} tolerance 容差/碰撞半径
     */
    static checkPointRect(point, rect, tolerance = 0) {
        // 简单的圆形/矩形近似碰撞
        // 将矩形中心视为圆心
        const rectCenterX = rect.x + rect.width / 2;
        const rectCenterY = rect.y + rect.height / 2;
        
        // 使用距离检测，近似处理
        const dx = point.x - rectCenterX;
        const dy = point.y - rectCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 判定阈值：矩形宽的一半 + 容差
        const threshold = (rect.width / 2) + tolerance;
        
        return distance < threshold;
    }

    /**
     * 检测矩形与矩形的碰撞 (AABB, 用于玩家 vs 怪物)
     * @param {Object} rect1 {x, y, width, height}
     * @param {Object} rect2 {x, y, width, height}
     */
    static checkRectRect(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    /**
     * 检测圆形与圆形的碰撞 (用于技能范围)
     * @param {Object} circle1 {x, y, radius} or {x, y} (if point)
     * @param {Object} circle2 {x, y, radius} or {x, y} (if point)
     */
    static checkCircleCircle(circle1, circle2) {
        const dx = circle1.x - circle2.x;
        const dy = circle1.y - circle2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const r1 = circle1.radius || 0;
        const r2 = circle2.radius || 0;
        
        return distance < (r1 + r2);
    }
}

export default CollisionSystem;
