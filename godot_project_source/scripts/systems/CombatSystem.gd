extends Node

class_name CombatSystem

# Configuration
var config = {
	"monster_spawn_interval": 2.0, # seconds
	"attack_interval": 0.8,
	"bullet_speed": 300.0,
	"max_monsters": 10
}

# State
var spawn_timer = 0.0
var attack_timer = 0.0
var map_width = 400.0
var map_height = 400.0

# Entities (In Godot, these would likely be Nodes in the scene tree)
# For this migration script, we will store DATA here, but ideally you instantiate scenes.
var monsters = []
var bullets = []
var explosions = []
var combat_texts = [] # Floating Text

# Dependencies
var player_system = null
var resource_system = null

# Monster Templates
var monster_templates = [
	{ "id": "slime", "name": "Slime", "baseHp": 30, "baseAttack": 3, "speed": 25, "coinReward": 8, "size": 35 },
	{ "id": "bat", "name": "Bat", "baseHp": 25, "baseAttack": 5, "speed": 45, "coinReward": 12, "size": 32 },
	{ "id": "skeleton", "name": "Skeleton", "baseHp": 50, "baseAttack": 8, "speed": 30, "coinReward": 20, "size": 40 },
	# ... others
]

func _init():
	print("[CombatSystem] Initialized")

func set_player_system(sys):
	player_system = sys

func set_resource_system(sys):
	resource_system = sys

func update_logic(delta):
	update_spawn(delta)
	update_attack(delta)
	update_monsters(delta)
	update_bullets(delta)
	update_explosions(delta)
	update_combat_texts(delta)
	check_collisions() # Note: In Godot, use Area2D signals instead!

func update_spawn(delta):
	if monsters.size() >= config.max_monsters: return
	
	spawn_timer += delta
	if spawn_timer >= config.monster_spawn_interval:
		spawn_timer = 0
		spawn_monster()

func spawn_monster():
	# Logic to pick template based on level...
	var template = monster_templates[randi() % monster_templates.size()]
	
	# Basic stats scaling
	var level_scale = 1.0 # Simplify for now
	if player_system:
		level_scale = 1.0 + (player_system.player_data.level - 1) * 0.15
	
	var monster = {
		"templateId": template.id,
		"x": map_width + 20,
		"y": map_height * 0.55 + randf() * (map_height * 0.2),
		"width": template.size,
		"height": template.size,
		"hp": floor(template.baseHp * level_scale),
		"maxHp": floor(template.baseHp * level_scale),
		"attack": floor(template.baseAttack * level_scale),
		"speed": template.speed + randf() * 10,
		"coinReward": floor(template.coinReward * level_scale),
		"isBoss": false
	}
	
	monsters.append(monster)

func update_attack(delta):
	if not player_system or monsters.is_empty(): return
	
	var player = player_system.player_data
	var interval = config.attack_interval / player.attack_speed
	
	attack_timer += delta
	if attack_timer >= interval:
		attack_timer = 0
		fire_at_nearest()

func fire_at_nearest():
	var player = player_system.player_data
	# Sort monsters by dist
	monsters.sort_custom(func(a, b):
		var da = (Vector2(a.x, a.y) - Vector2(player.x, player.y)).length()
		var db = (Vector2(b.x, b.y) - Vector2(player.x, player.y)).length()
		return da < db
	)
	
	var count = min(player.multi_shot, monsters.size())
	for i in range(count):
		fire_bullet(monsters[i])

func fire_bullet(target):
	var player = player_system.player_data
	var is_crit = (randf() * 100) < player.crit
	var dmg = player.attack
	if is_crit:
		dmg *= player.crit_damage / 100.0
		
	var start_pos = Vector2(player.x + player.width/2, player.y + player.height/2)
	var target_pos = Vector2(target.x + target.width/2, target.y + target.height/2)
	var dir = (target_pos - start_pos).normalized()
	
	var bullet = {
		"x": start_pos.x,
		"y": start_pos.y,
		"vx": dir.x * config.bullet_speed,
		"vy": dir.y * config.bullet_speed,
		"damage": dmg,
		"isCrit": is_crit,
		"size": 6
	}
	bullets.append(bullet)

func update_monsters(delta):
	# Using filter equivalent in GDScript
	var kept = []
	for m in monsters:
		m.x -= m.speed * delta
		if m.x + m.width >= 0:
			kept.append(m)
	monsters = kept

func update_bullets(delta):
	var kept = []
	for b in bullets:
		b.x += b.vx * delta
		b.y += b.vy * delta
		if b.x >= -10 and b.x <= map_width + 10 and b.y >= -10 and b.y <= map_height + 10:
			kept.append(b)
	bullets = kept

func update_explosions(delta):
	var kept = []
	for e in explosions:
		e.life -= delta # seconds
		e.radius += delta * 50 # scaling speed
		if e.life > 0:
			kept.append(e)
	explosions = kept
	
func update_combat_texts(delta):
	var kept = []
	for t in combat_texts:
		t.life -= delta
		t.y -= delta * 50
		if t.life > 0:
			kept.append(t)
	combat_texts = kept

func check_collisions():
	var bullets_to_remove = []
	var monsters_to_remove = []
	
	for bi in range(bullets.size()):
		for mi in range(monsters.size()):
			if bullets_to_remove.has(bi) or monsters_to_remove.has(mi):
				continue
				
			var b = bullets[bi]
			var m = monsters[mi]
			
			if is_colliding(b, m):
				bullets_to_remove.append(bi)
				m.hp -= b.damage
				add_combat_text(m.x, m.y, b.damage, b.isCrit)
				
				if m.hp <= 0:
					if not monsters_to_remove.has(mi):
						monsters_to_remove.append(mi)
						on_monster_killed(m)
	
	# Reverse remove to keep indices valid? Or rebuild
	# Rebuilding is safer
	var new_bullets = []
	for i in range(bullets.size()):
		if not bullets_to_remove.has(i): new_bullets.append(bullets[i])
	bullets = new_bullets
	
	var new_monsters = []
	for i in range(monsters.size()):
		if not monsters_to_remove.has(i): new_monsters.append(monsters[i])
	monsters = new_monsters

func is_colliding(a, b):
	var a_size = a.get("size", a.get("width", 10))
	var b_size = b.get("size", b.get("width", 10))
	var dist = Vector2(a.x, a.y).distance_to(Vector2(b.x, b.y))
	return dist < (a_size + b_size) / 2

func add_combat_text(x, y, dmg, is_crit):
	combat_texts.append({
		"x": x,
		"y": y,
		"text": str(int(dmg)) + ("!" if is_crit else ""),
		"life": 0.8 # seconds
	})

func on_monster_killed(m):
	explosions.append({
		"x": m.x + m.width/2,
		"y": m.y + m.height/2,
		"radius": 10,
		"life": 0.3
	})
	if resource_system:
		resource_system.add_coins(m.coinReward)
