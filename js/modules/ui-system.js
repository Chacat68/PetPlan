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
