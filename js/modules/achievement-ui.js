/**
 * @file 成就系统UI
 * @description 处理成就和任务界面的显示与交互
 */

class AchievementUI {
    constructor(achievementSystem, container) {
        this.achievementSystem = achievementSystem;
        this.container = container;
        this.isVisible = false;

        // 绑定更新回调
        this.achievementSystem.onProgressUpdate = () => this.updateUI();
    }

    init() {
        // 创建主界面模态框
        this.createModal();
        // 绑定入口按钮（在 main.js 中绑定到底部导航栏）
    }

    createModal() {
        // 如果已存在则不创建
        if (document.getElementById('achievementModal')) return;

        const modal = document.createElement('div');
        modal.id = 'achievementModal';
        modal.className = 'modal';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="modal-content achievement-modal-content">
                <div class="modal-header">
                    <h2>📅 任务 & 🏆 成就</h2>
                    <span class="close-modal" id="closeAchievementModal">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="tab-container">
                        <button class="tab-btn active" data-tab="daily">每日任务</button>
                        <button class="tab-btn" data-tab="achievement">成就</button>
                    </div>
                    <div id="questList" class="quest-list">
                        <!-- 列表内容动态生成 -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 绑定事件
        modal.querySelector('#closeAchievementModal').addEventListener('click', () => this.hide());

        const tabs = modal.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.renderList(e.target.dataset.tab);
            });
        });

        // 点击遮罩关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hide();
        });
    }

    show() {
        const modal = document.getElementById('achievementModal');
        if (modal) {
            modal.style.display = 'flex'; // flex for centering
            this.isVisible = true;
            this.updateUI();
        }
    }

    hide() {
        const modal = document.getElementById('achievementModal');
        if (modal) {
            modal.style.display = 'none';
            this.isVisible = false;
        }
    }

    updateUI() {
        if (!this.isVisible) return;

        const activeTab = document.querySelector('#achievementModal .tab-btn.active').dataset.tab;
        this.renderList(activeTab);
    }

    renderList(tabType) {
        const listContainer = document.getElementById('questList');
        listContainer.innerHTML = '';

        const data = tabType === 'daily'
            ? this.achievementSystem.dailyQuests
            : this.achievementSystem.achievements;

        const isDaily = tabType === 'daily';

        Object.values(data).forEach(item => {
            const el = document.createElement('div');
            el.className = 'quest-item';

            // 奖励文本
            let rewardText = '';
            if (item.reward.coins) rewardText += `💰${item.reward.coins} `;
            if (item.reward.rubies) rewardText += `🔴${item.reward.rubies} `;
            if (item.reward.crystals) rewardText += `💎${item.reward.crystals} `;

            // 按钮状态
            let btnState = '';
            let btnText = '进行中';
            let activeClass = '';

            if (item.claimed) {
                btnState = 'disabled';
                btnText = '已完成';
                activeClass = 'claimed';
            } else if (item.progress >= item.target) {
                btnText = '领取';
                activeClass = 'can-claim';
            } else {
                btnState = 'disabled';
                btnText = `${item.progress}/${item.target}`;
            }

            el.innerHTML = `
                <div class="quest-info">
                    <div class="quest-title">${item.title}</div>
                    <div class="quest-desc">${item.desc}</div>
                    <div class="quest-reward">奖励: ${rewardText}</div>
                </div>
                <button class="quest-btn ${activeClass}" ${btnState} data-id="${item.id}">${btnText}</button>
            `;

            // 绑定领取事件
            const btn = el.querySelector('.quest-btn');
            if (activeClass === 'can-claim') {
                btn.addEventListener('click', () => {
                    this.achievementSystem.claimReward(item.id, isDaily);
                    // 领取后显示提示
                    import('./ui-system.js').then(({ showToast }) => {
                        showToast(`已领取: ${rewardText}`);
                    });
                });
            }

            listContainer.appendChild(el);
        });
    }
}

export default AchievementUI;
