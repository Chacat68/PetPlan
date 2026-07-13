/**
 * Territory scene art v2. All territory-specific environment art lives in one
 * manifest so the controller cannot silently fall back to mismatched assets.
 */

const ROOT = "images/territory-v2";

export const TERRITORY_SCENE_ART_SOURCES = Object.freeze({
  sky: `${ROOT}/sky-panorama.png`,
  ground: `${ROOT}/ground-road-tile-unified.png`,
  lamp: `${ROOT}/lamp-post.png`,
  districtMarker: `${ROOT}/district-marker.png`,
  construction: `${ROOT}/construction-platform.png`,
  expeditionGate: `${ROOT}/expedition-gate.png`,
  frontierBarrier: `${ROOT}/frontier-barrier.png`,
});

export const TERRITORY_BUILDING_ART_SOURCES = Object.freeze({
  main_base: `${ROOT}/main-base.png`,
  training_ground: `${ROOT}/training-ground.png`,
  temple: `${ROOT}/guardian-temple.png`,
  workshop: `${ROOT}/workshop.png`,
  barracks: `${ROOT}/barracks.png`,
  library: `${ROOT}/expedition-library.png`,
  crystal_mine: `${ROOT}/crystal-mine.png`,
});

export const TERRITORY_BUILDING_RENDER_SIZES = Object.freeze({
  main_base: Object.freeze({ width: 330, height: 198 }),
  training_ground: Object.freeze({ width: 238, height: 146 }),
  temple: Object.freeze({ width: 188, height: 184 }),
  workshop: Object.freeze({ width: 236, height: 150 }),
  barracks: Object.freeze({ width: 194, height: 180 }),
  library: Object.freeze({ width: 194, height: 184 }),
  crystal_mine: Object.freeze({ width: 230, height: 166 }),
});

export const TERRITORY_DISTRICT_ART = Object.freeze([
  Object.freeze({ x: 400, width: 500, markerX: 430, label: "先攻区", path: "hero" }),
  Object.freeze({ x: 930, width: 360, markerX: 955, label: "核心广场", path: "core" }),
  Object.freeze({ x: 1290, width: 520, markerX: 1320, label: "协同区", path: "companion" }),
  Object.freeze({ x: 1810, width: 1000, markerX: 1840, label: "拓域区", path: "territory" }),
]);

export const TERRITORY_ART_VERSION = "territory-ground-unified-20260713a";
