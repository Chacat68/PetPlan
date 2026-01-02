# 环境搭建指南

## 概述

Pet Plan 是一个纯前端项目，无需复杂的构建工具或服务器环境。只需要现代浏览器即可运行和开发。

## 系统要求

### 最低要求
- **操作系统**: Windows 7+, macOS 10.12+, Linux (Ubuntu 16.04+)
- **浏览器**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **内存**: 4GB RAM
- **存储**: 100MB 可用空间

### 推荐配置
- **操作系统**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **浏览器**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **内存**: 8GB RAM
- **存储**: 500MB 可用空间

## 开发环境搭建

### 1. 克隆项目

```bash
# 使用 Git 克隆项目
git clone <repository-url>
cd Pet_Plan

# 或者下载 ZIP 文件并解压
```

### 2. 项目结构

```
Pet_Plan/
├── index.html              # 主页面文件
├── js/
│   ├── game.js            # 游戏核心逻辑
│   └── modules/           # 模块目录 (待扩展)
├── css/
│   ├── style.css          # 主样式文件
│   ├── menu.css           # 菜单样式
│   └── character-management.css  # 角色管理样式
├── images/                # 图片资源
│   ├── cw/               # 角色图片
│   └── rw/               # 其他图片
└── doc/                  # 文档目录
```

### 3. 本地开发服务器

#### 方法一：使用 Python (推荐)

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

访问: `http://localhost:8000`

#### 方法二：使用 Node.js

```bash
# 安装 http-server
npm install -g http-server

# 启动服务器
http-server -p 8000
```

访问: `http://localhost:8000`

#### 方法三：使用 PHP

```bash
# 启动 PHP 内置服务器
php -S localhost:8000
```

访问: `http://localhost:8000`

#### 方法四：使用 Live Server (VS Code 扩展)

1. 安装 VS Code
2. 安装 Live Server 扩展
3. 右键点击 `index.html`
4. 选择 "Open with Live Server"

### 4. 直接打开文件

**注意**: 直接打开 HTML 文件可能会遇到 CORS 问题，建议使用本地服务器。

```bash
# 直接打开文件
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

## 开发工具推荐

### 代码编辑器

#### Visual Studio Code (推荐)
- **下载**: https://code.visualstudio.com/
- **推荐扩展**:
  - Live Server
  - Prettier - Code formatter
  - ESLint
  - Auto Rename Tag
  - Bracket Pair Colorizer
  - GitLens

#### WebStorm
- **下载**: https://www.jetbrains.com/webstorm/
- **特点**: 强大的 JavaScript 开发环境

#### Sublime Text
- **下载**: https://www.sublimetext.com/
- **推荐插件**:
  - Package Control
  - Emmet
  - JavaScript Completions

### 浏览器开发工具

#### Chrome DevTools
- **快捷键**: F12 或 Ctrl+Shift+I
- **功能**:
  - 元素检查
  - 控制台调试
  - 性能分析
  - 网络监控

#### Firefox Developer Tools
- **快捷键**: F12 或 Ctrl+Shift+I
- **功能**:
  - 响应式设计模式
  - 性能分析
  - 网络监控

### 调试工具

#### 控制台调试
```javascript
// 在浏览器控制台中调试
console.log('调试信息');
console.error('错误信息');
console.warn('警告信息');

// 检查游戏实例
console.log(window.gameInstance);

// 检查玩家数据
console.log(window.gameInstance.player);
```

#### 断点调试
```javascript
// 在代码中添加断点
debugger;

// 或者使用浏览器开发工具设置断点
```

## 开发流程

### 1. 代码修改

```bash
# 1. 修改代码文件
# 2. 保存文件
# 3. 刷新浏览器查看效果
```

### 2. 调试流程

```bash
# 1. 打开浏览器开发工具
# 2. 查看控制台错误
# 3. 设置断点调试
# 4. 修复问题
# 5. 测试功能
```

### 3. 测试流程

```bash
# 1. 功能测试
# 2. 性能测试
# 3. 兼容性测试
# 4. 用户体验测试
```

## 常见问题解决

### 1. CORS 错误

**问题**: 直接打开 HTML 文件时出现 CORS 错误

**解决方案**: 使用本地服务器
```bash
# 使用 Python 启动服务器
python -m http.server 8000
```

### 2. 图片加载失败

**问题**: 图片无法加载

**解决方案**: 检查图片路径
```javascript
// 检查图片路径
console.log(game.playerImage.src);

// 确保图片文件存在
// 检查 images/ 目录下的文件
```

### 3. 游戏无法启动

**问题**: 游戏启动失败

**解决方案**: 检查控制台错误
```javascript
// 检查游戏实例
if (window.gameInstance) {
    console.log('游戏已启动');
} else {
    console.error('游戏启动失败');
}
```

### 4. 性能问题

**问题**: 游戏运行缓慢

**解决方案**: 性能优化
```javascript
// 监控帧率
let frameCount = 0;
let lastTime = 0;

function checkFPS(currentTime) {
    frameCount++;
    if (currentTime - lastTime >= 1000) {
        console.log('FPS:', frameCount);
        frameCount = 0;
        lastTime = currentTime;
    }
}
```

## 部署指南

### 1. 静态文件部署

#### GitHub Pages
```bash
# 1. 将代码推送到 GitHub
git add .
git commit -m "Initial commit"
git push origin main

# 2. 在 GitHub 仓库设置中启用 Pages
# 3. 选择源分支
# 4. 访问 https://username.github.io/repository-name
```

#### Netlify
```bash
# 1. 连接 GitHub 仓库
# 2. 设置构建命令: 无
# 3. 设置发布目录: /
# 4. 部署完成
```

#### Vercel
```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 部署项目
vercel

# 3. 按照提示完成部署
```

### 2. 服务器部署

#### Apache
```apache
# .htaccess 文件
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.html [QSA,L]
```

#### Nginx
```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/Pet_Plan;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 版本控制

### Git 配置

```bash
# 初始化 Git 仓库
git init

# 添加远程仓库
git remote add origin <repository-url>

# 创建 .gitignore 文件
echo "node_modules/" >> .gitignore
echo "*.log" >> .gitignore
echo ".DS_Store" >> .gitignore
```

### 提交规范

```bash
# 提交格式
git commit -m "feat: 添加新功能"
git commit -m "fix: 修复bug"
git commit -m "docs: 更新文档"
git commit -m "style: 代码格式调整"
git commit -m "refactor: 代码重构"
git commit -m "test: 添加测试"
```

## 性能优化

### 1. 代码优化

```javascript
// 使用对象池
class ObjectPool {
    constructor(createFn, resetFn) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
    }
    
    get() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return this.createFn();
    }
    
    release(obj) {
        this.resetFn(obj);
        this.pool.push(obj);
    }
}
```

### 2. 资源优化

```javascript
// 图片预加载
function preloadImages(urls) {
    const promises = urls.map(url => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
        });
    });
    
    return Promise.all(promises);
}
```

### 3. 内存管理

```javascript
// 及时清理对象
function cleanup() {
    // 清理过期的游戏对象
    game.monsters = game.monsters.filter(monster => monster.hp > 0);
    game.bullets = game.bullets.filter(bullet => bullet.life > 0);
    game.explosions = game.explosions.filter(explosion => explosion.life > 0);
}
```

## 最佳实践

### 1. 代码组织

```javascript
// 使用模块化结构
// 将相关功能组织在一起
// 使用清晰的命名约定
// 添加适当的注释
```

### 2. 错误处理

```javascript
// 添加错误处理
try {
    // 游戏逻辑
} catch (error) {
    console.error('游戏错误:', error);
    // 错误恢复逻辑
}
```

### 3. 性能监控

```javascript
// 监控性能
function monitorPerformance() {
    if (performance.memory) {
        console.log('内存使用:', performance.memory.usedJSHeapSize);
    }
}
```

### 4. 用户体验

```javascript
// 提供用户反馈
function showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}
```
