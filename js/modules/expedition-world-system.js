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
});

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
    this.reset();
  }

  reset() {
    this.initialized = false;
    this.locations = new Map();
    this.revealedCells = new Set();
    this.activeLocationId = null;
    this.navigationTargetId = null;
    this.nearbyLocationId = null;
    this.distanceTravelled = 0;
    this.lastPlayerPosition = null;
    this.extractionUnlocked = false;
    this.createExtractionLocation();
  }

  startRun(routeChoices = []) {
    this.reset();
    this.initialized = true;
    this.syncRouteChoices(routeChoices);
    this.updateDiscovery(this.spawnPoint.x, this.spawnPoint.y);
    return this.getState(this.spawnPoint);
  }

  createExtractionLocation() {
    this.locations.set("extraction-beacon", {
      id: "extraction-beacon",
      nodeId: null,
      kind: "extraction",
      type: "extraction",
      name: "入口撤离信标",
      description: "探索 3 个区域后返回这里，可以启动最终撤离。",
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
    return [
      Math.max(80, Math.min(this.width - 80, slot[0])),
      Math.max(80, Math.min(this.height - 80, slot[1])),
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

  getAvailableLocations() {
    return Array.from(this.locations.values()).filter((location) => (
      location.state === "available" || location.state === "unlocked"
    ));
  }

  trackLocation(nodeOrLocationId) {
    const location = this.locations.get(nodeOrLocationId)
      || this.getLocationByNodeId(nodeOrLocationId);
    if (!location || !["available", "unlocked", "engaged"].includes(location.state)) {
      return { success: false, message: "该地点当前不可追踪" };
    }
    this.navigationTargetId = location.id;
    location.known = true;
    return { success: true, message: `已追踪：${location.name}`, location: { ...location } };
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
    this.activeLocationId = location.id;
    this.navigationTargetId = location.id;
    return { success: true, location: { ...location } };
  }

  completeActiveLocation() {
    const location = this.locations.get(this.activeLocationId);
    if (!location) return null;
    location.state = "cleared";
    location.discovered = true;
    this.activeLocationId = null;
    if (this.navigationTargetId === location.id) this.navigationTargetId = null;
    return { ...location };
  }

  setExtractionUnlocked(unlocked) {
    this.extractionUnlocked = Boolean(unlocked);
    const location = this.locations.get("extraction-beacon");
    if (location && location.state !== "engaged" && location.state !== "cleared") {
      location.state = this.extractionUnlocked ? "unlocked" : "locked";
      location.danger = this.extractionUnlocked ? "可撤离" : "尚未定位";
    }
    return this.extractionUnlocked;
  }

  activateExtraction() {
    const location = this.locations.get("extraction-beacon");
    if (!location || location.state !== "unlocked") return null;
    location.state = "engaged";
    this.activeLocationId = location.id;
    this.navigationTargetId = location.id;
    return { ...location };
  }

  updateDiscovery(x, y) {
    const columns = Math.ceil(this.width / this.cellSize);
    const rows = Math.ceil(this.height / this.cellSize);
    const centerColumn = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);
    const cellRadius = Math.ceil(this.revealRadius / this.cellSize);
    for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row += 1) {
      if (row < 0 || row >= rows) continue;
      for (let column = centerColumn - cellRadius; column <= centerColumn + cellRadius; column += 1) {
        if (column < 0 || column >= columns) continue;
        const cellX = (column + 0.5) * this.cellSize;
        const cellY = (row + 0.5) * this.cellSize;
        if (Math.hypot(cellX - x, cellY - y) <= this.revealRadius + this.cellSize * 0.7) {
          this.revealedCells.add(`${column},${row}`);
        }
      }
    }

    for (const location of this.locations.values()) {
      if (Math.hypot(location.x - x, location.y - y) <= this.revealRadius) {
        location.discovered = true;
        location.known = true;
      }
    }
  }

  updatePlayerPosition(x, y) {
    if (this.lastPlayerPosition) {
      this.distanceTravelled += Math.hypot(x - this.lastPlayerPosition.x, y - this.lastPlayerPosition.y);
    }
    this.lastPlayerPosition = { x, y };
    this.updateDiscovery(x, y);
    const nearby = this.findNearbyLocation(x, y);
    this.nearbyLocationId = nearby?.id || null;
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
    return {
      initialized: this.initialized,
      width: this.width,
      height: this.height,
      spawnPoint: { ...this.spawnPoint },
      extractionUnlocked: this.extractionUnlocked,
      explorationPercent: Number(this.getExplorationPercent().toFixed(1)),
      distanceTravelled: Math.floor(this.distanceTravelled),
      revealedCells: Array.from(this.revealedCells),
      obstacles: this.obstacles.map((obstacle) => ({ ...obstacle })),
      locations: Array.from(this.locations.values()).map((location) => ({ ...location })),
      nearbyLocation: nearbyLocation ? { ...nearbyLocation } : null,
      navigationTarget: navigationTarget ? {
        ...navigationTarget,
        distance: Math.round(this.getDistanceToLocation(navigationTarget.id, playerPosition.x, playerPosition.y)),
      } : null,
    };
  }
}
