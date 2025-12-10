/**
 * @file UI系统模块
 * @description 处理全局UI交互，如Toast提示等
 */

class UISystem {
    constructor() {
        this.toastContainer = null;
        this.initialized = false;
    }

    static getInstance() {
        if (!UISystem.instance) {
            UISystem.instance = new UISystem();
        }
        return UISystem.instance;
    }

    /**
     * 初始化UI系统
     */
    initUI() {
        if (this.initialized) return;

        // 创建Toast容器
        if (!document.querySelector('.toast-container')) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.className = 'toast-container';
            document.body.appendChild(this.toastContainer);
        } else {
            this.toastContainer = document.querySelector('.toast-container');
        }

        this.initialized = true;
    }

    /**
     * 初始化方法（兼容游戏核心调用）
     */
    init() {
        this.initUI();
    }

    /**
     * 更新UI状态
     * @param {number} deltaTime - 时间增量
     */
    update(deltaTime) {
        // 目前不需要每帧更新，保留此方法以满足GameCore调用要求
    }

    /**
     * 显示Toast提示
     * @param {string} message - 提示内容
     * @param {number} duration - 显示时长（毫秒），默认2000ms
     */
    showToast(message, duration = 2000) {
        if (!this.initialized || !this.toastContainer) {
            this.init();
        }

        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;

        this.toastContainer.appendChild(toast);

        // 动画结束后移除元素
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
    }

    /**
     * 显示确认对话框
     * @param {string} message - 确认信息
     * @param {Function} onConfirm - 确认回调
     * @param {Function} onCancel - 取消回调
     */
    showConfirm(message, onConfirm, onCancel) {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';

        overlay.innerHTML = `
            <div class="confirm-modal">
                <div class="confirm-message">${message}</div>
                <div class="confirm-actions">
                    <button class="confirm-btn cancel">取消</button>
                    <button class="confirm-btn confirm">确定</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const confirmBtn = overlay.querySelector('.confirm-btn.confirm');
        const cancelBtn = overlay.querySelector('.confirm-btn.cancel');

        const close = () => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        };

        confirmBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            close();
        });

        cancelBtn.addEventListener('click', () => {
            if (onCancel) onCancel();
            close();
        });

        // 点击遮罩层关闭（可选）
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (onCancel) onCancel();
                close();
            }
        });
    }
    /**
     * 显示离线收益弹窗
     * @param {Object} earnings - 收益数据 {time, gold, crystal}
     */
    showOfflineResult(earnings) {
        // 格式化时间
        const hours = Math.floor(earnings.time / 3600);
        const minutes = Math.floor((earnings.time % 3600) / 60);
        const seconds = earnings.time % 60;

        let timeStr = '';
        if (hours > 0) timeStr += `${hours}小时 `;
        if (minutes > 0) timeStr += `${minutes}分钟 `;
        if (seconds > 0 || timeStr === '') timeStr += `${seconds}秒`;

        const overlay = document.createElement('div');
        overlay.className = 'offline-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            animation: fadeIn 0.3s ease;
        `;

        overlay.innerHTML = `
            <div class="offline-modal" style="
                background: #2c3e50;
                border: 2px solid #f1c40f;
                border-radius: 10px;
                padding: 20px;
                width: 80%;
                max-width: 400px;
                color: white;
                text-align: center;
                box-shadow: 0 0 20px rgba(241, 196, 15, 0.3);
                position: relative;
            ">
                <h2 style="color: #f1c40f; margin-top: 0;">欢迎回来!</h2>
                <p style="color: #bdc3c7;">您离线了 <span style="color: white; font-weight: bold;">${timeStr}</span></p>
                
                <div class="offline-rewards" style="
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 8px;
                    padding: 15px;
                    margin: 15px 0;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                ">
                    <div class="reward-item" style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <span style="font-size: 1.2em;">💰</span>
                        <span style="color: #f1c40f; font-weight: bold;">+${earnings.gold}</span>
                    </div>
                    <div class="reward-item" style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <span style="font-size: 1.2em;">💎</span>
                        <span style="color: #3498db; font-weight: bold;">+${earnings.crystal}</span>
                    </div>
                </div>
                
                <button class="claim-btn" style="
                    background: linear-gradient(to bottom, #f1c40f, #f39c12);
                    border: none;
                    color: #fff;
                    padding: 10px 30px;
                    font-size: 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: transform 0.1s;
                    width: 100%;
                ">领取收益</button>
            </div>
        `;

        document.body.appendChild(overlay);

        const claimBtn = overlay.querySelector('.claim-btn');
        claimBtn.addEventListener('click', () => {
            // 点击动画
            claimBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 300);
            }, 100);
        });
    }
}

// 导出便捷函数（延迟获取实例）
export function showToast(message, duration) {
    const uiSystem = UISystem.getInstance();
    uiSystem.showToast(message, duration);
}

export function showConfirm(message, onConfirm, onCancel) {
    const uiSystem = UISystem.getInstance();
    uiSystem.showConfirm(message, onConfirm, onCancel);
}

export default UISystem;
