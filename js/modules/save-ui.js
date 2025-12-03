import { showToast, showConfirm } from './ui-system.js';

/**
 * 存档UI模块
 * 负责存档系统的用户界面
 */

class SaveUI {
    constructor(saveSystem) {
        this.saveSystem = saveSystem;
        this.modal = null;
        this.selectedFile = null;
        this.init();
    }

    /**
     * 初始化UI
     */
    init() {
        // this.createSaveButton(); // 移除旧按钮创建
        this.createSaveModal();
        this.bindEvents();
        console.log('存档UI初始化完成');
    }

    /**
     * 创建存档模态框
     */
    createSaveModal() {
        const modal = document.createElement('div');
        modal.className = 'save-modal';
        modal.id = 'saveModal';

        modal.innerHTML = `
            <div class="save-modal-content">
                <div class="save-modal-header">
                    <h2 class="save-modal-title">存档管理</h2>
                    <button class="save-modal-close" id="closeSaveModal">×</button>
                </div>
                
                <div class="save-slots" id="saveSlots">
                    <!-- 存档槽位将动态生成 -->
                </div>
                
                <div class="import-section">
                    <h3 class="import-title">导入存档</h3>
                    <div class="import-controls">
                        <input type="file" id="importFileInput" class="import-file-input" accept=".json">
                        <label for="importFileInput" class="import-file-label">选择文件</label>
                        <span class="import-file-name" id="importFileName">未选择文件</span>
                        <select id="importSlotSelect" class="import-slot-select">
                            <option value="1">槽位 1</option>
                            <option value="2">槽位 2</option>
                            <option value="3">槽位 3</option>
                            <option value="4">槽位 4</option>
                            <option value="5">槽位 5</option>
                        </select>
                        <button id="importBtn" class="import-btn" disabled>导入</button>
                    </div>
                </div>
                
                <div class="save-shortcuts">
                    <div class="save-shortcuts-title">⌨️ 快捷键</div>
                    <div class="shortcut-item">
                        <span class="shortcut-key">F5</span>
                        <span>快速保存（槽位1）</span>
                    </div>
                    <div class="shortcut-item">
                        <span class="shortcut-key">F9</span>
                        <span>快速加载（槽位1）</span>
                    </div>
                    <div class="shortcut-item">
                        <span>💡</span>
                        <span>游戏每30秒自动保存到槽位1</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 打开存档菜单
        const openBtn = document.getElementById('openSaveMenuBtn'); // 修改为新的按钮ID
        if (openBtn) {
            openBtn.addEventListener('click', () => this.openModal());
        }

        // 关闭存档菜单
        const closeBtn = document.getElementById('closeSaveModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // 点击模态框外部关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // 文件选择
        const fileInput = document.getElementById('importFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e);
            });
        }

        // 导入按钮
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.handleImport();
            });
        }
    }

    /**
     * 打开模态框
     */
    openModal() {
        this.modal.classList.add('active');
        this.refreshSaveSlots();
    }

    /**
     * 关闭模态框
     */
    closeModal() {
        this.modal.classList.remove('active');
    }

    /**
     * 刷新存档槽位显示
     */
    refreshSaveSlots() {
        const savesContainer = document.getElementById('saveSlots');
        if (!savesContainer) return;

        const saves = this.saveSystem.getAllSaves();
        savesContainer.innerHTML = '';

        saves.forEach(save => {
            const slotElement = this.createSlotElement(save);
            savesContainer.appendChild(slotElement);
        });
    }

    /**
     * 创建存档槽位元素
     */
    createSlotElement(save) {
        const slot = document.createElement('div');
        slot.className = `save-slot ${save.exists ? '' : 'empty'}`;

        if (save.exists && save.slotInfo) {
            slot.innerHTML = `
                <div class="save-slot-info">
                    <div class="save-slot-number">槽位 ${save.slot}</div>
                    <div class="save-slot-details">
                        保存时间: ${save.slotInfo.savedAt || '未知'}<br>
                        玩家等级: Lv.${save.slotInfo.playerLevel || 1}<br>
                        金币: ${this.formatNumber(save.slotInfo.coins || 0)}
                    </div>
                </div>
                <div class="save-slot-actions">
                    <button class="save-slot-btn save" data-slot="${save.slot}">保存</button>
                    <button class="save-slot-btn load" data-slot="${save.slot}">加载</button>
                    <button class="save-slot-btn export" data-slot="${save.slot}">导出</button>
                    <button class="save-slot-btn delete" data-slot="${save.slot}">删除</button>
                </div>
            `;
        } else {
            slot.innerHTML = `
                <div class="save-slot-info">
                    <div class="save-slot-number">槽位 ${save.slot}</div>
                    <div class="save-slot-empty">空槽位</div>
                </div>
                <div class="save-slot-actions">
                    <button class="save-slot-btn save" data-slot="${save.slot}">保存</button>
                    <button class="save-slot-btn load" data-slot="${save.slot}" disabled>加载</button>
                    <button class="save-slot-btn export" data-slot="${save.slot}" disabled>导出</button>
                    <button class="save-slot-btn delete" data-slot="${save.slot}" disabled>删除</button>
                </div>
            `;
        }

        // 绑定按钮事件
        this.bindSlotButtons(slot, save.slot);

        return slot;
    }

    /**
     * 绑定槽位按钮事件
     */
    bindSlotButtons(slotElement, slot) {
        // 保存按钮
        const saveBtn = slotElement.querySelector('.save-slot-btn.save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.handleSave(slot);
            });
        }

        // 加载按钮
        const loadBtn = slotElement.querySelector('.save-slot-btn.load');
        if (loadBtn && !loadBtn.disabled) {
            loadBtn.addEventListener('click', () => {
                this.handleLoad(slot);
            });
        }

        // 导出按钮
        const exportBtn = slotElement.querySelector('.save-slot-btn.export');
        if (exportBtn && !exportBtn.disabled) {
            exportBtn.addEventListener('click', () => {
                this.handleExport(slot);
            });
        }

        // 删除按钮
        const deleteBtn = slotElement.querySelector('.save-slot-btn.delete');
        if (deleteBtn && !deleteBtn.disabled) {
            deleteBtn.addEventListener('click', () => {
                this.handleDelete(slot);
            });
        }
    }

    /**
     * 处理保存
     */
    handleSave(slot) {
        const success = this.saveSystem.saveGame(slot);
        if (success) {
            showToast(`已保存到槽位 ${slot}`);
            this.refreshSaveSlots();
        } else {
            showToast('保存失败');
        }
    }

    /**
     * 处理加载
     */
    handleLoad(slot) {
        showConfirm(`确定要加载槽位 ${slot} 的存档吗？当前进度将被覆盖。`, () => {
            const success = this.saveSystem.loadGame(slot);
            if (success) {
                showToast(`已从槽位 ${slot} 加载`);
                this.closeModal();
                // 刷新页面以应用加载的数据
                setTimeout(() => {
                    location.reload();
                }, 500);
            } else {
                showToast('加载失败');
            }
        });
    }

    /**
     * 处理导出
     */
    handleExport(slot) {
        this.saveSystem.exportSave(slot);
        showToast(`槽位 ${slot} 已导出`);
    }

    /**
     * 处理删除
     */
    handleDelete(slot) {
        showConfirm(`确定要删除槽位 ${slot} 的存档吗？此操作不可撤销！\n删除后将清除当前数据并重新加载游戏。`, () => {
            const success = this.saveSystem.deleteSave(slot);
            if (success) {
                showToast(`槽位 ${slot} 已删除，正在重新加载...`);
                this.closeModal();

                // 清除当前游戏数据并重新加载页面
                setTimeout(() => {
                    // 清除可能保存在localStorage中的其他游戏数据
                    localStorage.removeItem('playerData');
                    localStorage.removeItem('resourceData');
                    localStorage.removeItem('territoryData');

                    // 刷新页面重新加载游戏
                    location.reload();
                }, 500);
            } else {
                showToast('删除失败');
            }
        });
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        const fileNameDisplay = document.getElementById('importFileName');
        const importBtn = document.getElementById('importBtn');

        if (file) {
            this.selectedFile = file;
            fileNameDisplay.textContent = file.name;
            importBtn.disabled = false;
        } else {
            this.selectedFile = null;
            fileNameDisplay.textContent = '未选择文件';
            importBtn.disabled = true;
        }
    }

    /**
     * 处理导入
     */
    async handleImport() {
        if (!this.selectedFile) return;

        const slotSelect = document.getElementById('importSlotSelect');
        const targetSlot = parseInt(slotSelect.value);

        const success = await this.saveSystem.importSave(this.selectedFile, targetSlot);

        if (success) {
            showToast(`存档已导入到槽位 ${targetSlot}`);
            this.refreshSaveSlots();

            // 重置文件选择
            const fileInput = document.getElementById('importFileInput');
            if (fileInput) {
                fileInput.value = '';
            }
            this.selectedFile = null;
            document.getElementById('importFileName').textContent = '未选择文件';
            document.getElementById('importBtn').disabled = true;
        } else {
            showToast('导入失败，请检查文件格式');
        }
    }



    /**
     * 格式化数字
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
}

export default SaveUI;
