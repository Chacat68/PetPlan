# 用户界面系统API

## 概述

用户界面系统API提供了管理游戏用户界面的所有功能，包括界面更新、弹窗管理、事件绑定、状态显示等核心功能。

## 界面更新API

### updateUI()

```javascript
updateUI()
```

**功能**: 更新所有UI显示

**返回值**: void

**示例**:
```javascript
// 更新UI显示
game.updateUI();
```

**更新内容**:
- 资源显示
- 升级按钮状态
- 升级项目显示
- 总战力显示
- 弹窗界面

### updateCurrencyDisplay()

```javascript
updateCurrencyDisplay()
```

**功能**: 更新货币显示

**返回值**: void

**示例**:
```javascript
// 更新货币显示
game.updateCurrencyDisplay();
```

**更新内容**:
- 主界面金币显示
- 主界面红宝石显示
- 角色管理界面货币显示

### updateCharacterManagementCurrency()

```javascript
updateCharacterManagementCurrency()
```

**功能**: 更新角色管理界面的货币显示

**返回值**: void

**示例**:
```javascript
// 更新角色管理界面货币
game.updateCharacterManagementCurrency();
```

## 弹窗管理API

### 角色管理界面

#### 显示角色管理界面

```javascript
// 显示角色管理界面
const characterManagementModal = document.getElementById('characterManagementModal');
characterManagementModal.style.display = 'block';
characterManagementModal.classList.add('show');

// 隐藏角色按钮，显示×按钮
document.getElementById('characterNavItem').style.display = 'none';
document.getElementById('closeNavItem').style.display = 'flex';
```

#### 隐藏角色管理界面

```javascript
// 隐藏角色管理界面
const characterManagementModal = document.getElementById('characterManagementModal');
characterManagementModal.style.display = 'none';
characterManagementModal.classList.remove('show');

// 显示角色按钮，隐藏×按钮
document.getElementById('characterNavItem').style.display = 'flex';
document.getElementById('closeNavItem').style.display = 'none';
```

#### 更新角色管理界面UI

```javascript
updateModalUI()
```

**功能**: 更新弹窗界面中的玩家信息

**返回值**: void

**示例**:
```javascript
// 更新弹窗UI
game.updateModalUI();
```

### 菜单弹窗

#### 显示菜单弹窗

```javascript
// 显示菜单弹窗
const characterModal = document.getElementById('characterModal');
characterModal.style.display = 'block';
```

#### 隐藏菜单弹窗

```javascript
// 隐藏菜单弹窗
const characterModal = document.getElementById('characterModal');
characterModal.style.display = 'none';
```

## 导航栏API

### 底部导航栏

#### 获取导航项

```javascript
// 获取所有底部导航项
const bottomNavItems = document.querySelectorAll('.bottom-navigation .nav-item');
```

#### 导航项点击事件

```javascript
// 绑定导航项点击事件
bottomNavItems.forEach((item, index) => {
    item.addEventListener('click', () => {
        // 移除所有active类
        bottomNavItems.forEach(navItem => navItem.classList.remove('active'));
        
        // 如果点击的是第一个导航项（角色），显示角色管理界面
        if (index === 0) {
            characterManagementModal.style.display = 'block';
            characterManagementModal.classList.add('show');
            // 隐藏角色按钮，显示×按钮
            document.getElementById('characterNavItem').style.display = 'none';
            document.getElementById('closeNavItem').style.display = 'flex';
        } else {
            // 其他导航项正常添加active类
            item.classList.add('active');
        }
    });
});
```

#### 关闭按钮事件

```javascript
// 为×按钮添加点击事件
const closeNavItem = document.getElementById('closeNavItem');
if (closeNavItem) {
    closeNavItem.addEventListener('click', () => {
        characterManagementModal.style.display = 'none';
        characterManagementModal.classList.remove('show');
        // 显示角色按钮，隐藏×按钮
        document.getElementById('characterNavItem').style.display = 'flex';
        document.getElementById('closeNavItem').style.display = 'none';
        // 移除所有导航项的active状态
        bottomNavItems.forEach(navItem => navItem.classList.remove('active'));
    });
}
```

### 角色导航栏

#### 获取角色导航项

```javascript
// 获取角色导航项
const characterNavItems = document.querySelectorAll('.character-nav-bar .nav-item');
```

#### 角色导航项点击事件

```javascript
// 角色导航栏交互
characterNavItems.forEach((item, index) => {
    item.addEventListener('click', () => {
        // 移除所有active类
        characterNavItems.forEach(navItem => navItem.classList.remove('active'));
        // 添加active类到当前点击的导航项
        item.classList.add('active');
        
        // 获取标签页类型
        const tabType = item.dataset.tab;
        console.log(`切换到标签页: ${tabType}`);
        
        // 根据不同的标签页显示不同的内容
        switch(tabType) {
            case 'character':
                console.log('显示角色信息');
                break;
            case 'skills':
                console.log('显示技能信息');
                break;
            case 'pets':
                console.log('显示宠物信息');
                break;
            case 'collectibles':
                console.log('显示藏品信息');
                break;
            case 'contracts':
                console.log('显示契约信息');
                break;
        }
        
        // 添加点击动画
        item.style.animation = 'pulse 0.3s ease';
        setTimeout(() => {
            item.style.animation = '';
        }, 300);
    });
});
```

## 状态图标API

### 状态图标点击事件

```javascript
// 绑定状态图标事件
const statusIcons = document.querySelectorAll('.status-icon');
statusIcons.forEach(icon => {
    icon.addEventListener('click', (e) => {
        game.showStatusTooltip(e.target, icon.title);
    });
});
```

### 状态图标列表

```javascript
// 获取状态图标
const statusIcons = document.querySelectorAll('.status-icon');

// 状态图标包括：
// - 商城 (🛒)
// - 活动 (📅)
// - 时间 (⏰)
// - 日常 (📊)
```

## 头像点击API

### 顶部头像点击

```javascript
// 点击顶部状态栏中的头像显示角色管理界面
const topAvatar = document.querySelector('.game-top-status .player-avatar');
if (topAvatar) {
    let clickTimeout = null;
    topAvatar.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 防抖处理，避免重复点击
        if (clickTimeout) {
            clearTimeout(clickTimeout);
        }
        
        clickTimeout = setTimeout(() => {
            characterManagementModal.style.display = 'block';
            characterManagementModal.classList.add('show');
            // 隐藏角色按钮，显示×按钮
            document.getElementById('characterNavItem').style.display = 'none';
            document.getElementById('closeNavItem').style.display = 'flex';
            
            // 更新角色管理界面的货币显示
            const game = window.gameInstance;
            if (game) {
                game.updateCharacterManagementCurrency();
            }
        }, 100);
    });
    
    // 添加触摸事件支持
    topAvatar.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (clickTimeout) {
            clearTimeout(clickTimeout);
        }
        
        clickTimeout = setTimeout(() => {
            characterModal.style.display = 'block';
            const game = window.gameInstance;
            if (game) {
                game.updateModalUI();
            }
        }, 100);
    });
}
```

## 按钮交互API

### 角色管理界面按钮

#### 获取按钮元素

```javascript
// 获取角色管理界面按钮
const formationBtns = document.querySelectorAll('.formation-btn');
const actionBtns = document.querySelectorAll('.action-btn');
```

#### 按钮点击事件

```javascript
// 角色管理界面按钮交互
formationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const btnText = btn.textContent.trim();
        console.log(`点击了${btnText}按钮`);
        
        // 添加点击效果
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 150);
    });
});

actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const btnText = btn.textContent.trim();
        console.log(`点击了${btnText}按钮`);
        
        // 添加点击效果
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 150);
    });
});
```

## 触摸反馈API

### addTouchFeedback()

```javascript
addTouchFeedback()
```

**功能**: 为所有按钮添加触摸反馈

**返回值**: void

**示例**:
```javascript
// 添加触摸反馈
game.addTouchFeedback();
```

**实现**:
```javascript
addTouchFeedback() {
    // 为所有按钮添加触摸反馈
    const buttons = document.querySelectorAll('button, .status-icon, .nav-item, .player-avatar');
    buttons.forEach(button => {
        button.addEventListener('touchstart', (e) => {
            button.style.transform = 'scale(0.95)';
        });
        
        button.addEventListener('touchend', (e) => {
            setTimeout(() => {
                button.style.transform = '';
            }, 150);
        });
    });
}
```

## 工具提示API

### showStatusTooltip(element, message)

```javascript
showStatusTooltip(element, message)
```

**功能**: 显示状态图标的工具提示

**参数**:
- `element` (HTMLElement): 触发元素
- `message` (string): 提示信息

**返回值**: void

**示例**:
```javascript
// 显示工具提示
const icon = document.querySelector('.status-icon');
game.showStatusTooltip(icon, '商城');
```

**特性**:
- 自动定位
- 淡入淡出动画
- 3秒自动消失
- 响应式设计

## 升级菜单API

### 升级子菜单

#### 显示升级菜单

```javascript
// 显示升级子菜单
const menu = document.getElementById('upgradeMenu');
if (menu) {
    // 计算菜单位置
    const rect = button.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 5}px`;
    
    // 显示菜单
    menu.style.display = 'block';
    menu.dataset.currentAttribute = attribute;
}
```

#### 隐藏升级菜单

```javascript
// 隐藏升级子菜单
const menu = document.getElementById('upgradeMenu');
if (menu) {
    menu.style.display = 'none';
    delete menu.dataset.currentAttribute;
}
```

#### 升级菜单按钮

```javascript
// 获取升级菜单按钮
const menuButtons = document.querySelectorAll('.upgrade-menu-btn');

// 绑定菜单按钮事件
menuButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const times = parseInt(btn.dataset.times);
        const menu = document.getElementById('upgradeMenu');
        const attribute = menu.dataset.currentAttribute;
        
        if (attribute && times) {
            if (times === 1) {
                game.upgradeAttribute(attribute);
            } else {
                game.bulkUpgradeAttribute(attribute, times);
            }
        }
        
        game.hideUpgradeMenu();
    });
});
```

## 键盘事件API

### ESC键隐藏弹窗

```javascript
// ESC键隐藏弹窗界面
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && characterModal.style.display === 'block') {
        characterModal.style.display = 'none';
    }
});
```

### 备用启动方式

```javascript
// 备用启动方式：如果加载屏幕卡住了，按任意键启动游戏
document.addEventListener('keydown', (e) => {
    if (!window.gameInstance && loadingScreen && loadingScreen.style.display !== 'none') {
        console.log('检测到加载屏幕卡住，尝试重新启动游戏...');
        try {
            const game = new Game();
            window.gameInstance = game;
            loadingScreen.style.display = 'none';
        } catch (error) {
            console.error('备用启动也失败了:', error);
        }
    }
});
```

## 加载屏幕API

### 加载屏幕控制

```javascript
// 获取加载屏幕元素
const loadingScreen = document.getElementById('loadingScreen');

// 隐藏加载屏幕
if (loadingScreen) {
    loadingScreen.style.animation = 'loadingFadeOut 0.5s ease forwards';
}

// 点击加载屏幕启动游戏
if (loadingScreen) {
    loadingScreen.addEventListener('click', () => {
        if (!window.gameInstance) {
            console.log('点击加载屏幕，尝试启动游戏...');
            try {
                const game = new Game();
                window.gameInstance = game;
                loadingScreen.style.display = 'none';
            } catch (error) {
                console.error('点击启动失败:', error);
            }
        }
    });
}
```

## 动画效果API

### 点击动画

```javascript
// 添加点击动画
item.style.animation = 'bounce 0.6s ease';
setTimeout(() => {
    item.style.animation = '';
}, 600);
```

### 脉冲动画

```javascript
// 添加脉冲动画
item.style.animation = 'pulse 0.3s ease';
setTimeout(() => {
    item.style.animation = '';
}, 300);
```

### 震动动画

```javascript
// 添加震动动画
button.style.animation = 'shake 0.5s ease';
setTimeout(() => {
    button.style.animation = '';
}, 500);
```

## 响应式设计API

### 移动端适配

```javascript
// 检查是否为移动设备
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 移动端特殊处理
if (isMobile()) {
    // 调整UI布局
    document.body.classList.add('mobile');
    
    // 调整触摸事件
    document.addEventListener('touchstart', function(e) {
        e.preventDefault();
    }, { passive: false });
}
```

### 屏幕尺寸适配

```javascript
// 监听屏幕尺寸变化
window.addEventListener('resize', () => {
    // 重新计算布局
    updateLayout();
});

function updateLayout() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // 根据屏幕尺寸调整UI
    if (width < 768) {
        // 移动端布局
        document.body.classList.add('mobile-layout');
    } else {
        // 桌面端布局
        document.body.classList.remove('mobile-layout');
    }
}
```

## 最佳实践

### 1. 事件绑定

```javascript
// 正确的事件绑定
function bindUIEvents() {
    // 使用事件委托
    document.addEventListener('click', (e) => {
        if (e.target.matches('.nav-item')) {
            handleNavClick(e.target);
        }
    });
    
    // 防抖处理
    let clickTimeout = null;
    element.addEventListener('click', (e) => {
        if (clickTimeout) {
            clearTimeout(clickTimeout);
        }
        clickTimeout = setTimeout(() => {
            handleClick(e);
        }, 100);
    });
}
```

### 2. 状态管理

```javascript
// 用户界面状态管理
class UIState {
    constructor() {
        this.modals = {
            character: false,
            characterManagement: false
        };
    }
    
    showModal(modalType) {
        this.modals[modalType] = true;
        this.updateUI();
    }
    
    hideModal(modalType) {
        this.modals[modalType] = false;
        this.updateUI();
    }
    
    updateUI() {
        // 根据状态更新UI
        Object.keys(this.modals).forEach(modal => {
            const element = document.getElementById(`${modal}Modal`);
            if (element) {
                element.style.display = this.modals[modal] ? 'block' : 'none';
            }
        });
    }
}
```

### 3. 性能优化

```javascript
// 批量更新UI
function batchUpdateUI() {
    // 使用DocumentFragment减少重排
    const fragment = document.createDocumentFragment();
    
    // 批量添加元素
    elements.forEach(element => {
        fragment.appendChild(element);
    });
    
    // 一次性添加到DOM
    container.appendChild(fragment);
}

// 使用requestAnimationFrame优化动画
function animateElement(element) {
    function animate() {
        // 动画逻辑
        requestAnimationFrame(animate);
    }
    animate();
}
```

### 4. 错误处理

```javascript
// UI错误处理
function safeUIUpdate(updateFunction) {
    try {
        updateFunction();
    } catch (error) {
        console.error('UI更新失败:', error);
        // 显示错误信息
        showErrorMessage('界面更新失败，请刷新页面');
    }
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}
```
