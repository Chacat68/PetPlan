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

  getTabDefinition(tab) {
    return {
      formation: {
        label: "远征编队",
        detail: "部署与协同",
        icon: "◈",
      },
      bag: {
        label: "伙伴名册",
        detail: "属性与羁绊",
        icon: "▦",
      },
      collection: {
        label: "伙伴图鉴",
        detail: "发现与解锁",
        icon: "✦",
      },
    }[tab] || null;
  }

  normalizeTab(tab) {
    return this.getTabDefinition(tab) ? tab : "formation";
  }

  getPetTypeLabel(type) {
    return {
      fire: "火",
      ice: "冰",
      thunder: "雷",
      earth: "地",
      wind: "风",
      light: "光",
      dark: "暗",
      phoenix: "焰",
    }[type] || "灵";
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
    this.activeTab = this.normalizeTab(activeTab);
    this.render();
  }

  close() {
    const modal = document.getElementById("pet-modal");
    if (modal) {
      modal.remove();
      this.modalFocusManager.release(modal);
    }
  }

  render({ focusTab = false } = {}) {
    const previousModal = document.getElementById("pet-modal");
    if (previousModal) {
      this.modalFocusManager.release(previousModal);
      previousModal.remove();
    }

    const templates = this.petSystem?.petTemplates || [];
    const unlockedPets = this.petSystem?.unlockedPets || [];
    const equippedPets = this.petSystem?.equippedPets || [];
    const powerBonus = this.petSystem?.getTotalPowerBonus?.() || {
      attack: 0,
      defense: 0,
    };
    const activeTab = this.normalizeTab(this.activeTab);
    this.activeTab = activeTab;

    const modal = document.createElement("div");
    modal.id = "pet-modal";
    modal.className = "pet-modal show";
    modal.innerHTML = `
      <div class="pet-modal-content" role="dialog" aria-modal="true" aria-labelledby="pet-modal-title" data-active-tab="${this.escapeHTML(
        activeTab
      )}">
        <div class="pet-modal-header">
          <div class="pet-modal-heading">
            <span class="pet-modal-eyebrow">COMPANION COMMAND</span>
            <div class="pet-modal-title-row">
              <span class="pet-modal-emblem" aria-hidden="true">✦</span>
              <div>
                <h2 class="pet-modal-title" id="pet-modal-title">宠物中枢</h2>
                <p>编成远征队，协调探索天赋与基地岗位</p>
              </div>
            </div>
          </div>
          <div class="pet-roster-overview" aria-label="宠物队伍概览">
            <div class="pet-overview-metric">
              <span>已收集</span>
              <b>${this.formatNumber(unlockedPets.length)}<small>/${this.formatNumber(
        templates.length
      )}</small></b>
            </div>
            <div class="pet-overview-metric">
              <span>已上阵</span>
              <b>${this.formatNumber(equippedPets.length)}<small>/3</small></b>
            </div>
            <div class="pet-overview-metric is-power">
              <span>编队战备</span>
              <b>+${this.formatNumber(powerBonus.attack + powerBonus.defense)}</b>
            </div>
          </div>
          <button class="pet-modal-close" type="button" aria-label="关闭宠物页面" data-pet-close>×</button>
        </div>
        <div class="pet-tabs" role="tablist" aria-label="宠物页面">
          ${this.renderTabButton("formation")}
          ${this.renderTabButton("bag")}
          ${this.renderTabButton("collection")}
        </div>
        <div class="pet-content" id="pet-panel-${this.escapeHTML(
          activeTab
        )}" role="tabpanel" tabindex="0" aria-labelledby="pet-tab-${this.escapeHTML(activeTab)}">
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
        this.activeTab = this.normalizeTab(tabButton.dataset.petTab);
        this.render({ focusTab: true });
        return;
      }

      const routeButton = target.closest("[data-pet-route]");
      if (routeButton) {
        this.activeTab = this.normalizeTab(routeButton.dataset.petRoute);
        this.render({ focusTab: true });
        return;
      }

      const actionButton = target.closest("[data-pet-action]");
      if (actionButton) {
        this.handleAction(actionButton);
      }
    });

    document.body.appendChild(modal);
    this.modalFocusManager.activate(modal, ".pet-modal-close");
    if (focusTab) {
      modal.querySelector(`[data-pet-tab="${activeTab}"]`)?.focus();
    }
  }

  renderTabButton(tab) {
    const definition = this.getTabDefinition(tab);
    const active = this.activeTab === tab ? "active" : "";
    const selected = this.activeTab === tab ? "true" : "false";
    return `
      <button class="pet-tab ${active}" id="pet-tab-${this.escapeHTML(
        tab
      )}" type="button" role="tab" aria-selected="${selected}" aria-controls="pet-panel-${this.escapeHTML(
        tab
      )}" data-pet-tab="${this.escapeHTML(
      tab
    )}">
        <span class="pet-tab-icon" aria-hidden="true">${this.escapeHTML(definition.icon)}</span>
        <span class="pet-tab-copy">
          <strong>${this.escapeHTML(definition.label)}</strong>
          <small>${this.escapeHTML(definition.detail)}</small>
        </span>
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
          <article class="pet-slot empty">
            <span class="pet-slot-index">席位 0${index + 1}</span>
            <div class="pet-slot-empty" aria-hidden="true">＋</div>
            <div class="pet-slot-empty-copy">
              <strong>等待伙伴</strong>
              <span>从伙伴名册中选择一只宠物加入远征队</span>
            </div>
            <button class="pet-empty-route" type="button" data-pet-route="bag">选择伙伴</button>
          </article>
        `;
      }

      const template = this.getPetTemplateForInstance(pet);
      const rarity = this.petSystem?.getRarityConfig?.(template?.rarity) || {
        name: "普通",
        color: "#9e9e9e",
        stars: 1,
      };
      const effect = this.getPetEffectSummary(pet, template);
      return `
        <article class="pet-slot is-filled" data-pet-type="${this.escapeHTML(
          template?.type || "neutral"
        )}" style="--pet-rarity: ${this.escapeHTML(rarity.color)}">
          <span class="pet-slot-index">席位 0${index + 1}</span>
          <div class="pet-slot-portrait">
            <span class="pet-element-mark" aria-hidden="true">${this.escapeHTML(
              this.getPetTypeLabel(template?.type)
            )}</span>
            <div class="pet-icon">${this.getPetImageMarkup(template)}</div>
          </div>
          <div class="pet-slot-identity">
            <span>${this.escapeHTML(rarity.name)} · ${"★".repeat(rarity.stars)}</span>
            <strong>${this.escapeHTML(template?.name || "宠物")}</strong>
            <small>等级 ${this.escapeHTML(pet.level || 1)} · 羁绊 ${this.escapeHTML(
        effect.tierLabel
      )}</small>
          </div>
          <div class="pet-slot-specialties">
            <span><b>探索</b>${this.escapeHTML(template?.explorationTalent?.label || "协同搜索")}</span>
            <span><b>基地</b>${this.escapeHTML(template?.baseRole?.label || "驻地伙伴")}</span>
          </div>
          <button class="pet-action-btn pet-slot-action" type="button" data-pet-action="unequip" data-instance-id="${this.escapeHTML(
            pet.instanceId
          )}">移出编队</button>
        </article>
      `;
    }).join("");

    const activeEffects = equippedPets.map((pet) => {
      const template = this.getPetTemplateForInstance(pet);
      const effect = this.getPetEffectSummary(pet, template);
      const rarity = this.petSystem?.getRarityConfig?.(template?.rarity) || {
        color: "#9e9e9e",
      };
      return `
        <article class="formation-effect" style="--pet-rarity: ${this.escapeHTML(rarity.color)}">
          <div class="formation-effect-pet">
            <span class="formation-effect-thumb">${this.getPetImageMarkup(template)}</span>
            <span><b>${this.escapeHTML(template?.name || "宠物")}</b><small>${this.escapeHTML(
        effect.tierLabel
      )}羁绊</small></span>
          </div>
          <p><b>探索 · ${this.escapeHTML(
            template?.explorationTalent?.label || "协同搜索"
          )}</b><span>${this.escapeHTML(effect.exploration)}</span></p>
          <p><b>基地 · ${this.escapeHTML(effect.buildingName)}</b><span>${this.escapeHTML(
        effect.base
      )}</span></p>
        </article>
      `;
    }).join("");

    return `
      <div class="pet-formation">
        <section class="pet-section-intro">
          <div>
            <span class="pet-section-kicker">ACTIVE SQUAD</span>
            <h3>远征编队</h3>
            <p>上阵伙伴会同时影响战斗属性、搜索方式与基地活动。</p>
          </div>
          <span class="pet-section-count">${this.formatNumber(equippedPets.length)} / 3 已部署</span>
        </section>
        <div class="pet-formation-workspace">
          <section class="formation-section" aria-label="宠物编队席位">
            <div class="formation-slots">${slots}</div>
          </section>
          <section class="team-stats">
            <div class="team-stats-heading">
              <div>
                <span class="pet-section-kicker">SQUAD SYNERGY</span>
                <h3>编队总览</h3>
              </div>
              <span class="team-ready-state ${equippedPets.length > 0 ? "is-ready" : ""}">${
                equippedPets.length > 0 ? "增益生效" : "等待部署"
              }</span>
            </div>
            <div class="team-stat-grid">
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
            </div>
            <div class="formation-effect-list">
              <div class="formation-effect-heading">
                <h4>编队效果</h4>
                <span>实际生效</span>
              </div>
              ${activeEffects || `<span class="formation-effect-empty">上阵宠物后显示探索与基地效果</span>`}
            </div>
            <button class="pet-manage-route" type="button" data-pet-route="bag">管理全部伙伴 <span aria-hidden="true">→</span></button>
          </section>
        </div>
      </div>
    `;
  }

  renderBag() {
    const unlockedPets = this.petSystem?.unlockedPets || [];
    if (unlockedPets.length === 0) {
      return `
        <div class="pet-empty-state">
          <span class="pet-empty-state-icon" aria-hidden="true">◇</span>
          <h3>伙伴名册还是空的</h3>
          <p>前往伙伴图鉴，解锁第一只宠物后即可编入远征队。</p>
          <button type="button" class="pet-manage-route" data-pet-route="collection">打开伙伴图鉴 <span aria-hidden="true">→</span></button>
        </div>
      `;
    }

    const cards = unlockedPets
      .map((pet) => this.renderOwnedPetCard(pet))
      .join("");

    return `
      <div class="pet-roster-view">
        <section class="pet-section-intro">
          <div>
            <span class="pet-section-kicker">YOUR COMPANIONS</span>
            <h3>伙伴名册</h3>
            <p>比较属性与专长，随时调整远征编队。</p>
          </div>
          <span class="pet-section-count">${this.formatNumber(unlockedPets.length)} 只伙伴</span>
        </section>
        <div class="pet-bag-list">${cards}</div>
      </div>
    `;
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
      <article class="pet-card pet-roster-card ${pet.equipped ? "is-equipped" : ""}" data-pet-type="${this.escapeHTML(
        template?.type || "neutral"
      )}" style="--pet-rarity: ${this.escapeHTML(rarity.color)}">
        <div class="pet-card-header">
          <div class="pet-card-icon-wrap">
            <span class="pet-element-mark" aria-hidden="true">${this.escapeHTML(
              this.getPetTypeLabel(template?.type)
            )}</span>
            <div class="pet-card-icon">${this.getPetImageMarkup(template)}</div>
          </div>
          <div class="pet-card-identity">
            <span class="pet-card-rarity">${this.escapeHTML(rarity.name)} · ${"★".repeat(
      rarity.stars
    )}</span>
            <h3 class="pet-card-name">${this.escapeHTML(template?.name || "未知宠物")}</h3>
            <div class="pet-card-meta">
              <span class="pet-card-level">等级 ${this.escapeHTML(level)}</span>
              ${pet.equipped ? `<span class="pet-equipped-badge">已上阵</span>` : ""}
            </div>
          </div>
        </div>
        <div class="pet-card-body">
          <div class="pet-card-stats">
            <span class="stat-mini"><small>攻击</small><b>${this.formatNumber(attack)}</b></span>
            <span class="stat-mini"><small>生命</small><b>${this.formatNumber(hp)}</b></span>
            <span class="stat-mini"><small>防御</small><b>${this.formatNumber(defense)}</b></span>
          </div>
          <div class="pet-specialty-grid">
            <div class="pet-specialty">
              <span>远征天赋</span>
              <b>${this.escapeHTML(template?.explorationTalent?.label || "协同搜索")}</b>
              <small>${this.escapeHTML(template?.explorationTalent?.detail || "参与远征搜索")}</small>
            </div>
            <div class="pet-specialty">
              <span>基地岗位 · ${this.escapeHTML(effect.tierLabel)}</span>
              <b>${this.escapeHTML(template?.baseRole?.label || "驻地伙伴")}</b>
              <small>${this.escapeHTML(effect.base)}</small>
            </div>
          </div>
          <div class="pet-card-status">
            ${this.renderStatusBar("经验", pet.exp || 0, 100, "experience")}
            ${this.renderStatusBar("羁绊", pet.friendship || 0, 100, "friendship")}
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

  renderStatusBar(label, value, max, variant = "default") {
    const safeValue = Math.max(0, Number(value) || 0);
    const safeMax = Math.max(1, Number(max) || 1);
    const percent = Math.min(100, Math.round((safeValue / safeMax) * 100));
    return `
      <div class="status-bar status-${this.escapeHTML(variant)}" aria-label="${this.escapeHTML(
        label
      )} ${this.formatNumber(safeValue)} / ${this.formatNumber(safeMax)}">
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
    const ownedCount = this.petSystem?.unlockedPets?.length || 0;
    const cards = templates
      .map((template) => {
        const ownedPet = this.petSystem.unlockedPets.find(
          (pet) => pet.templateId === template.id
        );
        const owned = Boolean(ownedPet);
        const rarity = this.petSystem.getRarityConfig(template.rarity);
        const unlockState = this.canUnlockPet(template);
        const disabled = owned || !unlockState.success;
        const buttonLabel = owned ? "已拥有" : unlockState.reason;

        return `
          <article class="pet-card pet-collection-card ${owned ? "is-owned" : "is-locked"}" data-pet-type="${this.escapeHTML(
            template.type || "neutral"
          )}" style="--pet-rarity: ${this.escapeHTML(rarity.color)}">
            <div class="pet-card-header">
              <div class="pet-card-icon-wrap">
                <span class="pet-element-mark" aria-hidden="true">${this.escapeHTML(
                  this.getPetTypeLabel(template.type)
                )}</span>
                <div class="pet-card-icon">${this.getPetImageMarkup(template)}</div>
              </div>
              <div class="pet-card-identity">
                <span class="pet-card-rarity">${this.escapeHTML(rarity.name)} · ${"★".repeat(
          rarity.stars
        )}</span>
                <h3 class="pet-card-name">${this.escapeHTML(template.name)}</h3>
                <span class="pet-collection-state ${owned ? "is-owned" : ""}">${owned ? "已缔结契约" : "等待解锁"}</span>
              </div>
            </div>
            <div class="pet-card-body">
              <div class="pet-collection-talents">
                <span><small>战斗</small><b>${this.escapeHTML(template.skill?.name || "基础协战")}</b></span>
                <span><small>探索</small><b>${this.escapeHTML(
                  template.explorationTalent?.label || "协同搜索"
                )}</b></span>
                <span><small>基地</small><b>${this.escapeHTML(
                  template.baseRole?.label || "驻地伙伴"
                )}</b></span>
              </div>
              <div class="collection-card-info">
                <div class="info-row">
                  <span>等级要求</span>
                  <strong>Lv.${this.escapeHTML(template.requiredLevel)}</strong>
                </div>
                <div class="info-row">
                  <span>费用</span>
                  <strong>${this.escapeHTML(this.formatPetCost(template.cost))}</strong>
                </div>
                <div class="info-row">
                  <span>基础战备</span>
                  <strong>攻 ${this.formatNumber(template.baseStats.attack)} · 防 ${this.formatNumber(
          template.baseStats.defense
        )}</strong>
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

    const completion = templates.length > 0 ? Math.round((ownedCount / templates.length) * 100) : 0;
    return `
      <div class="pet-collection-view">
        <section class="pet-section-intro pet-collection-intro">
          <div>
            <span class="pet-section-kicker">COMPANION ARCHIVE</span>
            <h3>伙伴图鉴</h3>
            <p>查看每只伙伴的定位与契约条件，规划下一次解锁。</p>
          </div>
          <div class="pet-collection-progress" aria-label="图鉴完成度 ${completion}%">
            <span><b>${this.formatNumber(ownedCount)}</b> / ${this.formatNumber(templates.length)}</span>
            <span class="pet-collection-progress-track"><span style="width: ${completion}%"></span></span>
            <small>图鉴 ${completion}%</small>
          </div>
        </section>
        <div class="pet-collection-list">${cards}</div>
      </div>
    `;
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
