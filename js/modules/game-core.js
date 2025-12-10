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

        // 初始化草丛装饰
        for (let i = 0; i < 40; i++) {
            this.grassDecorations.push({
                x: Math.random() * this.mapWidth,
                y: this.mapHeight - 50 + Math.random() * 40,
                height: 5 + Math.random() * 10,
                color: Math.random() > 0.5 ? '#228b22' : '#006400'
            });
        }

        // 初始化远景山脉
        this.mountains = [];
        // 远山
        let x = 0;
        while (x < this.mapWidth) {
            const width = 100 + Math.random() * 150;
            const height = 80 + Math.random() * 100;
            this.mountains.push({
                x: x,
                y: this.mapHeight - 50,
                width: width,
                height: height,
                color: '#5F9EA0' // CadetBlue
            });
            x += width * 0.6;
        }
    }

    /**
     * 设置子系统引用
     */
    setSystems(playerSystem, combatSystem, uiSystem, resourceSystem, territorySystem, saveSystem, petSystem, equipmentSystem) {
        this.playerSystem = playerSystem;
        this.combatSystem = combatSystem;
        this.uiSystem = uiSystem;
        this.resourceSystem = resourceSystem;
        this.territorySystem = territorySystem;
        this.saveSystem = saveSystem;
        this.petSystem = petSystem;
        this.equipmentSystem = equipmentSystem;

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
            this.uiSystem.update();
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
     * 绘制天空
     */
    drawSky() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.mapHeight);
        gradient.addColorStop(0, '#87CEEB'); // 天蓝色
        gradient.addColorStop(1, '#E0F7FA'); // 浅青色
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.mapWidth, this.mapHeight);
    }

    /**
     * 绘制山脉
     */
    drawMountains() {
        this.ctx.save();
        this.mountains.forEach(mountain => {
            this.ctx.fillStyle = mountain.color;
            this.ctx.beginPath();
            this.ctx.moveTo(mountain.x, mountain.y);
            this.ctx.lineTo(mountain.x + mountain.width / 2, mountain.y - mountain.height);
            this.ctx.lineTo(mountain.x + mountain.width, mountain.y);
            this.ctx.closePath();
            this.ctx.fill();

            // 山顶积雪
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.beginPath();
            this.ctx.moveTo(mountain.x + mountain.width * 0.35, mountain.y - mountain.height * 0.7);
            this.ctx.lineTo(mountain.x + mountain.width / 2, mountain.y - mountain.height);
            this.ctx.lineTo(mountain.x + mountain.width * 0.65, mountain.y - mountain.height * 0.7);
            // 锯齿状雪线
            this.ctx.lineTo(mountain.x + mountain.width * 0.6, mountain.y - mountain.height * 0.6);
            this.ctx.lineTo(mountain.x + mountain.width * 0.5, mountain.y - mountain.height * 0.75);
            this.ctx.lineTo(mountain.x + mountain.width * 0.4, mountain.y - mountain.height * 0.6);
            this.ctx.closePath();
            this.ctx.fill();
        });
        this.ctx.restore();
    }

    /**
     * 绘制地面
     */
    drawGround() {
        const groundY = this.mapHeight - 50;

        // 地面渐变
        const gradient = this.ctx.createLinearGradient(0, groundY, 0, this.mapHeight);
        gradient.addColorStop(0, '#90EE90'); // 浅绿
        gradient.addColorStop(1, '#228B22'); // 森林绿

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, groundY, this.mapWidth, 50);

        // 地面边缘线
        this.ctx.strokeStyle = '#2E8B57';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, groundY);
        this.ctx.lineTo(this.mapWidth, groundY);
        this.ctx.stroke();
    }

    /**
     * 绘制草地纹理
     */
    drawGrassTexture() {
        // 绘制草地装饰
        this.grassDecorations.forEach(grass => {
            this.ctx.fillStyle = grass.color;
            this.ctx.beginPath();
            this.ctx.moveTo(grass.x, grass.y);
            this.ctx.lineTo(grass.x - 3, grass.y - grass.height);
            this.ctx.lineTo(grass.x + 3, grass.y - grass.height);
            this.ctx.closePath();
            this.ctx.fill();
        });
    }

    /**
     * 绘制云朵
     */
    drawClouds() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.globalAlpha = 0.8;

        this.clouds.forEach(cloud => {
            this.ctx.save();
            this.ctx.translate(cloud.x, cloud.y);
            this.ctx.scale(cloud.size, cloud.size);

            this.ctx.beginPath();
            this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
            this.ctx.arc(25, 0, 25, 0, Math.PI * 2);
            this.ctx.arc(50, 0, 20, 0, Math.PI * 2);
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
