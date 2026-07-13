/**
 * Owns the pet modal, its active tab, and pet unlock/formation actions.
 * Cross-system refreshes and mutually exclusive modals stay delegated to the
 * Game coordinator through callbacks.
 */
export class PetModalController {
  constructor({
    petSystem,
    territorySystem,
    playerSystem,
    resourceSystem,
    uiSystem,
    modalFocusManager,
    escapeHTML,
    formatNumber,
    onBeforeOpen,
    onChanged,
  }) {
    this.petSystem = petSystem;
    this.territorySystem = territorySystem;
    this.playerSystem = playerSystem;
    this.resourceSystem = resourceSystem;
    this.uiSystem = uiSystem;
    this.modalFocusManager = modalFocusManager;
    this.escapeHTMLDelegate = escapeHTML;
    this.formatNumberDelegate = formatNumber;
    this.onBeforeOpen = onBeforeOpen;
    this.onChanged = onChanged;
    this.activeTab = "formation";
  }

  getPetTemplateForInstance(pet) {
    return this.petSystem?.getTemplate?.(pet.templateId);
  }

  getPetImageMarkup(template, className = "pet-thumb") {
    if (!template?.image) {
      return `<span>${this.escapeHTML(template?.emoji || "PET")}</span>`;
    }

    return `<img class="${this.escapeHTML(className)}" src="${this.escapeHTML(
      template.image
    )}" alt="${this.escapeHTML(template.name)}">`;
  }

  formatPetCost(cost = {}) {
    const parts = [];
    if ((cost.coins || 0) > 0) {
      parts.push(`金币 ${this.formatNumber(cost.coins)}`);
    }
    if ((cost.rubies || 0) > 0) {
      parts.push(`红宝石 ${this.formatNumber(cost.rubies)}`);
    }
    return parts.join(" / ") || "免费";
  }

  getPetEffectSummary(pet, template = this.getPetTemplateForInstance(pet)) {
    const tier = this.petSystem?.getFriendshipTier?.(pet?.friendship || 0) || {
      level: 1,
      label: "熟悉",
    };
    const buildingType = template?.baseRole?.buildingType;
    const buildingName = this.territorySystem?.buildingData?.[buildingType]?.name || "基地活动";
    const support = buildingType ? {
      buildingType,
      tier: tier.level,
      tierLabel: tier.label,
    } : null;
    const baseEffect = this.territorySystem?.getActivitySupportBonus?.(buildingType, support);
    return {
      exploration: template?.explorationTalent?.detail || "参与远征搜索",
      buildingName,
      tierLabel: tier.label,
      base: baseEffect?.detail || template?.baseRole?.detail || "协助基地活动",
    };
  }

  canUnlockPet(template) {
    if (!template) return { success: false, reason: "宠物不存在" };

    const owned = this.petSystem?.unlockedPets?.some(
      (pet) => pet.templateId === template.id
    );
    if (owned) return { success: false, reason: "已拥有" };

    const playerLevel = this.playerSystem?.player?.level || 1;
    if (playerLevel < template.requiredLevel) {
      return { success: false, reason: `需要 Lv.${template.requiredLevel}` };
    }

    if (!this.resourceSystem) {
      return { success: false, reason: "资源未初始化" };
    }

    if (!this.resourceSystem.hasEnoughCoins(template.cost?.coins || 0)) {
      return { success: false, reason: "金币不足" };
    }

    if (
      (template.cost?.rubies || 0) > 0 &&
      !this.resourceSystem.hasEnoughRubies(template.cost.rubies)
    ) {
      return { success: false, reason: "红宝石不足" };
    }

    return { success: true, reason: "可解锁" };
  }

  open(activeTab = this.activeTab) {
    this.onBeforeOpen?.();
    this.activeTab = activeTab || "formation";
    this.render();
  }

  close() {
    const modal = document.getElementById("pet-modal");
    if (modal) {
      modal.remove();
      this.modalFocusManager.release(modal);
    }
  }

  render() {
    document.getElementById("pet-modal")?.remove();

    const modal = document.createElement("div");
    modal.id = "pet-modal";
    modal.className = "pet-modal show";
    modal.innerHTML = `
      <div class="pet-modal-content" role="dialog" aria-modal="true" aria-labelledby="pet-modal-title">
        <div class="pet-modal-header">
          <h2 class="pet-modal-title" id="pet-modal-title">宠物</h2>
          <button class="pet-modal-close" type="button" aria-label="关闭宠物页面" data-pet-close>×</button>
        </div>
        <div class="pet-tabs" role="tablist" aria-label="宠物页面">
          ${this.renderTabButton("formation", "编队")}
          ${this.renderTabButton("bag", "背包")}
          ${this.renderTabButton("collection", "图鉴")}
        </div>
        <div class="pet-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    modal.addEventListener("click", (event) => {
      const target =
        event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target) return;

      if (target === modal || target.closest("[data-pet-close]")) {
        this.close();
        return;
      }

      const tabButton = target.closest("[data-pet-tab]");
      if (tabButton) {
        this.activeTab = tabButton.dataset.petTab || "formation";
        this.render();
        return;
      }

      const actionButton = target.closest("[data-pet-action]");
      if (actionButton) {
        this.handleAction(actionButton);
      }
    });

    document.body.appendChild(modal);
    this.modalFocusManager.activate(modal, ".pet-modal-close");
  }

  renderTabButton(tab, label) {
    const active = this.activeTab === tab ? "active" : "";
    const selected = this.activeTab === tab ? "true" : "false";
    return `
      <button class="pet-tab ${active}" type="button" role="tab" aria-selected="${selected}" data-pet-tab="${this.escapeHTML(
      tab
    )}">
        ${this.escapeHTML(label)}
      </button>
    `;
  }

  renderTabContent() {
    if (!this.petSystem) {
      return `<div class="modal-empty">宠物系统未初始化</div>`;
    }

    if (this.activeTab === "bag") {
      return this.renderBag();
    }

    if (this.activeTab === "collection") {
      return this.renderCollection();
    }

    return this.renderFormation();
  }

  renderFormation() {
    const equippedPets = this.petSystem?.equippedPets || [];
    const powerBonus = this.petSystem?.getTotalPowerBonus?.() || {
      attack: 0,
      defense: 0,
    };

    const slots = Array.from({ length: 3 }, (_, index) => {
      const pet = equippedPets[index];
      if (!pet) {
        return `
          <div class="pet-slot empty">
            <div class="pet-slot-empty">+</div>
            <div class="pet-level">空槽位</div>
          </div>
        `;
      }

      const template = this.getPetTemplateForInstance(pet);
      return `
        <div class="pet-slot">
          <div class="pet-icon">${this.getPetImageMarkup(template)}</div>
          <div class="pet-level">${this.escapeHTML(template?.name || "宠物")} Lv.${this.escapeHTML(
        pet.level || 1
      )}</div>
          <button class="pet-action-btn pet-slot-action" type="button" data-pet-action="unequip" data-instance-id="${this.escapeHTML(
            pet.instanceId
          )}">卸下</button>
        </div>
      `;
    }).join("");

    const activeEffects = equippedPets.map((pet) => {
      const template = this.getPetTemplateForInstance(pet);
      const effect = this.getPetEffectSummary(pet, template);
      return `
        <div class="formation-effect">
          <b>${this.escapeHTML(template?.name || "宠物")}</b>
          <span>探索 · ${this.escapeHTML(template?.explorationTalent?.label || "协同搜索")}：${this.escapeHTML(effect.exploration)}</span>
          <span>基地 · ${this.escapeHTML(effect.buildingName)} / ${this.escapeHTML(effect.tierLabel)}：${this.escapeHTML(effect.base)}</span>
        </div>
      `;
    }).join("");

    return `
      <div class="pet-formation">
        <section class="formation-section">
          <h3>当前编队</h3>
          <div class="formation-slots">${slots}</div>
        </section>
        <section class="team-stats">
          <h3>队伍属性</h3>
          <div class="stat-item">
            <span class="stat-label">上阵数量</span>
            <span class="stat-value">${equippedPets.length}/3</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">攻击加成</span>
            <span class="stat-value">+${this.formatNumber(powerBonus.attack)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">防御加成</span>
            <span class="stat-value">+${this.formatNumber(powerBonus.defense)}</span>
          </div>
          <div class="formation-effect-list">
            <h4>编队效果</h4>
            ${activeEffects || `<span class="formation-effect-empty">上阵宠物后显示探索与基地效果</span>`}
          </div>
        </section>
      </div>
    `;
  }

  renderBag() {
    const unlockedPets = this.petSystem?.unlockedPets || [];
    if (unlockedPets.length === 0) {
      return `<div class="modal-empty">还没有解锁宠物</div>`;
    }

    const cards = unlockedPets
      .map((pet) => this.renderOwnedPetCard(pet))
      .join("");

    return `<div class="pet-bag-list">${cards}</div>`;
  }

  renderOwnedPetCard(pet) {
    const template = this.getPetTemplateForInstance(pet);
    const rarity = this.petSystem?.getRarityConfig?.(template?.rarity) || {
      name: "普通",
      color: "#9e9e9e",
      stars: 1,
    };
    const level = pet.level || 1;
    const levelMultiplier = 1 + (level - 1) * 0.1;
    const attack = Math.floor((template?.baseStats?.attack || 0) * levelMultiplier);
    const defense = Math.floor(
      (template?.baseStats?.defense || 0) * levelMultiplier
    );
    const hp = Math.floor((template?.baseStats?.hp || 0) * levelMultiplier);
    const equippedCount = this.petSystem?.equippedPets?.length || 0;
    const canEquip = pet.equipped || equippedCount < 3;
    const action = pet.equipped ? "unequip" : "equip";
    const actionLabel = pet.equipped ? "卸下" : canEquip ? "上阵" : "编队已满";
    const effect = this.getPetEffectSummary(pet, template);

    return `
      <article class="pet-card">
        <div class="pet-card-header">
          <div class="pet-card-icon">${this.getPetImageMarkup(template)}</div>
          <div class="pet-card-rarity" style="color: ${this.escapeHTML(
            rarity.color
          )}">${this.escapeHTML(rarity.name)} ${"★".repeat(rarity.stars)}</div>
        </div>
        <div class="pet-card-body">
          <h3 class="pet-card-name">${this.escapeHTML(template?.name || "未知宠物")}</h3>
          <div class="pet-card-level">Lv.${this.escapeHTML(level)}</div>
          ${pet.equipped ? `<div class="pet-equipped-badge">已上阵</div>` : ""}
          <div class="pet-card-stats">
            <span class="stat-mini">攻击 ${this.formatNumber(attack)}</span>
            <span class="stat-mini">生命 ${this.formatNumber(hp)}</span>
            <span class="stat-mini">防御 ${this.formatNumber(defense)}</span>
          </div>
          <p class="collection-card-desc">探索 · ${this.escapeHTML(
            template?.explorationTalent?.label || "协同搜索"
          )}：${this.escapeHTML(template?.explorationTalent?.detail || "参与远征搜索")}</p>
          <p class="collection-card-desc">基地 · ${this.escapeHTML(
            template?.baseRole?.label || "驻地伙伴"
          )} / ${this.escapeHTML(effect.tierLabel)}：${this.escapeHTML(effect.base)}</p>
          <div class="pet-card-status">
            ${this.renderStatusBar("经验", pet.exp || 0, 100)}
            ${this.renderStatusBar("羁绊", pet.friendship || 0, 100)}
          </div>
        </div>
        <div class="pet-card-actions">
          <button class="pet-action-btn" type="button" data-pet-action="${action}" data-instance-id="${this.escapeHTML(
      pet.instanceId
    )}" ${canEquip ? "" : "disabled"}>${this.escapeHTML(actionLabel)}</button>
        </div>
      </article>
    `;
  }

  renderStatusBar(label, value, max) {
    const safeValue = Math.max(0, Number(value) || 0);
    const safeMax = Math.max(1, Number(max) || 1);
    const percent = Math.min(100, Math.round((safeValue / safeMax) * 100));
    return `
      <div class="status-bar">
        <span class="status-label">${this.escapeHTML(label)}</span>
        <span class="status-progress">
          <span class="status-fill" style="width: ${percent}%"></span>
        </span>
        <span class="status-value">${this.formatNumber(safeValue)}/${this.formatNumber(safeMax)}</span>
      </div>
    `;
  }

  renderCollection() {
    const templates = this.petSystem?.petTemplates || [];
    const cards = templates
      .map((template) => {
        const owned = this.petSystem.unlockedPets.some(
          (pet) => pet.templateId === template.id
        );
        const rarity = this.petSystem.getRarityConfig(template.rarity);
        const unlockState = this.canUnlockPet(template);
        const disabled = owned || !unlockState.success;
        const buttonLabel = owned ? "已拥有" : unlockState.reason;

        return `
          <article class="pet-card pet-collection-card ${owned ? "is-owned" : "is-locked"}">
            <div class="pet-card-header">
              <div class="pet-card-icon">${this.getPetImageMarkup(template)}</div>
              <div class="pet-card-rarity" style="color: ${this.escapeHTML(
                rarity.color
              )}">${this.escapeHTML(rarity.name)} ${"★".repeat(rarity.stars)}</div>
            </div>
            <div class="pet-card-body">
              <h3 class="pet-card-name">${this.escapeHTML(template.name)}</h3>
              <p class="collection-card-desc">战斗 · ${this.escapeHTML(template.skill?.name || "基础协战")}</p>
              <p class="collection-card-desc">探索 · ${this.escapeHTML(
                template.explorationTalent?.label || "协同搜索"
              )}</p>
              <p class="collection-card-desc">基地 · ${this.escapeHTML(
                template.baseRole?.label || "驻地伙伴"
              )}</p>
              <div class="collection-card-info">
                <div class="info-row">
                  <span>解锁等级</span>
                  <strong>Lv.${this.escapeHTML(template.requiredLevel)}</strong>
                </div>
                <div class="info-row">
                  <span>费用</span>
                  <strong>${this.escapeHTML(this.formatPetCost(template.cost))}</strong>
                </div>
                <div class="info-row">
                  <span>基础攻击</span>
                  <strong>${this.formatNumber(template.baseStats.attack)}</strong>
                </div>
              </div>
            </div>
            <div class="pet-card-actions">
              <button class="pet-action-btn" type="button" data-pet-action="unlock" data-pet-id="${this.escapeHTML(
                template.id
              )}" ${disabled ? "disabled" : ""}>${this.escapeHTML(buttonLabel)}</button>
            </div>
          </article>
        `;
      })
      .join("");

    return `<div class="pet-collection-list">${cards}</div>`;
  }

  handleAction(button) {
    const action = button.dataset.petAction;
    let result = { success: false, message: "未知操作" };

    if (action === "unlock") {
      result = this.petSystem.unlockPet(Number(button.dataset.petId));
      if (result.success) {
        this.activeTab = "bag";
      }
    } else if (action === "equip") {
      result = this.petSystem.equipPet(Number(button.dataset.instanceId));
    } else if (action === "unequip") {
      result = this.petSystem.unequipPet(Number(button.dataset.instanceId));
    }

    if (result.success) {
      this.uiSystem?.showToast(result.message, "success");
      this.onChanged?.(result);
    } else {
      this.uiSystem?.showToast(result.message, "error");
    }

    this.render();
  }

  escapeHTML(value) {
    return this.escapeHTMLDelegate(value);
  }

  formatNumber(value) {
    return this.formatNumberDelegate(value);
  }
}
