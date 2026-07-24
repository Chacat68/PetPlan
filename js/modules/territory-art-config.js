/**
 * Territory scene art v7.
 *
 * The sanctuary panorama and all seven buildings share the same painterly
 * anime-city treatment. Sources are ordered by preference so the controller
 * can fall back without keeping the original PNG payloads in production.
 */

const SCENE_ROOT = "images/territory-v4";
const BUILDING_ROOT = "images/territory-v5";
const ART_VERSION = "territory-assets-lazy-20260724a";
const sources = (...paths) => Object.freeze(
  paths.map((path) => `${path}?v=${ART_VERSION}`)
);

export const TERRITORY_SCENE_ART_SOURCES = Object.freeze({
  sky: sources(
    `${SCENE_ROOT}/fate-aligned-sanctuary-sky.avif`,
    `${SCENE_ROOT}/fate-aligned-sanctuary-sky.webp`,
  ),
});

export const TERRITORY_BUILDING_ART_SOURCES = Object.freeze({
  expedition_gate: sources(`${BUILDING_ROOT}/expedition_gate.webp`),
  main_base: sources(`${BUILDING_ROOT}/main_base.webp`),
  training_ground: sources(`${BUILDING_ROOT}/training_ground.webp`),
  temple: sources(`${BUILDING_ROOT}/temple.webp`),
  workshop: sources(`${BUILDING_ROOT}/workshop.webp`),
  barracks: sources(`${BUILDING_ROOT}/barracks.webp`),
  library: sources(`${BUILDING_ROOT}/library.webp`),
  crystal_mine: sources(`${BUILDING_ROOT}/crystal_mine.webp`),
});

export const TERRITORY_BUILDING_RENDER_SIZES = Object.freeze({
  expedition_gate: Object.freeze({ width: 236, height: 219 }),
  main_base: Object.freeze({ width: 336, height: 233 }),
  training_ground: Object.freeze({ width: 300, height: 99 }),
  temple: Object.freeze({ width: 176, height: 235 }),
  workshop: Object.freeze({ width: 270, height: 147 }),
  barracks: Object.freeze({ width: 258, height: 138 }),
  library: Object.freeze({ width: 242, height: 165 }),
  crystal_mine: Object.freeze({ width: 280, height: 117 }),
});

export const TERRITORY_ART_VERSION = ART_VERSION;
