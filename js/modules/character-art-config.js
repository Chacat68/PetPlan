export const CHARACTER_ART_VERSION = "stable-actions-20260721c";
export const CHARACTER_FRAME_SIZE = 256;
export const CHARACTER_FRAME_COUNT = 12;

const createArtSet = (category, key) => Object.freeze({
  key,
  portrait: `images/portraits/${category}/${key}.png`,
  sprites: Object.freeze({
    idle: `images/sprites/battle/${category}/${key}_idle_sheet.png`,
    move: `images/sprites/battle/${category}/${key}_move_sheet.png`,
    attack: `images/sprites/battle/${category}/${key}_attack_sheet.png`,
  }),
});

export const HERO_CHARACTER_ART = Object.freeze({
  ...createArtSet("hero", "hero"),
  frameDurations: Object.freeze({ idle: 96, move: 44, attack: 32 }),
});

export const PET_CHARACTER_ART = Object.freeze({
  fire_dog: createArtSet("pets", "fire_dog"),
  ice_cat: createArtSet("pets", "ice_cat"),
  thunder_bird: createArtSet("pets", "thunder_bird"),
  earth_bear: createArtSet("pets", "earth_bear"),
  storm_dragon: createArtSet("pets", "storm_dragon"),
  unicorn: createArtSet("pets", "unicorn"),
  shadow_wolf: createArtSet("pets", "shadow_wolf"),
  phoenix: createArtSet("pets", "phoenix"),
});

export const MONSTER_CHARACTER_ART = Object.freeze({
  slime: createArtSet("monsters", "slime"),
  bat: createArtSet("monsters", "bat"),
  skeleton: createArtSet("monsters", "skeleton"),
  goblin: createArtSet("monsters", "goblin"),
  demon: createArtSet("monsters", "demon"),
  dragon: createArtSet("monsters", "dragon"),
});
