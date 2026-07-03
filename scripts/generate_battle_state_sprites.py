from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance


FRAME_SIZE = 512
FRAME_COUNT = 4
ROOT = Path(__file__).resolve().parents[1]

UNITS = [
    {"category": "hero", "key": "hero", "source": "images/player/table_hero.png", "direction": 1, "style": "hero"},
    {"category": "pets", "key": "fire_dog", "source": "images/pets/fire_dog_table.png", "direction": 1, "style": "pet"},
    {"category": "pets", "key": "ice_cat", "source": "images/pets/ice_cat_table.png", "direction": 1, "style": "pet"},
    {"category": "pets", "key": "thunder_bird", "source": "images/pets/thunder_bird_table.png", "direction": 1, "style": "pet"},
    {"category": "pets", "key": "earth_bear", "source": "images/pets/earth_bear_table.png", "direction": 1, "style": "pet"},
    {"category": "pets", "key": "storm_dragon", "source": "images/pets/storm_dragon_table.png", "direction": 1, "style": "pet"},
    {"category": "pets", "key": "unicorn", "source": "images/pets/unicorn_table.png", "direction": 1, "style": "pet"},
    {"category": "pets", "key": "shadow_wolf", "source": "images/pets/shadow_wolf_table.png", "direction": 1, "style": "pet"},
    {"category": "pets", "key": "phoenix", "source": "images/pets/phoenix_table.png", "direction": 1, "style": "pet"},
    {"category": "monsters", "key": "slime", "source": "images/monsters/slime_table.png", "direction": -1, "style": "monster"},
    {"category": "monsters", "key": "bat", "source": "images/monsters/bat_table.png", "direction": -1, "style": "monster"},
    {"category": "monsters", "key": "skeleton", "source": "images/monsters/skeleton_table.png", "direction": -1, "style": "monster"},
    {"category": "monsters", "key": "goblin", "source": "images/monsters/goblin_table.png", "direction": -1, "style": "monster"},
    {"category": "monsters", "key": "demon", "source": "images/monsters/demon_table.png", "direction": -1, "style": "monster"},
    {"category": "monsters", "key": "dragon", "source": "images/monsters/dragon_table.png", "direction": -1, "style": "monster"},
]

STATE_PROFILES = {
    "pet": {
        "idle": [
            {"x": 0, "y": 9, "scale": 0.97, "alpha": 0.96},
            {"x": 0, "y": 2, "scale": 1.00, "alpha": 1.00},
            {"x": 0, "y": 5, "scale": 1.03, "alpha": 1.00},
            {"x": 0, "y": 11, "scale": 0.99, "alpha": 0.98},
        ],
        "move": [
            {"x": -34, "y": 10, "scale": 1.03, "alpha": 0.94, "rotate": -4},
            {"x": -5, "y": -8, "scale": 1.10, "alpha": 1.00, "rotate": 2},
            {"x": 35, "y": 8, "scale": 1.04, "alpha": 0.98, "rotate": 5},
            {"x": 8, "y": -3, "scale": 1.08, "alpha": 1.00, "rotate": -2},
        ],
        "attack": [
            {"x": -18, "y": 5, "scale": 1.02, "alpha": 1.00, "rotate": -3},
            {"x": 45, "y": -12, "scale": 1.16, "alpha": 1.00, "rotate": 6},
            {"x": 92, "y": -18, "scale": 1.24, "alpha": 1.00, "rotate": 8},
            {"x": 18, "y": 3, "scale": 1.06, "alpha": 0.98, "rotate": 0},
        ],
    },
    "monster": {
        "idle": [
            {"x": 0, "y": 8, "scale": 0.98, "alpha": 0.96},
            {"x": 0, "y": 2, "scale": 1.00, "alpha": 1.00},
            {"x": 0, "y": 6, "scale": 1.02, "alpha": 1.00},
            {"x": 0, "y": 10, "scale": 0.99, "alpha": 0.98},
        ],
        "move": [
            {"x": -28, "y": 8, "scale": 1.02, "alpha": 0.96, "rotate": 2},
            {"x": -8, "y": 0, "scale": 1.07, "alpha": 1.00, "rotate": -2},
            {"x": 24, "y": 10, "scale": 1.02, "alpha": 0.98, "rotate": -4},
            {"x": 6, "y": 2, "scale": 1.05, "alpha": 1.00, "rotate": 1},
        ],
        "attack": [
            {"x": 14, "y": 6, "scale": 1.01, "alpha": 1.00, "rotate": 1},
            {"x": 56, "y": -6, "scale": 1.14, "alpha": 1.00, "rotate": -5},
            {"x": 108, "y": -12, "scale": 1.24, "alpha": 1.00, "rotate": -8},
            {"x": 18, "y": 5, "scale": 1.04, "alpha": 0.98, "rotate": 0},
        ],
    },
}

PET_EFFECTS = {
    "fire_dog": {"kind": "fire", "primary": (255, 111, 31, 205), "secondary": (255, 214, 82, 185)},
    "ice_cat": {"kind": "ice", "primary": (107, 221, 255, 210), "secondary": (232, 255, 255, 200)},
    "thunder_bird": {"kind": "lightning", "primary": (255, 226, 55, 225), "secondary": (148, 105, 255, 175)},
    "earth_bear": {"kind": "earth", "primary": (174, 113, 50, 210), "secondary": (105, 76, 42, 185)},
    "storm_dragon": {"kind": "wind", "primary": (101, 229, 222, 190), "secondary": (238, 255, 255, 165)},
    "unicorn": {"kind": "light", "primary": (255, 236, 128, 215), "secondary": (255, 255, 255, 210)},
    "shadow_wolf": {"kind": "shadow", "primary": (179, 73, 255, 215), "secondary": (62, 28, 115, 190)},
    "phoenix": {"kind": "phoenix", "primary": (255, 92, 24, 220), "secondary": (255, 222, 71, 205)},
}

MONSTER_EFFECTS = {
    "slime": {"kind": "acid", "primary": (96, 255, 91, 210), "secondary": (18, 139, 56, 185)},
    "bat": {"kind": "sonic", "primary": (188, 104, 255, 205), "secondary": (92, 211, 255, 165)},
    "skeleton": {"kind": "bone", "primary": (242, 239, 215, 215), "secondary": (143, 151, 164, 170)},
    "goblin": {"kind": "slash", "primary": (255, 217, 86, 220), "secondary": (235, 68, 46, 175)},
    "demon": {"kind": "hellfire", "primary": (255, 64, 42, 225), "secondary": (255, 160, 35, 205)},
    "dragon": {"kind": "dragonfire", "primary": (255, 91, 28, 225), "secondary": (255, 226, 82, 210)},
}


def resample_filter():
    return getattr(Image, "Resampling", Image).BICUBIC


def normalize_frame(source):
    if source.size == (FRAME_SIZE, FRAME_SIZE):
        return source.copy()

    return source.resize((FRAME_SIZE, FRAME_SIZE), resample_filter())


def extract_frames(sheet_path):
    sheet = Image.open(ROOT / sheet_path).convert("RGBA")
    frame_width = sheet.width // FRAME_COUNT
    frames = []
    for index in range(FRAME_COUNT):
        frame = sheet.crop((index * frame_width, 0, (index + 1) * frame_width, sheet.height))
        frames.append(normalize_frame(frame))
    return frames


def transform_sprite(source, x_offset, y_offset, scale, alpha, rotate=0):
    scaled_size = max(1, int(FRAME_SIZE * scale))
    sprite = source.resize((scaled_size, scaled_size), resample_filter())

    if rotate:
        sprite = sprite.rotate(rotate, resample=resample_filter(), expand=True)

    if alpha < 1:
        sprite_alpha = sprite.getchannel("A").point(lambda value: int(value * alpha))
        sprite.putalpha(sprite_alpha)

    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = (FRAME_SIZE - sprite.width) // 2 + int(x_offset)
    y = (FRAME_SIZE - sprite.height) // 2 + int(y_offset)
    frame.alpha_composite(sprite, (x, y))
    return frame


def add_shadow(frame, strength):
    shadow = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.ellipse(
        (FRAME_SIZE * 0.28, FRAME_SIZE * 0.76, FRAME_SIZE * 0.72, FRAME_SIZE * 0.86),
        fill=(0, 0, 0, strength),
    )
    shadow.alpha_composite(frame)
    return shadow


def add_move_effect(frame, direction, index, style):
    draw = ImageDraw.Draw(frame)
    base_x = 96 if direction > 0 else 416
    line_dir = -1 if direction > 0 else 1
    line_count = 4 if style == "pet" else 3
    for offset in range(line_count):
        y = 205 + index * 9 + offset * 28
        x1 = base_x + line_dir * offset * 22
        x2 = x1 + line_dir * (62 + index * 7)
        draw.line((x1, y, x2, y - 10), fill=(255, 226, 140, 82), width=5)

    dust_y = 405
    for offset in range(3):
        dust_x = (170 - offset * 24) if direction > 0 else (342 + offset * 24)
        draw.ellipse(
            (dust_x - 12, dust_y - 5 + offset * 3, dust_x + 18, dust_y + 8 + offset * 3),
            fill=(210, 170, 105, 44),
        )
    return frame


def get_pet_effect(unit_key):
    return PET_EFFECTS.get(unit_key, PET_EFFECTS["fire_dog"])


def get_monster_effect(unit_key):
    return MONSTER_EFFECTS.get(unit_key, MONSTER_EFFECTS["goblin"])


def draw_star(draw, x, y, radius, fill, outline=None):
    points = [
        (x, y - radius),
        (x + radius * 0.28, y - radius * 0.28),
        (x + radius, y),
        (x + radius * 0.28, y + radius * 0.28),
        (x, y + radius),
        (x - radius * 0.28, y + radius * 0.28),
        (x - radius, y),
        (x - radius * 0.28, y - radius * 0.28),
    ]
    if outline:
        outline_points = [(px + 1, py + 1) for px, py in points]
        draw.polygon(outline_points, fill=outline)
    draw.polygon(points, fill=fill)


def add_pet_move_effect(frame, direction, index, unit_key):
    effect = get_pet_effect(unit_key)
    primary = effect["primary"]
    secondary = effect["secondary"]
    draw = ImageDraw.Draw(frame)
    line_dir = -1 if direction > 0 else 1
    base_x = 82 if direction > 0 else 430

    for offset in range(5):
        y = 188 + index * 10 + offset * 31
        x1 = base_x + line_dir * offset * 19
        x2 = x1 + line_dir * (78 + index * 8)
        color = primary if offset % 2 == 0 else secondary
        draw.line((x1, y, x2, y - 13), fill=(color[0], color[1], color[2], 70), width=5)

    for offset in range(4):
        dust_x = 150 - offset * 22 if direction > 0 else 362 + offset * 22
        dust_y = 405 + offset * 3
        draw.ellipse((dust_x - 13, dust_y - 5, dust_x + 20, dust_y + 8), fill=(210, 170, 105, 42))

    if effect["kind"] in ("fire", "phoenix"):
        for offset in range(3):
            x = 130 - offset * 25
            y = 265 + offset * 35
            draw.polygon(
                [(x, y - 18), (x + 12, y + 4), (x, y + 22), (x - 13, y + 2)],
                fill=(primary[0], primary[1], primary[2], 96),
            )
    elif effect["kind"] == "lightning":
        for offset in range(2):
            x = 118 - offset * 32
            y = 245 + offset * 55
            draw.line((x, y, x - 22, y + 19, x - 5, y + 19, x - 31, y + 48), fill=primary, width=4)
    elif effect["kind"] == "wind":
        for offset in range(2):
            box = (92 - offset * 23, 220 + offset * 52, 168 - offset * 23, 288 + offset * 52)
            draw.arc(box, 205, 25, fill=(primary[0], primary[1], primary[2], 120), width=5)

    return frame


def add_monster_move_effect(frame, direction, index, unit_key):
    effect = get_monster_effect(unit_key)
    primary = effect["primary"]
    secondary = effect["secondary"]
    kind = effect["kind"]
    draw = ImageDraw.Draw(frame)
    line_dir = -1 if direction > 0 else 1
    base_x = 90 if direction > 0 else 422

    for offset in range(5):
        y = 185 + index * 10 + offset * 31
        x1 = base_x + line_dir * offset * 20
        x2 = x1 + line_dir * (76 + index * 10)
        color = primary if offset % 2 == 0 else secondary
        draw.line((x1, y, x2, y - 12), fill=(color[0], color[1], color[2], 74), width=5)

    for offset in range(4):
        dust_x = 148 - offset * 22 if direction > 0 else 364 + offset * 22
        dust_y = 404 + offset * 3
        draw.ellipse((dust_x - 12, dust_y - 5, dust_x + 23, dust_y + 9), fill=(133, 92, 56, 46))

    if kind == "acid":
        for offset in range(4):
            x = 344 + offset * 25 if direction < 0 else 168 - offset * 25
            y = 376 + (offset % 2) * 17
            draw.ellipse((x - 15, y - 7, x + 20, y + 10), fill=(primary[0], primary[1], primary[2], 80))
            draw.ellipse((x + 6, y - 22, x + 15, y - 12), fill=(secondary[0], secondary[1], secondary[2], 95))
    elif kind == "sonic":
        for offset in range(3):
            cx = 360 + offset * 28 if direction < 0 else 152 - offset * 28
            box = (cx - 36, 210 + offset * 42, cx + 50, 282 + offset * 42)
            draw.arc(box, 300 if direction < 0 else 120, 72 if direction < 0 else 252, fill=(primary[0], primary[1], primary[2], 88), width=5)
    elif kind == "bone":
        for offset in range(3):
            x = 352 + offset * 24 if direction < 0 else 160 - offset * 24
            y = 230 + offset * 45
            draw.line((x, y, x + line_dir * 42, y - 14), fill=(primary[0], primary[1], primary[2], 95), width=4)
            draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(secondary[0], secondary[1], secondary[2], 80))
    elif kind == "slash":
        for offset in range(3):
            x = 356 + offset * 28 if direction < 0 else 156 - offset * 28
            y = 218 + offset * 45
            draw.line((x, y + 18, x + line_dir * 58, y - 8), fill=(primary[0], primary[1], primary[2], 86), width=5)
    elif kind in ("hellfire", "dragonfire"):
        flame_count = 4 if kind == "dragonfire" else 3
        for offset in range(flame_count):
            x = 350 + offset * 25 if direction < 0 else 162 - offset * 25
            y = 238 + offset * 39
            draw.polygon(
                [(x, y - 24), (x + 15, y + 3), (x, y + 25), (x - 16, y + 3)],
                fill=(primary[0], primary[1], primary[2], 92),
            )
            draw.ellipse((x - 5, y - 4, x + 8, y + 10), fill=(secondary[0], secondary[1], secondary[2], 105))

    return frame


def draw_fire_attack(draw, center, primary, secondary, scale):
    x, y = center
    for offset in range(4):
        dx = offset * 28
        flame = [
            (x + dx, y - 42 * scale),
            (x + dx + 24 * scale, y + 2 * scale),
            (x + dx + 2 * scale, y + 44 * scale),
            (x + dx - 24 * scale, y + 5 * scale),
        ]
        draw.polygon(flame, fill=primary)
        draw.polygon(
            [(px + 6 * scale, py + 4 * scale) for px, py in flame],
            fill=secondary,
        )


def draw_ice_attack(draw, center, primary, secondary, scale):
    x, y = center
    for offset in range(4):
        dx = offset * 30
        shard = [
            (x + dx + 18 * scale, y - 58 * scale),
            (x + dx + 52 * scale, y),
            (x + dx + 8 * scale, y + 26 * scale),
            (x + dx - 18 * scale, y - 2 * scale),
        ]
        draw.polygon(shard, fill=primary)
        draw.line((shard[0][0], shard[0][1], shard[2][0], shard[2][1]), fill=secondary, width=4)


def draw_lightning_attack(draw, center, primary, secondary, scale):
    x, y = center
    for offset in range(3):
        start_x = x + offset * 42
        points = [
            (start_x, y - 46 * scale),
            (start_x + 30 * scale, y - 4 * scale),
            (start_x + 13 * scale, y - 1 * scale),
            (start_x + 48 * scale, y + 54 * scale),
            (start_x + 12 * scale, y + 15 * scale),
            (start_x + 29 * scale, y + 12 * scale),
        ]
        draw.line(points, fill=secondary, width=10)
        draw.line(points, fill=primary, width=5)


def draw_earth_attack(draw, center, primary, secondary, scale):
    x, y = center
    draw.arc((x - 40, y - 12, x + 160, y + 86), 190, 345, fill=primary, width=12)
    for offset in range(5):
        rx = x + offset * 36
        ry = y + 32 - (offset % 2) * 18
        rock = [(rx - 16, ry + 7), (rx - 4, ry - 16), (rx + 20, ry - 6), (rx + 13, ry + 18)]
        draw.polygon(rock, fill=secondary)
        draw.line(rock + [rock[0]], fill=primary, width=3)


def draw_wind_attack(draw, center, primary, secondary, scale):
    x, y = center
    for offset in range(3):
        box = (x - 25 + offset * 42, y - 58 + offset * 8, x + 115 + offset * 42, y + 70 + offset * 8)
        draw.arc(box, 210, 35, fill=primary, width=11)
        draw.arc((box[0] + 14, box[1] + 17, box[2] - 14, box[3] - 17), 215, 30, fill=secondary, width=5)


def draw_light_attack(draw, center, primary, secondary, scale):
    x, y = center
    for offset in range(4):
        draw.line((x - 15, y, x + 150 + offset * 18, y - 42 + offset * 28), fill=(primary[0], primary[1], primary[2], 120), width=5)
        draw_star(draw, x + 45 + offset * 35, y - 35 + offset * 24, 15, secondary, primary)


def draw_shadow_attack(draw, center, primary, secondary, scale):
    x, y = center
    for offset in range(3):
        box = (x - 10 + offset * 34, y - 62 + offset * 16, x + 120 + offset * 42, y + 68 + offset * 16)
        draw.arc(box, 300, 80, fill=secondary, width=16)
        draw.arc((box[0] + 8, box[1] + 8, box[2] - 8, box[3] - 8), 302, 76, fill=primary, width=7)


def draw_pet_attack_effect(frame, direction, index, unit_key):
    if index not in (1, 2):
        return frame

    effect = get_pet_effect(unit_key)
    primary = effect["primary"]
    secondary = effect["secondary"]
    kind = effect["kind"]
    draw = ImageDraw.Draw(frame)
    scale = 1.0 if index == 1 else 1.25
    center = (360, 238)

    draw.arc((248, 126, 475, 370), 292, 68, fill=(primary[0], primary[1], primary[2], 155), width=13)

    if kind == "fire":
        draw_fire_attack(draw, center, primary, secondary, scale)
    elif kind == "ice":
        draw_ice_attack(draw, center, primary, secondary, scale)
    elif kind == "lightning":
        draw_lightning_attack(draw, center, primary, secondary, scale)
    elif kind == "earth":
        draw_earth_attack(draw, center, primary, secondary, scale)
    elif kind == "wind":
        draw_wind_attack(draw, center, primary, secondary, scale)
    elif kind == "light":
        draw_light_attack(draw, center, primary, secondary, scale)
    elif kind == "shadow":
        draw_shadow_attack(draw, center, primary, secondary, scale)
    elif kind == "phoenix":
        draw_fire_attack(draw, center, primary, secondary, scale)
        draw.arc((250, 100, 510, 415), 230, 35, fill=(secondary[0], secondary[1], secondary[2], 150), width=18)

    return frame


def draw_acid_attack(draw, center, primary, secondary, scale, sign):
    x, y = center
    for offset in range(5):
        cx = x + sign * (offset * 31 + 8)
        cy = y - 38 + offset * 18
        radius = (18 + offset * 3) * scale
        draw.ellipse((cx - radius, cy - radius * 0.6, cx + radius, cy + radius * 0.6), fill=primary)
        draw.ellipse((cx - radius * 0.35, cy - radius * 1.25, cx + radius * 0.25, cy - radius * 0.45), fill=secondary)
    x1 = x + sign * 185
    x2 = x - sign * 35
    draw.arc((min(x1, x2), y - 92, max(x1, x2), y + 88), 130 if sign > 0 else 50, 250 if sign > 0 else 170, fill=secondary, width=7)


def draw_sonic_attack(draw, center, primary, secondary, scale, sign):
    x, y = center
    for offset in range(4):
        cx = x + sign * (42 + offset * 36)
        radius_x = (50 + offset * 17) * scale
        radius_y = (74 + offset * 13) * scale
        box = (cx - radius_x, y - radius_y, cx + radius_x, y + radius_y)
        draw.arc(box, 285 if sign > 0 else 75, 75 if sign > 0 else 255, fill=secondary, width=5 + offset)
        inner = (box[0] + 12, box[1] + 18, box[2] - 12, box[3] - 18)
        draw.arc(inner, 292 if sign > 0 else 82, 68 if sign > 0 else 248, fill=primary, width=3 + offset)


def draw_bone_attack(draw, center, primary, secondary, scale, sign):
    x, y = center
    for offset in range(3):
        start = (x + sign * (8 + offset * 6), y - 50 + offset * 46)
        end = (x + sign * (170 + offset * 18) * scale, y - 88 + offset * 56)
        draw.line((start[0], start[1], end[0], end[1]), fill=secondary, width=12)
        draw.line((start[0], start[1], end[0], end[1]), fill=primary, width=6)
        draw.ellipse((end[0] - 13, end[1] - 9, end[0] + 13, end[1] + 9), fill=primary)
        draw.ellipse((end[0] - 5, end[1] - 5, end[0] + 5, end[1] + 5), fill=secondary)


def draw_slash_attack(draw, center, primary, secondary, scale, sign):
    x, y = center
    for offset in range(3):
        y1 = y - 62 + offset * 44
        draw.line(
            (x + sign * 18, y1 + 52, x + sign * (168 + offset * 16) * scale, y1 - 14),
            fill=secondary,
            width=13,
        )
        draw.line(
            (x + sign * 20, y1 + 48, x + sign * (162 + offset * 16) * scale, y1 - 10),
            fill=primary,
            width=6,
        )
    draw.arc((x - 120, y - 132, x + 120, y + 128), 54 if sign < 0 else 305, 204 if sign < 0 else 125, fill=(primary[0], primary[1], primary[2], 145), width=10)


def draw_hellfire_attack(draw, center, primary, secondary, scale, sign):
    x, y = center
    for offset in range(5):
        cx = x + sign * (offset * 30 + 14)
        height = (58 + offset * 8) * scale
        width = (25 + offset * 3) * scale
        flame = [
            (cx, y - height),
            (cx + sign * width, y - height * 0.15),
            (cx + sign * width * 0.32, y + height * 0.55),
            (cx - sign * width, y - height * 0.05),
        ]
        draw.polygon(flame, fill=primary)
        draw.polygon([(px + sign * 7 * scale, py + 8 * scale) for px, py in flame], fill=secondary)
    draw.arc((x - 160, y - 120, x + 160, y + 132), 40 if sign < 0 else 320, 210 if sign < 0 else 140, fill=(primary[0], primary[1], primary[2], 130), width=15)


def draw_dragonfire_attack(draw, center, primary, secondary, scale, sign):
    x, y = center
    cone = [
        (x + sign * 8, y - 48 * scale),
        (x + sign * 205 * scale, y - 96 * scale),
        (x + sign * 245 * scale, y - 8 * scale),
        (x + sign * 210 * scale, y + 84 * scale),
        (x + sign * 6, y + 50 * scale),
    ]
    draw.polygon(cone, fill=(primary[0], primary[1], primary[2], 155))
    inner = [
        (x + sign * 28, y - 28 * scale),
        (x + sign * 185 * scale, y - 58 * scale),
        (x + sign * 208 * scale, y),
        (x + sign * 178 * scale, y + 54 * scale),
        (x + sign * 26, y + 28 * scale),
    ]
    draw.polygon(inner, fill=(secondary[0], secondary[1], secondary[2], 175))
    draw_hellfire_attack(draw, center, primary, secondary, scale * 0.85, sign)


def draw_monster_attack_effect(frame, direction, index, unit_key):
    if index not in (1, 2):
        return frame

    effect = get_monster_effect(unit_key)
    primary = effect["primary"]
    secondary = effect["secondary"]
    kind = effect["kind"]
    draw = ImageDraw.Draw(frame)
    sign = 1 if direction > 0 else -1
    center = (330 if sign > 0 else 182, 238)
    scale = 1.0 if index == 1 else 1.25
    front_x = 362 if sign > 0 else 150

    arc_box = (front_x - 118, 116, front_x + 118, 382)
    draw.arc(arc_box, 305 if sign > 0 else 55, 125 if sign > 0 else 205, fill=(primary[0], primary[1], primary[2], 152), width=14)
    draw.line(
        (front_x - sign * 12, 260, front_x + sign * 156, 212),
        fill=(secondary[0], secondary[1], secondary[2], 128),
        width=7,
    )

    if kind == "acid":
        draw_acid_attack(draw, center, primary, secondary, scale, sign)
    elif kind == "sonic":
        draw_sonic_attack(draw, center, primary, secondary, scale, sign)
    elif kind == "bone":
        draw_bone_attack(draw, center, primary, secondary, scale, sign)
    elif kind == "slash":
        draw_slash_attack(draw, center, primary, secondary, scale, sign)
    elif kind == "hellfire":
        draw_hellfire_attack(draw, center, primary, secondary, scale, sign)
    elif kind == "dragonfire":
        draw_dragonfire_attack(draw, center, primary, secondary, scale, sign)

    return frame


def add_attack_effect(frame, direction, index, style):
    draw = ImageDraw.Draw(frame)
    front_x = 365 if direction > 0 else 147
    if index in (1, 2):
        if direction > 0:
            arc_box = (front_x - 74, 130, front_x + 112, 365)
            line = (front_x - 28, 260, front_x + 110, 210)
        else:
            arc_box = (front_x - 112, 130, front_x + 74, 365)
            line = (front_x + 28, 260, front_x - 110, 210)

        color = (255, 232, 130, 180 if index == 2 else 130)
        if style == "monster":
            color = (255, 94, 73, 165 if index == 2 else 115)
        draw.arc(arc_box, 292 if direction > 0 else 68, 68 if direction > 0 else 188, fill=color, width=13)
        draw.line(line, fill=(255, 255, 210, 135), width=7)

        if style in ("pet", "monster"):
            claw_x = front_x + 48 * direction
            for step in range(3):
                y = 210 + step * 32
                draw.line(
                    (claw_x - 54 * direction, y + 12, claw_x + 34 * direction, y - 18),
                    fill=color,
                    width=5,
                )
    return frame


def add_idle_effect(frame, index):
    if index != 2:
        return frame

    glow = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (255, 220, 120, 0))
    alpha = frame.getchannel("A").point(lambda value: min(34, value // 8))
    glow.putalpha(alpha)
    frame = Image.alpha_composite(glow, frame)
    return frame


def add_hero_move_effect(frame, direction, index):
    draw = ImageDraw.Draw(frame)
    for offset in range(3):
        y = 388 + offset * 12
        x = 170 - offset * 24
        draw.ellipse((x - 12, y - 4, x + 24, y + 8), fill=(215, 174, 92, 46))

    for offset in range(3):
        x1 = 122 - offset * 22
        y1 = 228 + index * 11 + offset * 28
        draw.line((x1, y1, x1 - 62, y1 - 12), fill=(255, 224, 146, 76), width=5)

    return frame


def draw_gunner_shadow(draw, y_offset):
    draw.ellipse((38, 105 + y_offset, 91, 114 + y_offset), fill=(0, 0, 0, 72))


def draw_gunner_leg(draw, hip, foot, color, outline):
    draw.line((hip[0], hip[1], foot[0], foot[1] - 7), fill=outline, width=8)
    draw.line((hip[0], hip[1], foot[0], foot[1] - 7), fill=color, width=4)
    draw.rounded_rectangle((foot[0] - 8, foot[1] - 7, foot[0] + 7, foot[1] - 2), radius=2, fill=outline)
    draw.rounded_rectangle((foot[0] - 6, foot[1] - 8, foot[0] + 5, foot[1] - 4), radius=2, fill="#3f2a24")


def draw_gunner_arm(draw, shoulder, hand, color, outline, width=6):
    draw.line((shoulder[0], shoulder[1], hand[0], hand[1]), fill=outline, width=width + 3)
    draw.line((shoulder[0], shoulder[1], hand[0], hand[1]), fill=color, width=width)
    draw.ellipse((hand[0] - 3, hand[1] - 3, hand[0] + 4, hand[1] + 4), fill=outline)
    draw.ellipse((hand[0] - 2, hand[1] - 2, hand[0] + 3, hand[1] + 3), fill="#f6bd8b")


def draw_gunner_gun(draw, grip, muzzle, angle_y=0):
    outline = "#17191f"
    metal = "#54606f"
    light = "#aab6c7"
    dark = "#2b3038"
    gx, gy = grip
    mx, my = muzzle[0], muzzle[1] + angle_y

    draw.line((gx, gy, mx, my), fill=outline, width=8)
    draw.line((gx, gy, mx, my), fill=metal, width=4)
    draw.line((gx + 4, gy - 2, mx - 5, my - 2), fill=light, width=1)
    draw.rounded_rectangle((gx - 4, gy + 1, gx + 8, gy + 13), radius=2, fill=outline)
    draw.rounded_rectangle((gx - 1, gy + 3, gx + 5, gy + 12), radius=2, fill=dark)
    draw.rectangle((mx - 2, my - 4, mx + 7, my + 4), fill=outline)
    draw.rectangle((mx - 1, my - 2, mx + 5, my + 2), fill=light)


def draw_muzzle_flash(draw, muzzle, scale=1):
    x, y = muzzle
    points = [
        (x + 2, y),
        (x + 11 * scale, y - 5 * scale),
        (x + 8 * scale, y + 1 * scale),
        (x + 18 * scale, y + 4 * scale),
        (x + 7 * scale, y + 7 * scale),
        (x + 10 * scale, y + 14 * scale),
        (x + 1, y + 8 * scale),
    ]
    draw.polygon(points, fill="#fff4b8")
    draw.line(points + [points[0]], fill="#ff9f1a", width=2)


def draw_gunner_frame(state, index):
    image = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    outline = "#1d1720"
    skin = "#f6bd8b"
    skin_shadow = "#d98c63"
    hair = "#64335f"
    hair_dark = "#362544"
    jacket = "#263d64"
    jacket_light = "#3f71b8"
    skirt = "#b73158"
    scarf = "#e15d74"
    sock = "#2e3045"

    if state == "idle":
        body_x = 64
        bob = [2, 0, 1, 3][index]
        lean = 0
        front_foot = (72, 109 + bob)
        back_foot = (55, 110 + bob)
        gun_grip = (79, 66 + bob)
        gun_muzzle = (108, 67 + bob)
        gun_angle = [2, 0, 1, 3][index]
        left_hand = (78, 68 + bob)
        right_hand = (86, 67 + bob)
    elif state == "move":
        body_x = [58, 64, 70, 63][index]
        bob = [3, -1, 3, 0][index]
        lean = [-4, 2, 4, -1][index]
        front_foot = [(72, 111), (59, 109), (77, 112), (62, 110)][index]
        back_foot = [(51, 108), (76, 111), (54, 109), (75, 110)][index]
        gun_grip = (body_x + 14, 67 + bob)
        gun_muzzle = (body_x + 45, 66 + bob)
        gun_angle = [4, 1, 3, 0][index]
        left_hand = (body_x + 11, 69 + bob)
        right_hand = (body_x + 19, 67 + bob)
    else:
        body_x = [61, 66, 69, 63][index]
        bob = [1, -2, -1, 2][index]
        lean = [-2, 6, 8, 0][index]
        front_foot = [(73, 110), (76, 111), (78, 111), (72, 110)][index]
        back_foot = [(54, 110), (52, 109), (51, 108), (55, 110)][index]
        gun_grip = [(78, 63), (84, 60), (86, 60), (80, 65)][index]
        gun_muzzle = [(108, 62), (116, 58), (119, 60), (106, 68)][index]
        gun_angle = [0, -1, 1, 3][index]
        left_hand = (gun_grip[0] - 3, gun_grip[1] + 2)
        right_hand = (gun_grip[0] + 7, gun_grip[1] + 1)

    draw_gunner_shadow(draw, bob // 2)

    if state == "move":
        for offset in range(3):
            y = 47 + index * 5 + offset * 13
            draw.line((22 - offset * 9, y, 4 - offset * 8, y - 3), fill=(255, 225, 150, 78), width=2)
        for offset in range(2):
            draw.ellipse((36 - offset * 12, 106 + offset * 2, 51 - offset * 12, 111 + offset * 2), fill=(218, 169, 93, 50))

    if state == "attack" and index in (1, 2):
        draw.line((gun_muzzle[0] - 12, gun_muzzle[1] + 5, gun_muzzle[0] - 30, gun_muzzle[1] + 11), fill=(255, 224, 128, 90), width=3)

    hair_tail = [
        (body_x - 20 - lean // 2, 32 + bob),
        (body_x - 39 - lean, 45 + bob),
        (body_x - 32 - lean, 66 + bob),
        (body_x - 16, 58 + bob),
    ]
    draw.polygon(hair_tail, fill=outline)
    draw.polygon([(x + 2, y + 1) for x, y in hair_tail], fill=hair)
    draw.ellipse((body_x - 36 - lean, 48 + bob, body_x - 17 - lean, 69 + bob), fill=hair_dark)

    draw_gunner_leg(draw, (body_x - 8, 80 + bob), back_foot, sock, outline)
    draw_gunner_leg(draw, (body_x + 8, 80 + bob), front_foot, sock, outline)

    body_poly = [
        (body_x - 15 + lean // 3, 52 + bob),
        (body_x + 15 + lean // 2, 52 + bob),
        (body_x + 13 + lean // 2, 78 + bob),
        (body_x - 13 + lean // 3, 78 + bob),
    ]
    draw.polygon(body_poly, fill=outline)
    draw.polygon([(x, y + 2) for x, y in body_poly], fill=jacket)
    draw.rectangle((body_x - 9 + lean // 3, 58 + bob, body_x + 10 + lean // 2, 64 + bob), fill=jacket_light)
    draw.polygon(
        [(body_x - 15, 75 + bob), (body_x + 16, 75 + bob), (body_x + 22, 91 + bob), (body_x - 21, 91 + bob)],
        fill=outline,
    )
    draw.polygon(
        [(body_x - 12, 76 + bob), (body_x + 13, 76 + bob), (body_x + 17, 88 + bob), (body_x - 17, 88 + bob)],
        fill=skirt,
    )

    draw.polygon(
        [(body_x - 15, 51 + bob), (body_x + 13, 54 + bob), (body_x + 2, 63 + bob), (body_x - 18, 59 + bob)],
        fill=scarf,
    )

    draw_gunner_arm(draw, (body_x - 12, 57 + bob), left_hand, jacket_light, outline, width=5)
    draw_gunner_arm(draw, (body_x + 10, 58 + bob), right_hand, jacket_light, outline, width=5)
    draw_gunner_gun(draw, gun_grip, gun_muzzle, gun_angle)

    draw.ellipse((body_x - 17 + lean // 3, 26 + bob, body_x + 16 + lean // 3, 57 + bob), fill=outline)
    draw.ellipse((body_x - 14 + lean // 3, 29 + bob, body_x + 13 + lean // 3, 55 + bob), fill=skin)
    draw.pieslice((body_x - 18 + lean // 3, 22 + bob, body_x + 18 + lean // 3, 50 + bob), 180, 360, fill=hair)
    draw.polygon(
        [
            (body_x - 16 + lean // 3, 36 + bob),
            (body_x - 7 + lean // 3, 25 + bob),
            (body_x + 1 + lean // 3, 40 + bob),
            (body_x + 10 + lean // 3, 27 + bob),
            (body_x + 17 + lean // 3, 42 + bob),
            (body_x + 8 + lean // 3, 35 + bob),
            (body_x - 1 + lean // 3, 39 + bob),
            (body_x - 9 + lean // 3, 34 + bob),
        ],
        fill=hair,
    )
    draw.line((body_x - 10 + lean // 3, 42 + bob, body_x - 5 + lean // 3, 42 + bob), fill=outline, width=2)
    draw.line((body_x + 5 + lean // 3, 42 + bob, body_x + 10 + lean // 3, 42 + bob), fill=outline, width=2)
    draw.line((body_x - 1 + lean // 3, 49 + bob, body_x + 6 + lean // 3, 48 + bob), fill=skin_shadow, width=1)
    draw.rectangle((body_x + 12 + lean // 3, 42 + bob, body_x + 17 + lean // 3, 49 + bob), fill=hair_dark)

    if state == "attack" and index in (1, 2):
        draw_muzzle_flash(draw, (gun_muzzle[0] + 4, gun_muzzle[1] + gun_angle), 1 if index == 1 else 2)

    return image.resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.NEAREST)


def add_anime_hero_attack_effect(frame, index, x_offset, y_offset):
    if index not in (1, 2):
        return frame

    draw = ImageDraw.Draw(frame)
    muzzle = (419 + int(x_offset), 178 + int(y_offset))
    flash_scale = 1 if index == 1 else 2
    draw.line((muzzle[0] - 72, muzzle[1] + 24, muzzle[0] - 28, muzzle[1] + 13), fill=(255, 230, 140, 88), width=5)
    draw.line((muzzle[0] + 8, muzzle[1] + 5, muzzle[0] + 82, muzzle[1] + 1), fill=(255, 221, 92, 128), width=3)
    draw_muzzle_flash(draw, muzzle, flash_scale)
    return frame


def build_hero_sheet(unit, state):
    source = Image.open(ROOT / unit["source"]).convert("RGBA")
    profiles = {
        "idle": [
            {"x": 0, "y": 6, "scale": 0.98, "alpha": 0.98, "rotate": 0},
            {"x": 0, "y": 0, "scale": 1.00, "alpha": 1.00, "rotate": 0},
            {"x": 0, "y": 3, "scale": 1.01, "alpha": 1.00, "rotate": 0},
            {"x": 0, "y": 8, "scale": 0.99, "alpha": 0.99, "rotate": 0},
        ],
        "move": [
            {"x": -20, "y": 8, "scale": 1.00, "alpha": 0.98, "rotate": -3},
            {"x": 2, "y": -5, "scale": 1.03, "alpha": 1.00, "rotate": 1},
            {"x": 20, "y": 8, "scale": 1.00, "alpha": 0.98, "rotate": 3},
            {"x": 4, "y": -2, "scale": 1.02, "alpha": 1.00, "rotate": -1},
        ],
        "attack": [
            {"x": -6, "y": 2, "scale": 1.00, "alpha": 1.00, "rotate": 0},
            {"x": 8, "y": -3, "scale": 1.02, "alpha": 1.00, "rotate": -1},
            {"x": -18, "y": 0, "scale": 1.03, "alpha": 1.00, "rotate": 1},
            {"x": 0, "y": 5, "scale": 1.00, "alpha": 0.98, "rotate": 0},
        ],
    }

    sheet = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))
    for index, profile in enumerate(profiles[state]):
        frame = transform_sprite(
            source,
            profile["x"],
            profile["y"],
            profile["scale"],
            profile["alpha"],
            profile["rotate"],
        )

        if state == "move":
            frame = add_hero_move_effect(frame, 1, index)
        elif state == "attack":
            frame = add_anime_hero_attack_effect(frame, index, profile["x"], profile["y"])

        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))

    return sheet


def build_hero_sheet_for_state(unit, state):
    if state == "idle":
        return build_hero_sheet(unit, "idle")
    if state == "attack":
        return build_hero_sheet(unit, "attack")

    return build_hero_sheet(unit, "move")


def build_sheet(unit, state):
    if unit["style"] == "hero":
        return build_hero_sheet_for_state(unit, state)

    source_path = unit["source"]
    direction = unit["direction"]
    style = unit["style"]
    source = Image.open(ROOT / source_path).convert("RGBA")
    sheet = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))
    profile = STATE_PROFILES[style][state]

    for index, frame_profile in enumerate(profile):
        signed_x = frame_profile["x"] * direction if state in ("move", "attack") else frame_profile["x"]
        frame = transform_sprite(
            source,
            signed_x,
            frame_profile["y"],
            frame_profile["scale"],
            frame_profile["alpha"],
            frame_profile.get("rotate", 0),
        )
        frame = add_shadow(frame, 42 if state == "idle" else 55)

        if state == "idle":
            frame = add_idle_effect(frame, index)
        elif state == "move":
            if style == "pet":
                frame = add_pet_move_effect(frame, direction, index, unit["key"])
            elif style == "monster":
                frame = add_monster_move_effect(frame, direction, index, unit["key"])
            else:
                frame = add_move_effect(frame, direction, index, style)
        elif state == "attack":
            frame = ImageEnhance.Contrast(frame).enhance(1.05 if index in (1, 2) else 1.0)
            if style == "pet":
                frame = draw_pet_attack_effect(frame, direction, index, unit["key"])
            elif style == "monster":
                frame = draw_monster_attack_effect(frame, direction, index, unit["key"])
            else:
                frame = add_attack_effect(frame, direction, index, style)

        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))

    return sheet


def main():
    generated = []
    for unit in UNITS:
        category = unit["category"]
        unit_key = unit["key"]
        output_dir = ROOT / "images" / "sprites" / "battle" / category
        output_dir.mkdir(parents=True, exist_ok=True)

        for state in ("idle", "move", "attack"):
            sheet = build_sheet(unit, state)
            output_path = output_dir / f"{unit_key}_{state}_sheet.png"
            sheet.save(output_path)
            generated.append(output_path.relative_to(ROOT))

    for output_path in generated:
        print(output_path)


if __name__ == "__main__":
    main()
