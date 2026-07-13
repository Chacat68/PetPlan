/**
 * TerritoryWorldSystem - runtime-only horizontal base world.
 *
 * Persistent buildings and economy remain in TerritorySystem. This module only
 * owns movement, nearby-site detection, followers and short in-world actions.
 */

import {
  TERRITORY_BUILDING_SITES,
  TERRITORY_RANK_CONFIG,
} from "./progression-config.js?v=territory-world-20260712a";

export class TerritoryWorldSystem {
  constructor({ groundY = 610, interactionRadius = 132 } = {}) {
    this.height = 760;
    this.groundY = groundY;
    this.interactionRadius = interactionRadius;
    this.rank = 0;
    this.width = TERRITORY_RANK_CONFIG[0].worldWidth;
    this.spawnPoint = { x: 1080, y: groundY };
    this.gate = {
      id: "expedition_gate",
      type: "expedition_gate",
      name: "远征入口",
      icon: "⇥",
      x: 170,
      requiredRank: 1,
      path: "gate",
    };
    this.sites = [
      this.gate,
      ...Object.entries(TERRITORY_BUILDING_SITES).map(([type, site]) => ({
        id: `site_${type}`,
        type,
        name: type,
        x: site.x,
        requiredRank: site.requiredRank,
        path: site.path,
        slotIndex: site.slotIndex,
      })),
    ].sort((a, b) => a.x - b.x);
    this.player = {
      x: this.spawnPoint.x,
      y: groundY - 62,
      width: 48,
      height: 62,
      facing: 1,
      moving: false,
    };
    this.moveInput = 0;
    this.moveTargetX = null;
    this.nearbySiteId = null;
    this.activity = null;
    this.completedActivity = null;
    this.followers = [];
    this.elapsed = 0;
  }

  setRank(rank) {
    this.rank = Math.max(0, Math.min(TERRITORY_RANK_CONFIG.length - 1, Math.floor(Number(rank) || 0)));
    this.width = TERRITORY_RANK_CONFIG[this.rank].worldWidth;
    this.player.x = Math.max(30, Math.min(this.width - this.player.width - 30, this.player.x));
    this.updateNearbySite();
    return this.getState();
  }

  resetPosition({ fromExpedition = false } = {}) {
    const x = fromExpedition && this.rank >= 1 ? 245 : Math.min(1080, this.width - 180);
    this.player.x = x;
    this.player.y = this.groundY - this.player.height;
    this.player.facing = fromExpedition ? 1 : -1;
    this.player.moving = false;
    this.moveInput = 0;
    this.moveTargetX = null;
    this.activity = null;
    this.completedActivity = null;
    this.updateNearbySite();
  }

  syncFollowers(pets = []) {
    const previous = new Map(this.followers.map((follower) => [follower.instanceId, follower]));
    this.followers = pets.slice(0, 3).map((pet, index) => {
      const existing = previous.get(pet.instanceId);
      return existing || {
        instanceId: pet.instanceId,
        templateId: pet.templateId,
        x: this.player.x - 64 - index * 52,
        y: this.groundY - 44,
        width: 40,
        height: 40,
        facing: 1,
        phase: index * 1.8,
      };
    });
  }

  setMovementInput(direction) {
    if (this.activity) return;
    this.moveInput = Math.max(-1, Math.min(1, Number(direction) || 0));
    if (this.moveInput !== 0) this.moveTargetX = null;
  }

  setMoveTarget(worldX) {
    if (this.activity) return;
    this.moveTargetX = Math.max(30, Math.min(this.width - 30, Number(worldX) || this.player.x));
  }

  clearMovement() {
    this.moveInput = 0;
    this.moveTargetX = null;
    this.player.moving = false;
  }

  update(deltaTime) {
    const safeDelta = Math.max(0, Math.min(100, Number(deltaTime) || 0));
    this.elapsed += safeDelta;
    if (this.activity) {
      this.activity.remainingMs = Math.max(0, this.activity.remainingMs - safeDelta);
      this.player.moving = false;
      if (this.activity.remainingMs <= 0) {
        this.completedActivity = { ...this.activity };
        this.activity = null;
      }
    } else {
      this.updateMovement(safeDelta);
    }
    this.updateFollowers(safeDelta);
    this.updateNearbySite();
    return this.getState();
  }

  updateMovement(deltaTime) {
    let direction = this.moveInput;
    if (direction === 0 && this.moveTargetX !== null) {
      const distance = this.moveTargetX - (this.player.x + this.player.width / 2);
      if (Math.abs(distance) <= 7) {
        this.moveTargetX = null;
      } else {
        direction = Math.sign(distance);
      }
    }
    const speed = 235;
    const previousX = this.player.x;
    this.player.x += direction * speed * (deltaTime / 1000);
    this.player.x = Math.max(24, Math.min(this.width - this.player.width - 24, this.player.x));
    this.player.moving = Math.abs(this.player.x - previousX) > 0.05;
    if (direction !== 0) this.player.facing = direction;
  }

  updateFollowers(deltaTime) {
    this.followers.forEach((follower, index) => {
      const directionOffset = this.player.facing >= 0 ? -1 : 1;
      const targetX = this.player.x + directionOffset * (64 + index * 48);
      const targetY = this.groundY - follower.height - 3 + Math.sin(this.elapsed / 360 + follower.phase) * 3;
      const factor = 1 - Math.pow(0.001, deltaTime / 1000);
      const oldX = follower.x;
      follower.x += (targetX - follower.x) * factor;
      follower.y += (targetY - follower.y) * factor;
      if (Math.abs(follower.x - oldX) > 0.05) follower.facing = Math.sign(follower.x - oldX);
    });
  }

  updateNearbySite() {
    const playerCenter = this.player.x + this.player.width / 2;
    const nearby = this.sites
      .filter((site) => site.requiredRank <= Math.max(1, this.rank) || site.type === "main_base")
      .map((site) => ({ site, distance: Math.abs(site.x - playerCenter) }))
      .filter((item) => item.distance <= this.interactionRadius)
      .sort((a, b) => a.distance - b.distance)[0]?.site || null;
    this.nearbySiteId = nearby?.id || null;
    return nearby;
  }

  getNearbySite() {
    return this.sites.find((site) => site.id === this.nearbySiteId) || null;
  }

  getSite(type) {
    return this.sites.find((site) => site.type === type) || null;
  }

  getVisibleSites() {
    return this.sites.filter((site) => site.x <= this.width + 120);
  }

  startActivity(buildingType, definition) {
    const site = this.getSite(buildingType);
    if (!site || !definition || this.activity) return false;
    const distance = Math.abs(site.x - (this.player.x + this.player.width / 2));
    if (distance > this.interactionRadius + 16) return false;
    this.clearMovement();
    this.player.facing = site.x >= this.player.x ? 1 : -1;
    this.activity = {
      buildingType,
      label: definition.label,
      durationMs: definition.durationMs,
      remainingMs: definition.durationMs,
    };
    this.completedActivity = null;
    return true;
  }

  consumeCompletedActivity() {
    const completed = this.completedActivity;
    this.completedActivity = null;
    return completed;
  }

  getState() {
    return {
      rank: this.rank,
      width: this.width,
      height: this.height,
      groundY: this.groundY,
      player: { ...this.player },
      followers: this.followers.map((follower) => ({ ...follower })),
      nearbySite: this.getNearbySite() ? { ...this.getNearbySite() } : null,
      activity: this.activity ? { ...this.activity } : null,
      sites: this.getVisibleSites().map((site) => ({ ...site })),
    };
  }
}
