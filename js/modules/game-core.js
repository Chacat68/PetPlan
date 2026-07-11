/**
 * GameCore - 游戏核心
 * 负责游戏循环、场景渲染、帧率控制
 */

let instance = null;

export class GameCore {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });

    // 配置
    this.config = {
      baseWidth: 750,
      baseHeight: 1800,
      width: 750,
      height: 1800,
      targetFps: 60,
      autoSaveInterval: 30000,
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

    console.log("[GameCore] 初始化完成");
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

    // 清除之前可能设置的 CSS 样式（从固定分辨率模式切换回来时需要）
    this.canvas.style.width = "";
    this.canvas.style.height = "";

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

    console.log(
      `[GameCore] Canvas 调整为 ${containerWidth}x${containerHeight}`
    );
  }

  /**
   * 设置系统引用
   */
  setSystems(systems) {
    this.systems = systems;
    if (this.systems.combat) {
      this.systems.combat.mapWidth = this.config.width;
      this.systems.combat.mapHeight = this.config.height;
    }
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
        speed: 10 + Math.random() * 20,
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
    console.log("[GameCore] 游戏启动");

    requestAnimationFrame((time) => this.gameLoop(time));
  }

  /**
   * 停止游戏循环
   */
  stop() {
    this.isRunning = false;
    console.log("[GameCore] 游戏停止");
  }

  /**
   * 游戏主循环
   */
  gameLoop(currentTime) {
    if (!this.isRunning) return;

    // 帧率限制
    const targetFrameTime = 1000 / this.config.targetFps;
    const elapsed = currentTime - this.lastTime;
    if (elapsed < targetFrameTime) {
      requestAnimationFrame((time) => this.gameLoop(time));
      return;
    }

    // 计算 deltaTime
    this.deltaTime = Math.min(elapsed, 100);
    this.lastTime = currentTime;

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

    if (this.systems.fate) {
      this.systems.fate.update(deltaTime);
    }

    if (this.systems.combat && !this.systems.combat.isPaused) {
      this.systems.combat.update(deltaTime);
    }

    if (
      this.systems.pet &&
      this.systems.player &&
      this.systems.combat &&
      !this.systems.combat.isPaused
    ) {
      const player = this.systems.player.player;
      this.systems.pet.update(
        deltaTime,
        player.x + player.width / 2,
        player.y + player.height / 2
      );
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
    this.clouds.forEach((cloud) => {
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
    }

    // 绘制战斗元素
    if (this.systems.combat) {
      if (typeof this.systems.combat.renderWorld === "function") {
        this.systems.combat.renderWorld(ctx);
      } else {
        this.systems.combat.render(ctx);
      }
    }

    // 绘制宠物在战斗层上方，冲刺攻击时不被怪物遮住。
    if (this.systems.pet && this.systems.player) {
      const player = this.systems.player.player;
      this.systems.pet.render(
        ctx,
        player.x + player.width / 2,
        player.y + player.height / 2
      );
    }

    if (
      this.systems.combat &&
      typeof this.systems.combat.renderFloatingTexts === "function"
    ) {
      this.systems.combat.renderFloatingTexts(ctx);
    }
  }

  /**
   * 渲染背景
   */
  renderBackground(ctx) {
    const { width, height } = this.config;

    if (
      typeof this.systems.combat?.renderBattlefieldBackground === "function"
    ) {
      this.systems.combat.renderBattlefieldBackground(ctx);
      return;
    }

    ctx.fillStyle = "#24292f";
    ctx.fillRect(0, 0, width, height);

    const tileSize = Math.max(48, Math.floor(width / 12));
    ctx.fillStyle = "#2f3838";
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        if ((x / tileSize + y / tileSize) % 2 === 0) {
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }

    ctx.strokeStyle = "rgba(244, 165, 69, 0.2)";
    ctx.lineWidth = 2;
    for (let x = 0; x <= width; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const laneY = height * 0.64;
    const laneHeight = Math.max(92, height * 0.28);
    ctx.fillStyle = "rgba(97, 58, 42, 0.72)";
    ctx.fillRect(0, laneY, width, laneHeight);

    ctx.strokeStyle = "rgba(255, 209, 103, 0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, laneY);
    ctx.lineTo(width, laneY);
    ctx.moveTo(0, laneY + laneHeight);
    ctx.lineTo(width, laneY + laneHeight);
    ctx.stroke();

    const glow = ctx.createRadialGradient(
      width * 0.22,
      height * 0.55,
      0,
      width * 0.22,
      height * 0.55,
      width * 0.5
    );
    glow.addColorStop(0, "rgba(255, 209, 103, 0.16)");
    glow.addColorStop(1, "rgba(255, 209, 103, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
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
      { x: 360, y: 85, size: 1.3 },
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
    glowGradient.addColorStop(0, "rgba(255, 248, 220, 0.3)");
    glowGradient.addColorStop(0.5, "rgba(255, 248, 220, 0.1)");
    glowGradient.addColorStop(1, "transparent");
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 月亮本体
    const moonGradient = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3,
      0,
      x,
      y,
      radius
    );
    moonGradient.addColorStop(0, "#fffef0");
    moonGradient.addColorStop(0.7, "#f5e6c8");
    moonGradient.addColorStop(1, "#e8d5a8");
    ctx.fillStyle = moonGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // 月球表面纹理（简单的陨石坑）
    ctx.fillStyle = "rgba(200, 180, 140, 0.3)";
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
    // 等待 CSS 变量更新后再调整 Canvas
    requestAnimationFrame(() => {
      if (width === null || height === null) {
        // 自动模式：使用容器尺寸
        this.fixedResolution = null;
        this.canvas.style.width = "";
        this.canvas.style.height = "";
        this.resizeCanvas();
        console.log("[GameCore] 分辨率设置为自动模式");
      } else {
        // 固定分辨率模式
        this.fixedResolution = { width, height };

        // 设置 Canvas 的内部分辨率
        this.canvas.width = width;
        this.canvas.height = height;

        // 让 Canvas 填满容器（容器尺寸由 CSS 变量控制）
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";

        // 更新配置
        this.config.width = width;
        this.config.height = height;

        // 更新战斗系统的地图尺寸
        if (this.systems.combat) {
          this.systems.combat.mapWidth = width;
          this.systems.combat.mapHeight = height;
        }

        // 更新玩家位置以适应新分辨率
        if (this.systems.player) {
          const player = this.systems.player.player;
          // 玩家位置保持在合理范围内
          const minPlayerX = Math.min(Math.max(width * 0.13, 140), width * 0.24);
          const maxPlayerX = Math.max(minPlayerX, width * 0.3);
          player.x = Math.max(minPlayerX, Math.min(player.x, maxPlayerX));
          player.y = Math.max(height * 0.55, Math.min(player.y, height * 0.75 - player.height));
        }

        // 重新生成云朵以适应新尺寸
        this.clouds = this.generateClouds();

        console.log(`[GameCore] 分辨率设置为 ${width}x${height}`);
      }
    });
  }

  /**
   * 获取地图尺寸
   */
  getMapSize() {
    return {
      width: this.config.width,
      height: this.config.height,
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
