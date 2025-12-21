/**
 * 游戏核心模块
 * 负责游戏循环、渲染管理、事件处理等核心功能
 */

class GameCore {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', {
            alpha: false,  // 禁用alpha通道提升性能
            desynchronized: true  // 降低延迟
        });
        if (!this.ctx) {
            console.error('无法获取画布上下文');
            return;
        }

        // 优化Canvas渲染
        this.ctx.imageSmoothingEnabled = false;  // 禁用图像平滑

        // 游戏状态
        this.isRunning = true;
        this.lastTime = 0;
        this.fps = 60;
        this.frameInterval = 1000 / this.fps;
        this.then = Date.now();

        // 地图边界
        this.mapWidth = this.canvas.width;
        this.mapHeight = this.canvas.height;

        // 子系统引用
        this.playerSystem = null;
        this.combatSystem = null;
        this.uiSystem = null;
        this.resourceSystem = null;

        // 场景装饰元素
        this.clouds = [];
        this.grassDecorations = [];
        this.mountains = [];
    }

    /**
     * 初始化游戏核心
     */
    init() {
        this.initSceneElements();
        console.log('游戏核心初始化完成');
    }

    /**
     * 初始化场景元素
     */
    initSceneElements() {
        // 初始化云朵
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * this.mapWidth,
                y: 30 + Math.random() * 100,
                speed: 0.2 + Math.random() * 0.3,
                size: 0.8 + Math.random() * 0.4
            });
        }

        // 初始化装饰元素 (Glowing Particles / Dark Rocks)
        for (let i = 0; i < 40; i++) {
            this.grassDecorations.push({
                x: Math.random() * this.mapWidth,
                y: this.mapHeight - 50 + Math.random() * 40,
                height: 2 + Math.random() * 5, // Smaller, more like particles or small rocks
                color: Math.random() > 0.5 ? '#4c1d95' : '#5b21b6', // Dark Purple
                alpha: 0.3 + Math.random() * 0.5
            });
        }

        // 初始化远景山脉 (Dark Silhouettes)
        this.mountains = [];
        let x = 0;
        while (x < this.mapWidth) {
            const width = 100 + Math.random() * 150;
            const height = 100 + Math.random() * 150; // Taller, more imposing
            this.mountains.push({
                x: x,
                y: this.mapHeight - 40,
                width: width,
                height: height,
                color: '#1e1b2e' // Very dark blue/purple
            });
            x += width * 0.6;
        }
    }

    /**
     * 设置子系统引用
     */
    setSystems(playerSystem, combatSystem, uiSystem, resourceSystem, territorySystem, saveSystem, petSystem, equipmentSystem, achievementSystem) {
        this.playerSystem = playerSystem;
        this.combatSystem = combatSystem;
        this.uiSystem = uiSystem;
        this.resourceSystem = resourceSystem;
        this.territorySystem = territorySystem;
        this.saveSystem = saveSystem;
        this.petSystem = petSystem;
        this.equipmentSystem = equipmentSystem;
        this.achievementSystem = achievementSystem;

        // 确保PlayerSystem也能访问EquipmentSystem
        if (this.playerSystem) {
            this.playerSystem.setEquipmentSystem(this.equipmentSystem);
        }
    }

    /**
     * 游戏主循环
     */
    gameLoop(currentTime = 0) {
        requestAnimationFrame((time) => this.gameLoop(time));

        if (!this.isRunning) {
            return;
        }

        // 帧率控制
        const now = Date.now();
        const elapsed = now - this.then;

        if (elapsed < this.frameInterval) {
            return;
        }

        this.then = now - (elapsed % this.frameInterval);

        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.render();
    }

    /**
     * 更新游戏逻辑
     */
    update(deltaTime) {
        // 更新云朵位置
        this.clouds.forEach(cloud => {
            cloud.x += cloud.speed;
            if (cloud.x > this.mapWidth + 100) {
                cloud.x = -100;
                cloud.y = 30 + Math.random() * 100;
            }
        });

        // 更新玩家系统
        if (this.playerSystem) {
            this.playerSystem.update(deltaTime);
        }

        // 更新战斗系统（宠物战斗也在这里更新）
        if (this.combatSystem) {
            this.combatSystem.update(deltaTime);
        }

        // 更新UI系统
        if (this.uiSystem) {
            this.uiSystem.update(deltaTime);
        }

        // 更新领地系统（处理资源产出）
        if (this.territorySystem) {
            this.territorySystem.update(deltaTime);
        }

        // 更新存档系统（自动保存）
        if (this.saveSystem) {
            this.saveSystem.updateAutoSave(deltaTime);
        }
    }

    /**
     * 渲染游戏画面
     */
    render() {
        // 绘制天空背景
        this.drawSky();

        // 绘制远景山脉
        this.drawMountains();

        // 绘制地面
        this.drawGround();

        // 绘制装饰性草丛
        this.drawGrassTexture();

        // 绘制云朵
        this.drawClouds();

        // 渲染各个系统
        if (this.playerSystem) {
            this.playerSystem.render(this.ctx);
        }

        // 渲染宠物（在玩家之后，战斗系统之前）
        if (this.petSystem) {
            this.petSystem.render(this.ctx);
        }

        if (this.combatSystem) {
            this.combatSystem.render(this.ctx);
        }
    }

    /**
     * 绘制天空 (Dark Fantasy Night)
     */
    drawSky() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.mapHeight);
        gradient.addColorStop(0, '#0f0e17'); // Pitch black/Deep purple
        gradient.addColorStop(1, '#2d2b42'); // Dark horizon
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.mapWidth, this.mapHeight);

        // Optional: Add stars
        // (Assuming simple random stars could be added in init or draw, but for now gradient is key)
    }

    /**
     * 绘制山脉
     */
    /**
     * 绘制山脉 (Silhouettes)
     */
    drawMountains() {
        this.ctx.save();
        this.mountains.forEach(mountain => {
            this.ctx.fillStyle = mountain.color;
            this.ctx.beginPath();
            // Simple triangle shape
            this.ctx.moveTo(mountain.x, mountain.y);
            this.ctx.lineTo(mountain.x + mountain.width / 2, mountain.y - mountain.height);
            this.ctx.lineTo(mountain.x + mountain.width, mountain.y);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Faint rim light instead of snow
            this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)'; // Faint purple/blue rim
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        });
        this.ctx.restore();
    }

    /**
     * 绘制地面
     */
    /**
     * 绘制地面 (Dark Terrain)
     */
    drawGround() {
        const groundY = this.mapHeight - 50;

        // 地面渐变
        const gradient = this.ctx.createLinearGradient(0, groundY, 0, this.mapHeight);
        gradient.addColorStop(0, '#1a1a2e'); // Dark Blue/Black
        gradient.addColorStop(1, '#0f0e17'); // Almost black

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, groundY, this.mapWidth, 50);

        // 地面边缘线 (Glowing)
        this.ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)'; // Faint purple glow
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, groundY);
        this.ctx.lineTo(this.mapWidth, groundY);
        this.ctx.stroke();
    }

    /**
     * 绘制草地纹理
     */
    /**
     * 绘制地面装饰 (Mystical Particles/Rocks)
     */
    drawGrassTexture() {
        this.grassDecorations.forEach(item => {
            this.ctx.fillStyle = item.color;
            this.ctx.globalAlpha = item.alpha || 0.5;
            this.ctx.beginPath();
            // Small diamond/rock shapes
            this.ctx.moveTo(item.x, item.y);
            this.ctx.lineTo(item.x - 2, item.y - item.height / 2);
            this.ctx.lineTo(item.x, item.y - item.height);
            this.ctx.lineTo(item.x + 2, item.y - item.height / 2);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        });
    }

    /**
     * 绘制云朵
     */
    /**
     * 绘制云朵 (Mist/Fog)
     */
    drawClouds() {
        this.ctx.fillStyle = '#6366f1'; // faint purple/blue mist
        this.ctx.globalAlpha = 0.05; // Very subtle

        this.clouds.forEach(cloud => {
            this.ctx.save();
            this.ctx.translate(cloud.x, cloud.y);
            this.ctx.scale(cloud.size, cloud.size * 0.6); // Flattened like fog

            this.ctx.beginPath();
            this.ctx.arc(0, 0, 30, 0, Math.PI * 2);
            this.ctx.arc(40, 10, 40, 0, Math.PI * 2);
            this.ctx.arc(80, 0, 30, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        });

        this.ctx.globalAlpha = 1;
    }

    /**
     * 启动游戏
     */
    start() {
        this.isRunning = true;
        this.gameLoop();
    }

    /**
     * 停止游戏
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * 获取画布上下文
     */
    getContext() {
        return this.ctx;
    }

    /**
     * 获取地图尺寸
     */
    getMapSize() {
        return {
            width: this.mapWidth,
            height: this.mapHeight
        };
    }
}

export default GameCore;
