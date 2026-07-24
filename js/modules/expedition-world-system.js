/**
 * ExpeditionWorldSystem - 单局远征的大地图、探索地点、碰撞与发现记录。
 *
 * 本模块不依赖 DOM / Canvas。路线节点仍由 ExpeditionRunSystem 生成，
 * 本模块只负责把节点放到世界里，并要求玩家实际走到地点后交互。
 */

const ROUTE_SLOTS = Object.freeze({
  1: [[620, 620], [650, 1280]],
  2: [[930, 360], [980, 980]],
  3: [[1210, 710], [1270, 1480]],
  4: [[1540, 390], [1580, 1110]],
  5: [[1850, 750], [1910, 1510]],
  6: [[2180, 400], [2220, 1120]],
  7: [[2490, 700], [2510, 1510]],
  8: [[2740, 950], [2740, 950]],
});

const DEFAULT_OBSTACLES = Object.freeze([
  { id: "ruin-west", x: 410, y: 820, width: 170, height: 210, type: "ruin" },
  { id: "rocks-north-1", x: 710, y: 470, width: 150, height: 110, type: "rocks" },
  { id: "pond-west", x: 740, y: 1110, width: 210, height: 150, type: "water" },
  { id: "ruin-mid-1", x: 1060, y: 480, width: 150, height: 170, type: "ruin" },
  { id: "rocks-mid-1", x: 1140, y: 1020, width: 210, height: 130, type: "rocks" },
  { id: "pond-mid", x: 1390, y: 1290, width: 210, height: 150, type: "water" },
  { id: "ruin-mid-2", x: 1450, y: 640, width: 170, height: 170, type: "ruin" },
  { id: "rocks-east-1", x: 1740, y: 420, width: 180, height: 120, type: "rocks" },
  { id: "pond-east", x: 1770, y: 1030, width: 220, height: 160, type: "water" },
  { id: "ruin-east", x: 2050, y: 720, width: 170, height: 210, type: "ruin" },
  { id: "rocks-east-2", x: 2310, y: 1180, width: 190, height: 130, type: "rocks" },
  { id: "ruin-final", x: 2540, y: 850, width: 130, height: 180, type: "ruin" },
]);

const LOCATION_COLORS = Object.freeze({
  search: "#72d7ff",
  cache: "#c38cff",
  combat: "#ffb36b",
  elite: "#ff667d",
  camp: "#8dffb5",
  boss: "#ff7043",
  extraction: "#72d7ff",
  event: "#ffe08a",
  container: "#d8c59a",
});

export const WORLD_EXTRACTION_RULES = Object.freeze({
  entry: Object.freeze({
    id: "entry",
    locationId: "extraction-beacon",
    name: "入口撤离信标",
    minDepth: 3,
    supplyCost: 0,
    tradeoff: "需要原路折返，但守点压力较低且不消耗补给。",
  }),
  emergency: Object.freeze({
    id: "emergency",
    locationId: "emergency-extraction",
    name: "深区应急撤离点",
    minDepth: 5,
    supplyCost: 1,
    tradeoff: "位于深区、无需折返入口，但消耗 1 份补给且守点更久、敌人更密集。",
  }),
});

const EXTRACTION_ALIASES = Object.freeze({
  entry: "entry",
  standard: "entry",
  extraction: "entry",
  "extraction-beacon": "entry",
  emergency: "emergency",
  "emergency-extraction": "emergency",
});

const WORLD_EVENT_LIBRARY = Object.freeze([
  Object.freeze({
    type: "field-cache",
    name: "遗落补给箱",
    icon: "▣",
    danger: "轻微动静",
    description: "一只没有登记在路线记录里的旧补给箱，开启时可能暴露位置。",
    effect: Object.freeze({ supply: 1, threatDelta: 2 }),
  }),
  Object.freeze({
    type: "recon-beacon",
    name: "失效侦察站",
    icon: "⌁",
    danger: "情报",
    description: "重新校准侦察站，可以压低当前警戒并扩大附近视野。",
    effect: Object.freeze({ threatDelta: -5, revealBoost: 1 }),
  }),
  Object.freeze({
    type: "insured-stash",
    name: "密封安全袋",
    icon: "▤",
    danger: "保险 · 定位脉冲",
    description: "还能使用一次的密封袋，可以保护一件战利品；启用时会发出定位脉冲并提高警戒。",
    effect: Object.freeze({ insurance: 1, threatDelta: 5 }),
  }),
  Object.freeze({
    type: "lost-cargo",
    name: "坠毁货箱",
    icon: "◆",
    danger: "高价值信号",
    description: "货箱仍有能量反应。强行开启会显著提高警戒，但可能找到稀有物资。",
    effect: Object.freeze({ lootCount: 1, lootQuality: 2, threatDelta: 6 }),
  }),
  Object.freeze({
    type: "quiet-trail",
    name: "隐蔽兽径",
    icon: "⌇",
    danger: "捷径",
    description: "宠物发现了一条避开巡逻视线的旧路，可降低返程暴露。",
    effect: Object.freeze({ threatDelta: -3, stealth: 1 }),
  }),
]);

const EVENT_ANCHORS = Object.freeze([
  [760, 250],
  [860, 1580],
  [1280, 280],
  [1460, 1640],
  [1880, 260],
  [2100, 1630],
  [2460, 300],
  [2600, 1650],
]);

export class ExpeditionWorldSystem {
  constructor({
    width = 3000,
    height = 1900,
    cellSize = 180,
    revealRadius = 290,
    interactionRadius = 92,
  } = {}) {
    this.width = Math.max(1200, Math.floor(width));
    this.height = Math.max(900, Math.floor(height));
    this.cellSize = Math.max(80, Math.floor(cellSize));
    this.revealRadius = Math.max(120, Math.floor(revealRadius));
    this.interactionRadius = Math.max(48, Math.floor(interactionRadius));
    this.spawnPoint = { x: 280, y: Math.floor(this.height / 2) };
    this.extractionPoint = { x: 310, y: Math.floor(this.height / 2) };
    this.obstacles = DEFAULT_OBSTACLES.map((obstacle) => ({ ...obstacle }));
    this.runSeed = 1;
    this.reset();
  }

  reset() {
    this.initialized = false;
    this.locations = new Map();
    this.containers = new Map();
    this.revealedCells = new Set();
    this.activeLocationId = null;
    this.activeContainerSearchId = null;
    this.navigationTargetId = null;
    this.nearbyLocationId = null;
    this.nearbyContainerId = null;
    this.distanceTravelled = 0;
    this.lastPlayerPosition = null;
    this.extractionUnlocked = false;
    this.extractionAvailability = { entry: false, emergency: false };
    this.activeExtractionLocationId = null;
    this.consumedWorldEvents = 0;
    this.discoveryMilestones = new Set();
    this.obstacles = DEFAULT_OBSTACLES.map((obstacle) => ({ ...obstacle }));
    this.createExtractionLocations();
  }

  startRun(routeChoices = [], { seed = null } = {}) {
    this.reset();
    this.runSeed = this.normalizeSeed(seed ?? this.deriveSeed(routeChoices));
    this.obstacles = this.buildRunObstacles();
    this.initialized = true;
    this.createWorldEvents();
    this.syncRouteChoices(routeChoices);
    this.updateDiscovery(this.spawnPoint.x, this.spawnPoint.y);
    return this.getState(this.spawnPoint);
  }

  normalizeSeed(seed) {
    const numeric = Math.floor(Number(seed) || 1) >>> 0;
    return numeric || 1;
  }

  deriveSeed(routeChoices = []) {
    const source = routeChoices.map((node) => node.id).join("|") || "petplan-expedition";
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  seededValue(salt = 0) {
    let value = (this.runSeed + Math.imul(Math.floor(salt) + 1, 0x9e3779b1)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    value ^= value >>> 16;
    return (value >>> 0) / 4294967296;
  }

  buildRunObstacles() {
    const obstacles = DEFAULT_OBSTACLES.map((obstacle, index) => {
      const jitterX = (this.seededValue(100 + index * 2) - 0.5) * 70;
      const jitterY = (this.seededValue(101 + index * 2) - 0.5) * 90;
      return {
        ...obstacle,
        x: Math.max(90, Math.min(this.width - obstacle.width - 90, Math.round(obstacle.x + jitterX))),
        y: Math.max(90, Math.min(this.height - obstacle.height - 90, Math.round(obstacle.y + jitterY))),
      };
    });
    return this.ensureNavigableObstacles(obstacles);
  }

  /**
   * 西侧废墟过去可能正好压在出生点的水平出口上，首屏体验会像被墙封住。
   * 先为出生点留出一段明确的东向出口；若未来障碍配置变密，再用寻路检查和
   * 水平通道兜底，保证任何种子都至少存在一条能抵达地图东侧的路线。
   */
  ensureNavigableObstacles(obstacles = []) {
    const normalized = obstacles.map((obstacle) => ({ ...obstacle }));
    const westRuin = normalized.find((obstacle) => obstacle.id === "ruin-west");
    if (westRuin) {
      const egressHalfHeight = 72;
      const blocksInitialEgress = (
        westRuin.x <= this.spawnPoint.x + 430
        && westRuin.x + westRuin.width >= this.spawnPoint.x + 30
        && westRuin.y < this.spawnPoint.y + egressHalfHeight
        && westRuin.y + westRuin.height > this.spawnPoint.y - egressHalfHeight
      );
      if (blocksInitialEgress) {
        const gap = 28;
        const upperY = this.spawnPoint.y - egressHalfHeight - westRuin.height - gap;
        const lowerY = this.spawnPoint.y + egressHalfHeight + gap;
        const candidates = [upperY, lowerY]
          .filter((y) => y >= 90 && y <= this.height - westRuin.height - 90);
        const candidateIndex = Math.floor(this.seededValue(1901) * Math.max(1, candidates.length));
        westRuin.y = Math.round(candidates[candidateIndex] ?? Math.max(90, upperY));
      }
    }

    if (this.hasNavigableChannelToEast(normalized)) return normalized;

    // 极端或未来新增障碍导致寻路失败时，清出一条以出生点为中心的保底通道。
    const corridorHalfHeight = 86;
    normalized.forEach((obstacle, index) => {
      const overlapsCorridor = (
        obstacle.y < this.spawnPoint.y + corridorHalfHeight
        && obstacle.y + obstacle.height > this.spawnPoint.y - corridorHalfHeight
      );
      if (!overlapsCorridor) return;
      const gap = 24;
      const upperY = this.spawnPoint.y - corridorHalfHeight - obstacle.height - gap;
      const lowerY = this.spawnPoint.y + corridorHalfHeight + gap;
      const candidates = [upperY, lowerY]
        .filter((y) => y >= 90 && y <= this.height - obstacle.height - 90);
      if (candidates.length === 0) return;
      const pick = Math.floor(this.seededValue(2000 + index) * candidates.length);
      obstacle.y = Math.round(candidates[pick]);
    });
    return normalized;
  }

  /**
   * 使用保守的 40px 角色占地进行网格寻路。该方法也用于确定性测试，避免只检查
   * 某一个种子的障碍位置而漏掉偶发封路。
   */
  hasNavigableChannelToEast(obstacles = this.obstacles, {
    entitySize = 40,
    gridSize = 40,
  } = {}) {
    const halfSize = Math.max(8, Number(entitySize) / 2 || 20);
    const step = Math.max(24, Math.floor(Number(gridSize) || 40));
    const padding = 18;
    const minX = padding + halfSize;
    const minY = padding + halfSize;
    const maxX = this.width - padding - halfSize;
    const maxY = this.height - padding - halfSize;
    const columns = Math.max(1, Math.floor((maxX - minX) / step) + 1);
    const rows = Math.max(1, Math.floor((maxY - minY) / step) + 1);
    const toColumn = (x) => Math.max(0, Math.min(columns - 1, Math.round((x - minX) / step)));
    const toRow = (y) => Math.max(0, Math.min(rows - 1, Math.round((y - minY) / step)));
    const centerAt = (column, row) => ({ x: minX + column * step, y: minY + row * step });
    const collisionReach = Math.max(8, halfSize - 5 + 6);
    const isPassable = (column, row) => {
      const center = centerAt(column, row);
      return !(obstacles || []).some((obstacle) => (
        center.x + collisionReach > obstacle.x
        && center.x - collisionReach < obstacle.x + obstacle.width
        && center.y + collisionReach > obstacle.y
        && center.y - collisionReach < obstacle.y + obstacle.height
      ));
    };

    const startColumn = toColumn(this.spawnPoint.x);
    const startRow = toRow(this.spawnPoint.y);
    if (!isPassable(startColumn, startRow)) return false;
    const queue = [[startColumn, startRow]];
    const visited = new Set([`${startColumn},${startRow}`]);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const [column, row] = queue[cursor];
      if (centerAt(column, row).x >= maxX - step) return true;
      for (const [nextColumn, nextRow] of [
        [column + 1, row],
        [column - 1, row],
        [column, row + 1],
        [column, row - 1],
      ]) {
        if (nextColumn < 0 || nextColumn >= columns || nextRow < 0 || nextRow >= rows) continue;
        const key = `${nextColumn},${nextRow}`;
        if (visited.has(key) || !isPassable(nextColumn, nextRow)) continue;
        visited.add(key);
        queue.push([nextColumn, nextRow]);
      }
    }
    return false;
  }

  createWorldEvents() {
    const eventCount = Math.min(6, EVENT_ANCHORS.length);
    let insuredStashCount = 0;
    for (let index = 0; index < eventCount; index += 1) {
      const anchorIndex = (index + Math.floor(this.seededValue(300) * EVENT_ANCHORS.length)) % EVENT_ANCHORS.length;
      const [anchorX, anchorY] = EVENT_ANCHORS[anchorIndex];
      const templateIndex = Math.floor(this.seededValue(320 + index) * WORLD_EVENT_LIBRARY.length);
      let template = WORLD_EVENT_LIBRARY[templateIndex] || WORLD_EVENT_LIBRARY[0];
      if (template.type === "insured-stash" && insuredStashCount >= 1) {
        const alternatives = WORLD_EVENT_LIBRARY.filter((entry) => entry.type !== "insured-stash");
        const alternativeIndex = Math.floor(this.seededValue(380 + index) * alternatives.length);
        template = alternatives[alternativeIndex] || alternatives[0];
      }
      if (template.type === "insured-stash") insuredStashCount += 1;
      const x = Math.max(100, Math.min(this.width - 100, anchorX + Math.round((this.seededValue(340 + index) - 0.5) * 150)));
      const y = Math.max(100, Math.min(this.height - 100, anchorY + Math.round((this.seededValue(360 + index) - 0.5) * 160)));
      const id = `world-event-${index + 1}`;
      this.locations.set(id, {
        id,
        nodeId: null,
        kind: "world-event",
        type: template.type,
        name: template.name,
        description: template.description,
        icon: template.icon,
        danger: template.danger,
        effect: { ...template.effect },
        x,
        y,
        radius: 34,
        state: "available",
        discovered: false,
        known: false,
        optional: true,
        color: LOCATION_COLORS.event,
      });
    }
  }

  createExtractionLocations() {
    if (!this.locations.has("extraction-beacon")) {
      this.locations.set("extraction-beacon", {
        id: "extraction-beacon",
        nodeId: null,
        kind: "extraction",
        type: "extraction",
        extractionType: "entry",
        name: "入口撤离信标",
        description: "探索 3 个区域后返回这里，可以启动低压力的最终撤离。",
        icon: "⇥",
        danger: "尚未定位",
        x: this.extractionPoint.x,
        y: this.extractionPoint.y,
        radius: 54,
        state: "locked",
        discovered: true,
        known: true,
        color: LOCATION_COLORS.extraction,
      });
    }
    if (!this.locations.has("emergency-extraction")) {
      this.locations.set("emergency-extraction", {
        id: "emergency-extraction",
        nodeId: null,
        kind: "extraction",
        type: "extraction",
        extractionType: "emergency",
        name: "深区应急撤离点",
        description: "深入 5 个区域后可用。消耗 1 份补给，无需折返入口，但守点更久、敌人更密集。",
        icon: "⇱",
        danger: "深区信号未激活",
        x: Math.min(this.width - 180, 2420),
        y: Math.min(this.height - 150, 1680),
        radius: 58,
        state: "locked",
        discovered: false,
        known: true,
        optional: true,
        color: "#ffb36b",
      });
    }
    return this.getExtractionLocations();
  }

  // 兼容旧调用：现在会确保两个撤离点都存在，并返回入口信标。
  createExtractionLocation() {
    this.createExtractionLocations();
    return this.locations.get("extraction-beacon") || null;
  }

  syncRouteChoices(routeChoices = []) {
    const incomingIds = new Set(routeChoices.map((node) => node.id));
    for (const location of this.locations.values()) {
      if (
        location.kind === "route" &&
        location.state === "available" &&
        !incomingIds.has(location.nodeId)
      ) {
        location.state = "missed";
      }
    }

    routeChoices.forEach((node, index) => {
      if (this.getLocationByNodeId(node.id)) return;
      const [x, y] = this.getSlot(node.depth, node.branch ?? index);
      this.locations.set(`location-${node.id}`, {
        id: `location-${node.id}`,
        nodeId: node.id,
        kind: "route",
        type: node.type,
        name: node.name,
        description: node.description,
        icon: node.icon,
        danger: node.danger,
        depth: node.depth,
        branch: node.branch ?? index,
        x,
        y,
        radius: node.type === "boss" ? 68 : 50,
        state: "available",
        discovered: false,
        known: false,
        color: LOCATION_COLORS[node.type] || "#ffd167",
      });
    });

    if (!this.navigationTargetId) {
      const first = routeChoices[0] ? this.getLocationByNodeId(routeChoices[0].id) : null;
      this.navigationTargetId = first?.id || null;
    }
    return this.getAvailableLocations();
  }

  getSlot(depth, branch = 0) {
    const slots = ROUTE_SLOTS[depth] || ROUTE_SLOTS[8];
    const slot = slots[Math.max(0, Math.min(slots.length - 1, branch))] || slots[0];
    const salt = Math.max(1, Number(depth) || 1) * 17 + Math.max(0, Number(branch) || 0) * 7;
    const jitterX = depth >= 8 ? 0 : (this.seededValue(400 + salt) - 0.5) * 90;
    const jitterY = depth >= 8 ? 0 : (this.seededValue(500 + salt) - 0.5) * 220;
    return [
      Math.max(80, Math.min(this.width - 80, Math.round(slot[0] + jitterX))),
      Math.max(80, Math.min(this.height - 80, Math.round(slot[1] + jitterY))),
    ];
  }

  getLocationByNodeId(nodeId) {
    for (const location of this.locations.values()) {
      if (location.nodeId === nodeId) return location;
    }
    return null;
  }

  getLocation(locationId) {
    return this.locations.get(locationId) || null;
  }

  normalizeExtractionType(extraction = "entry") {
    const candidate = typeof extraction === "object" && extraction
      ? extraction.extractionType || extraction.type || extraction.locationId || extraction.id
      : extraction;
    return EXTRACTION_ALIASES[String(candidate || "entry")] || null;
  }

  getExtractionRule(extraction = "entry") {
    const extractionType = this.normalizeExtractionType(extraction);
    return extractionType ? { ...WORLD_EXTRACTION_RULES[extractionType] } : null;
  }

  getExtractionLocations() {
    return Array.from(this.locations.values())
      .filter(location => location.kind === "extraction")
      .map(location => ({ ...location }));
  }

  getExtractionAvailability(extraction = "entry", {
    depth = 0,
    supplies = 0,
    active = true,
    phase = "route",
  } = {}) {
    const rule = this.getExtractionRule(extraction);
    if (!rule) return { canExtract: false, reason: "unknown-extraction", rule: null };
    const location = this.locations.get(rule.locationId) || null;
    if (!active) return { canExtract: false, reason: "inactive", rule, location };
    if (!["route", "extraction-ready"].includes(phase)) {
      return { canExtract: false, reason: "invalid-phase", rule, location };
    }
    if (Number(depth) < rule.minDepth) {
      return { canExtract: false, reason: "depth", rule, location };
    }
    if (Number(supplies) < rule.supplyCost) {
      return { canExtract: false, reason: "supplies", rule, location };
    }
    return { canExtract: true, reason: null, rule, location };
  }

  canExtractAt(extraction = "entry", runState = {}) {
    return this.getExtractionAvailability(extraction, runState).canExtract;
  }

  getAvailableLocations() {
    return Array.from(this.locations.values()).filter((location) => (
      location.state === "available" || location.state === "unlocked"
    ));
  }

  createContainersForLocation(locationOrId) {
    const location = typeof locationOrId === "string"
      ? this.locations.get(locationOrId) || this.getLocationByNodeId(locationOrId)
      : locationOrId;
    if (!location || location.kind !== "route" || !["search", "cache"].includes(location.type)) return [];
    const existing = this.getContainersForLocation(location.id);
    if (existing.length > 0) return existing;

    const count = 1;
    let salt = 0;
    for (let index = 0; index < location.id.length; index += 1) {
      salt = (Math.imul(salt, 31) + location.id.charCodeAt(index)) >>> 0;
    }
    for (let index = 0; index < count; index += 1) {
      const size = 30;
      const angle = this.seededValue(700 + salt + index * 19) * Math.PI * 2;
      const distance = 68 + this.seededValue(710 + salt + index * 23) * 42;
      const openPosition = this.findOpenPositionNear(
        { x: location.x - size / 2, y: location.y - size / 2 },
        distance,
        angle,
        size,
      );
      const id = `container-${location.id}-${index + 1}`;
      this.containers.set(id, {
        id,
        kind: "container",
        locationId: location.id,
        nodeId: location.nodeId,
        type: location.type === "cache" ? "sealed-crate" : "supply-crate",
        name: location.type === "cache" ? "密封货箱" : "物资搜索点",
        x: openPosition.x + size / 2,
        y: openPosition.y + size / 2,
        radius: 24,
        interactionRadius: 48,
        state: "available",
        discovered: true,
        color: LOCATION_COLORS.container,
      });
    }
    return this.getContainersForLocation(location.id);
  }

  getContainer(containerId) {
    return this.containers.get(containerId) || null;
  }

  getContainersForLocation(locationOrNodeId, { includeFinished = true } = {}) {
    const location = this.locations.get(locationOrNodeId) || this.getLocationByNodeId(locationOrNodeId);
    const locationId = location?.id || String(locationOrNodeId || "");
    return Array.from(this.containers.values())
      .filter((container) => container.locationId === locationId)
      .filter((container) => includeFinished || ["available", "searching"].includes(container.state));
  }

  getContainerSearchContext(containerId) {
    const container = this.containers.get(containerId);
    if (!container) return null;
    const remainingContainers = this.getContainersForLocation(container.locationId, { includeFinished: false });
    return {
      containerId: container.id,
      locationId: container.locationId,
      nodeId: container.nodeId,
      remainingContainerCount: remainingContainers.length,
      isLastContainer: remainingContainers.length <= 1,
      completeNode: remainingContainers.length <= 1,
    };
  }

  isLocationKnown(location) {
    return Boolean(
      location
      && (location.kind === "extraction" || location.known === true || location.discovered === true)
    );
  }

  getNavigationTargetSnapshot(location, playerPosition = this.lastPlayerPosition || this.spawnPoint) {
    if (!location) return null;
    const known = this.isLocationKnown(location);
    const snapshot = {
      ...location,
      known: location.kind === "extraction" ? true : Boolean(location.known),
      discovered: Boolean(location.discovered),
      distance: Math.round(this.getDistanceToLocation(
        location.id,
        Number(playerPosition?.x) || 0,
        Number(playerPosition?.y) || 0,
      )),
    };
    if (!known) {
      snapshot.name = "未知信号";
      snapshot.description = "尚未进入侦察范围，只能确认信号方向。";
      snapshot.icon = "?";
      snapshot.danger = "风险待侦察";
      snapshot.color = "#ffd167";
    }
    return snapshot;
  }

  findNearbyContainer(x, y, { locationId = this.activeLocationId } = {}) {
    return Array.from(this.containers.values())
      .filter((container) => !locationId || container.locationId === locationId)
      .filter((container) => ["available", "searching"].includes(container.state))
      .map((container) => ({
        container,
        distance: Math.hypot(container.x - x, container.y - y),
      }))
      .filter((item) => item.distance <= (item.container.interactionRadius || 48) + item.container.radius)
      .sort((a, b) => a.distance - b.distance)[0]?.container || null;
  }

  beginContainerSearch(containerId = this.nearbyContainerId) {
    const container = this.containers.get(containerId);
    if (!container || container.locationId !== this.activeLocationId || container.state !== "available") {
      return { success: false, message: "附近没有可搜索的容器" };
    }
    if (this.lastPlayerPosition) {
      const distance = Math.hypot(
        container.x - this.lastPlayerPosition.x,
        container.y - this.lastPlayerPosition.y,
      );
      if (distance > (container.interactionRadius || 48) + container.radius) {
        return { success: false, message: "需要靠近容器才能搜索" };
      }
    }
    if (this.activeContainerSearchId && this.activeContainerSearchId !== container.id) {
      return { success: false, message: "另一个容器正在搜索中" };
    }
    container.state = "searching";
    this.activeContainerSearchId = container.id;
    return {
      success: true,
      message: `开始搜索：${container.name}`,
      container: { ...container },
      context: this.getContainerSearchContext(container.id),
    };
  }

  cancelContainerSearch(containerId = this.activeContainerSearchId, reason = "cancelled") {
    const container = this.containers.get(containerId);
    if (!container || container.state !== "searching") {
      return { success: false, message: "当前没有可中断的容器搜索" };
    }
    container.state = "available";
    if (this.activeContainerSearchId === container.id) this.activeContainerSearchId = null;
    return { success: true, cancelled: true, reason, container: { ...container } };
  }

  completeContainerSearch(containerId = this.activeContainerSearchId) {
    const container = this.containers.get(containerId);
    if (!container || container.state !== "searching") {
      return { success: false, message: "该容器并未处于搜索中" };
    }
    container.state = "searched";
    if (this.activeContainerSearchId === container.id) this.activeContainerSearchId = null;
    if (this.nearbyContainerId === container.id) this.nearbyContainerId = null;
    const remainingContainers = this.getContainersForLocation(container.locationId, { includeFinished: false });
    return {
      success: true,
      completed: true,
      container: { ...container },
      remainingContainerCount: remainingContainers.length,
      allContainersSearched: remainingContainers.length === 0,
    };
  }

  trackLocation(nodeOrLocationId) {
    const location = this.locations.get(nodeOrLocationId)
      || this.getLocationByNodeId(nodeOrLocationId);
    if (!location || !["available", "unlocked", "engaged"].includes(location.state)) {
      return { success: false, message: "该地点当前不可追踪" };
    }
    this.navigationTargetId = location.id;
    const navigationTarget = this.getNavigationTargetSnapshot(location);
    return {
      success: true,
      message: `已追踪：${navigationTarget.name}`,
      location: { ...navigationTarget },
      navigationTarget: { ...navigationTarget },
      navigationTargetId: location.id,
    };
  }

  consumeWorldEvent(locationId = this.nearbyLocationId) {
    const location = this.locations.get(locationId);
    if (!location || location.kind !== "world-event" || location.state !== "available") {
      return { success: false, message: "附近没有可调查的支线事件" };
    }
    location.state = "cleared";
    location.discovered = true;
    location.known = true;
    this.consumedWorldEvents += 1;
    const reveal = location.effect?.revealBoost
      ? this.applyRevealBoost(location.x, location.y, location.effect.revealBoost)
      : null;
    if (this.navigationTargetId === location.id) this.navigationTargetId = null;
    if (this.nearbyLocationId === location.id) this.nearbyLocationId = null;
    return {
      success: true,
      message: `已调查：${location.name}`,
      location: { ...location },
      effect: { ...(location.effect || {}) },
      reveal,
    };
  }

  applyRevealBoost(x, y, boost = 1) {
    const normalizedBoost = Math.max(0, Math.min(3, Number(boost) || 0));
    if (normalizedBoost <= 0) {
      return { applied: false, radius: this.revealRadius, revealedCells: 0, revealedLocations: 0 };
    }
    const cellsBefore = this.revealedCells.size;
    const knownBefore = Array.from(this.locations.values()).filter((location) => location.known).length;
    const radius = Math.round(this.revealRadius * (1 + normalizedBoost));
    this.updateDiscovery(x, y, { radius });
    const knownAfter = Array.from(this.locations.values()).filter((location) => location.known).length;
    return {
      applied: true,
      radius,
      revealedCells: Math.max(0, this.revealedCells.size - cellsBefore),
      revealedLocations: Math.max(0, knownAfter - knownBefore),
    };
  }

  engageLocation(nodeId) {
    const location = this.getLocationByNodeId(nodeId);
    if (!location || location.state !== "available") {
      return { success: false, message: "该地点已经无法进入" };
    }
    for (const other of this.locations.values()) {
      if (
        other.kind === "route" &&
        other.depth === location.depth &&
        other.id !== location.id &&
        other.state === "available"
      ) {
        other.state = "missed";
      }
    }
    location.state = "engaged";
    location.discovered = true;
    location.known = true;
    this.activeLocationId = location.id;
    this.navigationTargetId = location.id;
    const containers = this.createContainersForLocation(location);
    return {
      success: true,
      location: { ...location },
      containers: containers.map((container) => ({ ...container })),
    };
  }

  completeActiveLocation() {
    const location = this.locations.get(this.activeLocationId);
    if (!location) return null;
    for (const container of this.getContainersForLocation(location.id)) {
      if (["available", "searching"].includes(container.state)) container.state = "abandoned";
    }
    if (this.activeContainerSearchId && this.containers.get(this.activeContainerSearchId)?.locationId === location.id) {
      this.activeContainerSearchId = null;
    }
    location.state = "cleared";
    location.discovered = true;
    location.known = true;
    this.activeLocationId = null;
    if (this.activeExtractionLocationId === location.id) this.activeExtractionLocationId = null;
    if (this.navigationTargetId === location.id) this.navigationTargetId = null;
    return { ...location };
  }

  setExtractionUnlocked(unlocked, extraction = "entry") {
    const extractionType = this.normalizeExtractionType(extraction);
    if (!extractionType) return false;
    const rule = this.getExtractionRule(extractionType);
    if (!rule) return false;
    const isUnlocked = Boolean(unlocked);
    this.extractionAvailability[extractionType] = isUnlocked;
    if (extractionType === "entry") this.extractionUnlocked = isUnlocked;
    const location = this.locations.get(rule.locationId);
    if (location && location.state !== "engaged" && location.state !== "cleared") {
      location.state = isUnlocked ? "unlocked" : "locked";
      location.danger = isUnlocked
        ? (extractionType === "emergency" ? "高压撤离 · 消耗 1 补给" : "可撤离")
        : (extractionType === "emergency" ? "深区信号未激活" : "尚未定位");
    }
    return isUnlocked;
  }

  updateExtractionAvailability(runState = {}) {
    for (const extractionType of Object.keys(WORLD_EXTRACTION_RULES)) {
      const authoritativeAvailability = runState.extractionAvailability?.[extractionType];
      const availability = typeof authoritativeAvailability?.canExtract === "boolean"
        ? authoritativeAvailability
        : this.getExtractionAvailability(extractionType, runState);
      this.setExtractionUnlocked(availability.canExtract, extractionType);
    }
    return { ...this.extractionAvailability };
  }

  activateExtraction(extraction = "entry") {
    const rule = this.getExtractionRule(extraction);
    if (!rule) return null;
    const location = this.locations.get(rule.locationId);
    if (!location || location.state !== "unlocked") return null;
    location.state = "engaged";
    this.activeLocationId = location.id;
    this.activeExtractionLocationId = location.id;
    this.navigationTargetId = location.id;
    return { ...location };
  }

  updateDiscovery(x, y, { radius = this.revealRadius } = {}) {
    const effectiveRadius = Math.max(this.revealRadius, Number(radius) || this.revealRadius);
    const columns = Math.ceil(this.width / this.cellSize);
    const rows = Math.ceil(this.height / this.cellSize);
    const centerColumn = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);
    const cellRadius = Math.ceil(effectiveRadius / this.cellSize);
    for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row += 1) {
      if (row < 0 || row >= rows) continue;
      for (let column = centerColumn - cellRadius; column <= centerColumn + cellRadius; column += 1) {
        if (column < 0 || column >= columns) continue;
        const cellX = (column + 0.5) * this.cellSize;
        const cellY = (row + 0.5) * this.cellSize;
        if (Math.hypot(cellX - x, cellY - y) <= effectiveRadius + this.cellSize * 0.7) {
          this.revealedCells.add(`${column},${row}`);
        }
      }
    }

    for (const location of this.locations.values()) {
      if (Math.hypot(location.x - x, location.y - y) <= effectiveRadius) {
        location.discovered = true;
        location.known = true;
      }
    }
    for (const container of this.containers.values()) {
      if (Math.hypot(container.x - x, container.y - y) <= effectiveRadius) container.discovered = true;
    }

    const percent = this.getExplorationPercent();
    [20, 40, 60, 80].forEach((milestone) => {
      if (percent >= milestone) this.discoveryMilestones.add(milestone);
    });
  }

  updatePlayerPosition(x, y) {
    if (this.lastPlayerPosition) {
      this.distanceTravelled += Math.hypot(x - this.lastPlayerPosition.x, y - this.lastPlayerPosition.y);
    }
    this.lastPlayerPosition = { x, y };
    this.updateDiscovery(x, y);
    const nearby = this.findNearbyLocation(x, y);
    this.nearbyLocationId = nearby?.id || null;
    const nearbyContainer = this.findNearbyContainer(x, y);
    this.nearbyContainerId = nearbyContainer?.id || null;
    return nearby ? { ...nearby } : null;
  }

  findNearbyLocation(x, y) {
    return Array.from(this.locations.values())
      .filter((location) => ["available", "unlocked"].includes(location.state))
      .map((location) => ({
        location,
        distance: Math.hypot(location.x - x, location.y - y),
      }))
      .filter((item) => item.distance <= this.interactionRadius + item.location.radius)
      .sort((a, b) => a.distance - b.distance)[0]?.location || null;
  }

  moveEntity(entity, deltaX, deltaY, { padding = 18 } = {}) {
    if (!entity) return { moved: false, blockedX: false, blockedY: false };
    const originalX = entity.x;
    const originalY = entity.y;
    const maxX = this.width - (entity.width || 0) - padding;
    const maxY = this.height - (entity.height || 0) - padding;
    const safeDeltaX = Number.isFinite(Number(deltaX)) ? Number(deltaX) : 0;
    const safeDeltaY = Number.isFinite(Number(deltaY)) ? Number(deltaY) : 0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(safeDeltaX), Math.abs(safeDeltaY)) / 22));
    const stepX = safeDeltaX / steps;
    const stepY = safeDeltaY / steps;
    let blockedX = false;
    let blockedY = false;

    for (let step = 0; step < steps; step += 1) {
      const previousX = entity.x;
      entity.x = Math.max(padding, Math.min(maxX, entity.x + stepX));
      if (this.collidesWithObstacle(entity)) {
        entity.x = previousX;
        blockedX = true;
      }

      const previousY = entity.y;
      entity.y = Math.max(padding, Math.min(maxY, entity.y + stepY));
      if (this.collidesWithObstacle(entity)) {
        entity.y = previousY;
        blockedY = true;
      }
    }

    return {
      moved: entity.x !== originalX || entity.y !== originalY,
      blockedX,
      blockedY,
      x: entity.x,
      y: entity.y,
    };
  }

  clampEntityToBounds(entity, { padding = 18 } = {}) {
    if (!entity) return { moved: false, x: 0, y: 0 };
    const originalX = Number.isFinite(Number(entity.x)) ? Number(entity.x) : 0;
    const originalY = Number.isFinite(Number(entity.y)) ? Number(entity.y) : 0;
    const entityWidth = Math.max(0, Number(entity.width) || 0);
    const entityHeight = Math.max(0, Number(entity.height) || 0);
    const numericPadding = Number(padding);
    const safePadding = Number.isFinite(numericPadding) ? Math.max(0, numericPadding) : 18;
    const maxX = Math.max(safePadding, this.width - entityWidth - safePadding);
    const maxY = Math.max(safePadding, this.height - entityHeight - safePadding);

    entity.x = Math.max(safePadding, Math.min(maxX, originalX));
    entity.y = Math.max(safePadding, Math.min(maxY, originalY));

    return {
      moved: entity.x !== originalX || entity.y !== originalY,
      x: entity.x,
      y: entity.y,
    };
  }

  collidesWithObstacle(entity) {
    const inset = 5;
    return this.obstacles.some((obstacle) => (
      entity.x + (entity.width || 0) - inset > obstacle.x &&
      entity.x + inset < obstacle.x + obstacle.width &&
      entity.y + (entity.height || 0) - inset > obstacle.y &&
      entity.y + inset < obstacle.y + obstacle.height
    ));
  }

  findOpenPositionNear(origin, distance = 360, angle = 0, size = 40) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const currentAngle = angle + attempt * Math.PI * 0.37;
      const currentDistance = distance + (attempt % 3) * 45;
      const candidate = {
        x: Math.max(24, Math.min(this.width - size - 24, origin.x + Math.cos(currentAngle) * currentDistance)),
        y: Math.max(24, Math.min(this.height - size - 24, origin.y + Math.sin(currentAngle) * currentDistance)),
        width: size,
        height: size,
      };
      if (!this.collidesWithObstacle(candidate)) return { x: candidate.x, y: candidate.y };
    }
    return {
      x: Math.max(24, Math.min(this.width - size - 24, origin.x + distance)),
      y: Math.max(24, Math.min(this.height - size - 24, origin.y)),
    };
  }

  getDistanceToLocation(locationId, x, y) {
    const location = this.locations.get(locationId);
    if (!location) return Infinity;
    return Math.hypot(location.x - x, location.y - y);
  }

  getExplorationPercent() {
    const totalCells = Math.ceil(this.width / this.cellSize) * Math.ceil(this.height / this.cellSize);
    return totalCells > 0 ? Math.min(100, (this.revealedCells.size / totalCells) * 100) : 0;
  }

  isPointRevealed(x, y) {
    const column = Math.floor(Number(x) / this.cellSize);
    const row = Math.floor(Number(y) / this.cellSize);
    return this.revealedCells.has(`${column},${row}`);
  }

  isAreaRevealed({ x = 0, y = 0, width = 0, height = 0 } = {}) {
    const minColumn = Math.floor(x / this.cellSize);
    const maxColumn = Math.floor((x + width) / this.cellSize);
    const minRow = Math.floor(y / this.cellSize);
    const maxRow = Math.floor((y + height) / this.cellSize);
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        if (this.revealedCells.has(`${column},${row}`)) return true;
      }
    }
    return false;
  }

  getState(playerPosition = this.spawnPoint) {
    const navigationTarget = this.locations.get(this.navigationTargetId) || null;
    const nearbyLocation = this.locations.get(this.nearbyLocationId) || null;
    const nearbyContainer = this.containers.get(this.nearbyContainerId) || null;
    const activeContainerSearch = this.containers.get(this.activeContainerSearchId) || null;
    return {
      initialized: this.initialized,
      width: this.width,
      height: this.height,
      spawnPoint: { ...this.spawnPoint },
      extractionUnlocked: this.extractionUnlocked,
      extractionAvailability: { ...this.extractionAvailability },
      activeExtractionLocationId: this.activeExtractionLocationId,
      extractionRules: Object.fromEntries(
        Object.keys(WORLD_EXTRACTION_RULES).map(id => [id, this.getExtractionRule(id)]),
      ),
      extractionLocations: this.getExtractionLocations(),
      runSeed: this.runSeed,
      explorationPercent: Number(this.getExplorationPercent().toFixed(1)),
      distanceTravelled: Math.floor(this.distanceTravelled),
      consumedWorldEvents: this.consumedWorldEvents,
      discoveryMilestones: Array.from(this.discoveryMilestones).sort((a, b) => a - b),
      revealedCells: Array.from(this.revealedCells),
      obstacles: this.obstacles.map((obstacle) => ({ ...obstacle })),
      locations: Array.from(this.locations.values()).map((location) => ({ ...location })),
      containers: Array.from(this.containers.values()).map((container) => ({ ...container })),
      nearbyLocation: nearbyLocation ? { ...nearbyLocation } : null,
      nearbyContainer: nearbyContainer ? { ...nearbyContainer } : null,
      activeContainerSearch: activeContainerSearch ? {
        ...activeContainerSearch,
        context: this.getContainerSearchContext(activeContainerSearch.id),
      } : null,
      navigationTarget: this.getNavigationTargetSnapshot(navigationTarget, playerPosition),
    };
  }

  getRunSaveData() {
    if (!this.initialized) return null;
    return {
      initialized: true,
      runSeed: this.runSeed,
      locations: Array.from(this.locations.values()).map((location) => ({
        ...location,
        effect: location.effect ? { ...location.effect } : undefined,
      })),
      containers: Array.from(this.containers.values()).map((container) => ({ ...container })),
      revealedCells: Array.from(this.revealedCells),
      activeLocationId: this.activeLocationId,
      activeContainerSearchId: this.activeContainerSearchId,
      navigationTargetId: this.navigationTargetId,
      nearbyLocationId: this.nearbyLocationId,
      nearbyContainerId: this.nearbyContainerId,
      distanceTravelled: this.distanceTravelled,
      lastPlayerPosition: this.lastPlayerPosition ? { ...this.lastPlayerPosition } : null,
      extractionUnlocked: this.extractionUnlocked,
      extractionAvailability: { ...this.extractionAvailability },
      activeExtractionLocationId: this.activeExtractionLocationId,
      consumedWorldEvents: this.consumedWorldEvents,
      discoveryMilestones: Array.from(this.discoveryMilestones),
      obstacles: this.obstacles.map((obstacle) => ({ ...obstacle })),
    };
  }

  loadRunSaveData(data) {
    if (!data || data.initialized !== true || !Array.isArray(data.locations)) {
      return { success: false, message: "没有可恢复的远征世界" };
    }
    this.reset();
    this.initialized = true;
    this.runSeed = this.normalizeSeed(data.runSeed);
    this.locations = new Map(data.locations
      .filter((location) => location && typeof location.id === "string")
      .map((location) => [location.id, {
        ...location,
        discovered: Boolean(location.discovered),
        known: location.kind === "extraction"
          ? true
          : (typeof location.known === "boolean" ? location.known : Boolean(location.discovered)),
        effect: location.effect ? { ...location.effect } : undefined,
      }]));
    this.containers = new Map((Array.isArray(data.containers) ? data.containers : [])
      .filter((container) => container && typeof container.id === "string")
      .map((container) => [container.id, { ...container }]));
    // 旧存档可能在同一地点保存 2–3 个容器。恢复时保留仍在搜索或尚未搜索的一个，
    // 并把旧 ID 映射到该实体，确保新规则下每个 POI 只发生一次搜索交互。
    const containerAliases = new Map();
    const containersByLocation = new Map();
    for (const container of this.containers.values()) {
      const group = containersByLocation.get(container.locationId) || [];
      group.push(container);
      containersByLocation.set(container.locationId, group);
    }
    for (const group of containersByLocation.values()) {
      if (group.length <= 1) continue;
      const retained = group.find(container => container.id === data.activeContainerSearchId && container.state === "searching")
        || group.find(container => container.state === "searching")
        || group.find(container => container.id === data.nearbyContainerId && container.state === "available")
        || group.find(container => container.state === "available")
        || group.find(container => container.state === "searched")
        || group[0];
      for (const container of group) {
        containerAliases.set(container.id, retained.id);
        if (container.id !== retained.id) this.containers.delete(container.id);
      }
    }
    this.createExtractionLocations();
    this.revealedCells = new Set(Array.isArray(data.revealedCells) ? data.revealedCells : []);
    this.activeLocationId = this.locations.has(data.activeLocationId) ? data.activeLocationId : null;
    const restoredActiveContainerId = containerAliases.get(data.activeContainerSearchId) || data.activeContainerSearchId;
    this.activeContainerSearchId = this.containers.has(restoredActiveContainerId)
      && this.containers.get(restoredActiveContainerId).state === "searching"
      ? restoredActiveContainerId
      : null;
    this.navigationTargetId = this.locations.has(data.navigationTargetId) ? data.navigationTargetId : null;
    this.nearbyLocationId = this.locations.has(data.nearbyLocationId) ? data.nearbyLocationId : null;
    const restoredNearbyContainerId = containerAliases.get(data.nearbyContainerId) || data.nearbyContainerId;
    this.nearbyContainerId = this.containers.has(restoredNearbyContainerId) ? restoredNearbyContainerId : null;
    this.distanceTravelled = Math.max(0, Number(data.distanceTravelled) || 0);
    this.lastPlayerPosition = data.lastPlayerPosition
      ? { x: Number(data.lastPlayerPosition.x) || 0, y: Number(data.lastPlayerPosition.y) || 0 }
      : null;
    this.extractionUnlocked = Boolean(data.extractionUnlocked);
    this.extractionAvailability = {
      entry: Boolean(data.extractionAvailability?.entry ?? data.extractionUnlocked),
      emergency: Boolean(data.extractionAvailability?.emergency),
    };
    this.setExtractionUnlocked(this.extractionAvailability.entry, "entry");
    this.setExtractionUnlocked(this.extractionAvailability.emergency, "emergency");
    this.activeExtractionLocationId = this.locations.has(data.activeExtractionLocationId)
      ? data.activeExtractionLocationId
      : (this.locations.get(data.activeLocationId)?.kind === "extraction" ? data.activeLocationId : null);
    this.consumedWorldEvents = Math.max(0, Math.floor(Number(data.consumedWorldEvents) || 0));
    this.discoveryMilestones = new Set(Array.isArray(data.discoveryMilestones) ? data.discoveryMilestones : []);
    if (Array.isArray(data.obstacles) && data.obstacles.length > 0) {
      const savedObstacles = data.obstacles.map((obstacle) => ({ ...obstacle }));
      // 合法旧存档保持原有地形，只有真正不存在东向通路时才使用安全兜底。
      this.obstacles = this.hasNavigableChannelToEast(savedObstacles)
        ? savedObstacles
        : this.ensureNavigableObstacles(savedObstacles);
    } else {
      this.obstacles = this.buildRunObstacles();
    }
    return { success: true, message: "远征世界已恢复" };
  }
}
