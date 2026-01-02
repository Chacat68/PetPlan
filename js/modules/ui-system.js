/**
 * UISystem - 用户界面系统
 * 管理 Toast、对话框、弹窗等 UI 元素
 */

let instance = null;

export class UISystem {
    constructor() {
        // 获取容器
        this.toastContainer = document.getElementById('toast-container');
        this.modalContainer = document.getElementById('modal-container');
        
        console.log('[UISystem] 初始化完成');
    }
    
    /**
     * 显示 Toast 提示
     */
    showToast(message, type = 'info', duration = 2000) {
        if (!this.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        // 自动移除
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    /**
     * 显示确认对话框
     */
    showConfirm(title, message, onConfirm, onCancel) {
        if (!this.modalContainer) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal confirm-modal';
        modal.innerHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
            </div>
            <div class="modal-body">
                <p>${message}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-cancel">取消</button>
                <button class="btn btn-confirm">确定</button>
            </div>
        `;
        
        // 绑定按钮事件
        modal.querySelector('.btn-cancel').addEventListener('click', () => {
            this.hideModal();
            if (onCancel) onCancel();
        });
        
        modal.querySelector('.btn-confirm').addEventListener('click', () => {
            this.hideModal();
            if (onConfirm) onConfirm();
        });
        
        this.showModal(modal);
    }
    
    /**
     * 显示提示框
     */
    showAlert(title, message, onClose) {
        if (!this.modalContainer) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal alert-modal';
        modal.innerHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>${message}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-confirm">确定</button>
            </div>
        `;
        
        // 绑定关闭事件
        const closeModal = () => {
            this.hideModal();
            if (onClose) onClose();
        };
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.btn-confirm').addEventListener('click', closeModal);
        
        this.showModal(modal);
    }
    
    /**
     * 显示弹窗
     */
    showModal(content) {
        if (!this.modalContainer) return;
        
        this.modalContainer.innerHTML = '';
        
        if (typeof content === 'string') {
            this.modalContainer.innerHTML = content;
        } else {
            this.modalContainer.appendChild(content);
        }
        
        this.modalContainer.classList.add('active');
        
        // 点击背景关闭
        this.modalContainer.addEventListener('click', (e) => {
            if (e.target === this.modalContainer) {
                this.hideModal();
            }
        });
    }
    
    /**
     * 隐藏弹窗
     */
    hideModal() {
        if (!this.modalContainer) return;
        this.modalContainer.classList.remove('active');
        this.modalContainer.innerHTML = '';
    }
    
    /**
     * 更新
     */
    update() {
        // UI 更新逻辑（如果需要）
    }
}

/**
 * 获取单例实例
 */
export function getUISystemInstance() {
    if (!instance) {
        instance = new UISystem();
    }
    return instance;
}
