/**
 * GameCore - 游戏核心
 * 负责游戏循环、场景渲染、帧率控制
 */

let instance = null;

export class GameCore {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        
        // 配置
        this.config = {
            baseWidth: 750,
            baseHeight: 1800,
            width: 750,
            height: 1800,
            targetFps: 60,
            autoSaveInterval: 30000
        };
        
        // 状态
        this.isRunning = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.frameCount = 0;
        
        // 缩放比例
        this.scale = 1;
        
        // 系统引用
        this.systems = {};
        
        // 自动保存计时器
        this.autoSaveTimer = 0;
        
        // 场景元素
        this.clouds = this.generateClouds();
        
        // 初始化 Canvas 尺寸（固定尺寸，不随窗口变化）
        this.resizeCanvas();
        
        console.log('[GameCore] 初始化完成');
    }
    
    /**
     * 调整 Canvas 尺寸
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (!container) return;
        
        // 获取容器尺寸
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // 如果尺寸为0，跳过
        if (containerWidth === 0 || containerHeight === 0) return;
        
        // 直接设置 Canvas 尺寸（简化版，不使用 DPR 缩放）
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;
        
        // 更新配置
        this.config.width = containerWidth;
        this.config.height = containerHeight;
        
        // 更新战斗系统的地图尺寸
        if (this.systems.combat) {
            this.systems.combat.mapWidth = containerWidth;
            this.systems.combat.mapHeight = containerHeight;
        }
        
        console.log(`[GameCore] Canvas 调整为 ${containerWidth}x${containerHeight}`);
    }
    
    /**
     * 设置系统引用
     */
    setSystems(systems) {
        this.systems = systems;
    }
    
    /**
     * 生成云朵
     */
    generateClouds() {
        const clouds = [];
        for (let i = 0; i < 5; i++) {
            clouds.push({
                x: Math.random() * this.config.width,
                y: 30 + Math.random() * 60,
                size: 20 + Math.random() * 30,
                speed: 10 + Math.random() * 20
            });
        }
        return clouds;
    }
    
    /**
     * 启动游戏循环
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        console.log('[GameCore] 游戏启动');
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    /**
     * 停止游戏循环
     */
    stop() {
        this.isRunning = false;
        console.log('[GameCore] 游戏停止');
    }
    
    /**
     * 游戏主循环
     */
    gameLoop(currentTime) {
        if (!this.isRunning) return;
        
        // 计算 deltaTime
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // 帧率限制
        const targetFrameTime = 1000 / this.config.targetFps;
        if (this.deltaTime < targetFrameTime) {
            requestAnimationFrame((time) => this.gameLoop(time));
            return;
        }
        
        // 更新逻辑
        this.update(this.deltaTime);
        
        // 渲染画面
        this.render();
        
        // 继续循环
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    /**
     * 更新游戏逻辑
     */
    update(deltaTime) {
        // 更新各系统
        if (this.systems.player) {
            this.systems.player.update(deltaTime);
        }
        
        if (this.systems.combat) {
            this.systems.combat.update(deltaTime);
        }
        
        // 更新云朵
        this.updateClouds(deltaTime);
        
        // 自动保存
        this.autoSaveTimer += deltaTime;
        if (this.autoSaveTimer >= this.config.autoSaveInterval) {
            this.autoSaveTimer = 0;
            if (this.systems.save) {
                this.systems.save.saveGame(1);
            }
        }
    }
    
    /**
     * 更新云朵位置
     */
    updateClouds(deltaTime) {
        const dt = deltaTime / 1000;
        this.clouds.forEach(cloud => {
            cloud.x += cloud.speed * dt;
            if (cloud.x > this.config.width + cloud.size) {
                cloud.x = -cloud.size;
                cloud.y = 30 + Math.random() * 60;
            }
        });
    }
    
    /**
     * 渲染游戏画面
     */
    render() {
        const ctx = this.ctx;
        
        // 清空画布
        ctx.clearRect(0, 0, this.config.width, this.config.height);
        
        // 绘制背景
        this.renderBackground(ctx);
        
        // 绘制玩家
        if (this.systems.player) {
            this.systems.player.render(ctx);
            
            // 绘制宠物（围绕玩家）
            if (this.systems.pet) {
                const player = this.systems.player.player;
                this.systems.pet.render(ctx, player.x + player.width / 2, player.y + player.height / 2);
            }
        }
        
        // 绘制战斗元素
        if (this.systems.combat) {
            this.systems.combat.render(ctx);
        }
    }
    
    /**
     * 渲染背景
     */
    renderBackground(ctx) {
        const { width, height } = this.config;
        const time = Date.now() * 0.001;
        
        // 夜空渐变
        const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.65);
        skyGradient.addColorStop(0, '#0a0e17');
        skyGradient.addColorStop(0.4, '#1a2540');
        skyGradient.addColorStop(0.8, '#2a3f5f');
        skyGradient.addColorStop(1, '#3d5a80');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, width, height);
        
        // 星星
        this.drawStars(ctx, width, height, time);
        
        // 月亮
        this.drawMoon(ctx, width * 0.8, 50, 25);
        
        // 远山层1 (最远)
        ctx.fillStyle = '#1a2540';
        ctx.beginPath();
        ctx.moveTo(0, height * 0.45);
        ctx.bezierCurveTo(80, height * 0.35, 120, height * 0.4, 180, height * 0.38);
        ctx.bezierCurveTo(240, height * 0.35, 300, height * 0.3, 350, height * 0.35);
        ctx.lineTo(width, height * 0.4);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        
        // 远山层2 (中等)
        ctx.fillStyle = '#243352';
        ctx.beginPath();
        ctx.moveTo(0, height * 0.5);
        ctx.bezierCurveTo(50, height * 0.42, 100, height * 0.48, 150, height * 0.44);
        ctx.bezierCurveTo(200, height * 0.4, 280, height * 0.45, 320, height * 0.42);
        ctx.lineTo(width, height * 0.48);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        
        // 近山层 (最近)
        const hillGradient = ctx.createLinearGradient(0, height * 0.55, 0, height);
        hillGradient.addColorStop(0, '#2d4a3e');
        hillGradient.addColorStop(0.5, '#1a3d2e');
        hillGradient.addColorStop(1, '#0d2818');
        ctx.fillStyle = hillGradient;
        ctx.beginPath();
        ctx.moveTo(0, height * 0.58);
        ctx.bezierCurveTo(60, height * 0.52, 100, height * 0.56, 160, height * 0.54);
        ctx.bezierCurveTo(220, height * 0.52, 300, height * 0.58, 360, height * 0.55);
        ctx.lineTo(width, height * 0.6);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        
        // 草地
        const grassGradient = ctx.createLinearGradient(0, height * 0.7, 0, height);
        grassGradient.addColorStop(0, '#1a4d2e');
        grassGradient.addColorStop(0.5, '#0d3d1f');
        grassGradient.addColorStop(1, '#082810');
        ctx.fillStyle = grassGradient;
        ctx.fillRect(0, height * 0.7, width, height * 0.3);
        
        // 地面装饰线
        ctx.strokeStyle = 'rgba(77, 171, 247, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height * 0.7);
        ctx.lineTo(width, height * 0.7);
        ctx.stroke();
        
        // 云朵 (半透明)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        this.clouds.forEach(cloud => {
            this.drawCloud(ctx, cloud.x, cloud.y, cloud.size);
        });
    }
    
    /**
     * 绘制星星
     */
    drawStars(ctx, width, height, time) {
        // 使用固定的随机种子绘制星星
        const stars = [
            { x: 30, y: 40, size: 1.5 },
            { x: 80, y: 25, size: 2 },
            { x: 120, y: 60, size: 1 },
            { x: 170, y: 35, size: 1.8 },
            { x: 220, y: 50, size: 1.2 },
            { x: 260, y: 20, size: 2.2 },
            { x: 300, y: 45, size: 1.5 },
            { x: 340, y: 30, size: 1 },
            { x: 380, y: 55, size: 1.8 },
            { x: 50, y: 80, size: 1.2 },
            { x: 150, y: 90, size: 1.5 },
            { x: 280, y: 75, size: 1 },
            { x: 360, y: 85, size: 1.3 }
        ];
        
        stars.forEach((star, i) => {
            const twinkle = Math.sin(time * 2 + i) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 255, 255, ${twinkle})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    /**
     * 绘制月亮
     */
    drawMoon(ctx, x, y, radius) {
        // 月亮光晕
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
        glowGradient.addColorStop(0, 'rgba(255, 248, 220, 0.3)');
        glowGradient.addColorStop(0.5, 'rgba(255, 248, 220, 0.1)');
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 月亮本体
        const moonGradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
        moonGradient.addColorStop(0, '#fffef0');
        moonGradient.addColorStop(0.7, '#f5e6c8');
        moonGradient.addColorStop(1, '#e8d5a8');
        ctx.fillStyle = moonGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 月球表面纹理（简单的陨石坑）
        ctx.fillStyle = 'rgba(200, 180, 140, 0.3)';
        ctx.beginPath();
        ctx.arc(x - radius * 0.3, y + radius * 0.2, radius * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + radius * 0.2, y - radius * 0.3, radius * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
    
    /**
     * 绘制云朵
     */
    drawCloud(ctx, x, y, size) {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y - size * 0.15, size * 0.4, 0, Math.PI * 2);
        ctx.arc(x + size * 0.8, y, size * 0.45, 0, Math.PI * 2);
        ctx.arc(x + size * 0.5, y + size * 0.15, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }
    
    /**
     * 设置分辨率
     * @param {number|null} width - 宽度，null 表示自动
     * @param {number|null} height - 高度，null 表示自动
     */
    setResolution(width, height) {
        if (width === null || height === null) {
            // 自动模式：使用容器尺寸
            this.fixedResolution = null;
            this.resizeCanvas();
            console.log('[GameCore] 分辨率设置为自动模式');
        } else {
            // 固定分辨率模式
            this.fixedResolution = { width, height };
            
            const container = this.canvas.parentElement;
            if (!container) return;
            
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // 计算缩放比例，保持宽高比
            const scaleX = containerWidth / width;
            const scaleY = containerHeight / height;
            const scale = Math.min(scaleX, scaleY);
            
            // 设置 Canvas 的内部分辨率
            this.canvas.width = width;
            this.canvas.height = height;
            
            // 用 CSS 缩放 Canvas 以适应容器
            const displayWidth = width * scale;
            const displayHeight = height * scale;
            this.canvas.style.width = `${displayWidth}px`;
            this.canvas.style.height = `${displayHeight}px`;
            
            // 更新配置
            this.config.width = width;
            this.config.height = height;
            
            // 更新战斗系统的地图尺寸
            if (this.systems.combat) {
                this.systems.combat.mapWidth = width;
                this.systems.combat.mapHeight = height;
            }
            
            console.log(`[GameCore] 分辨率设置为 ${width}x${height}`);
        }
    }
    
    /**
     * 获取地图尺寸
     */
    getMapSize() {
        return {
            width: this.config.width,
            height: this.config.height
        };
    }
}

/**
 * 获取单例实例
 */
export function getGameCoreInstance(canvas) {
    if (!instance && canvas) {
        instance = new GameCore(canvas);
    }
    return instance;
}
