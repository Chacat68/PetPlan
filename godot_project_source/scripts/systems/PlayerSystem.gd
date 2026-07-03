extends Node

class_name PlayerSystem

# Data
var player_data = {
	"x": 60,
	"y": 300,
	"width": 40,
	"height": 40,
	
	"level": 1,
	"exp": 0,
	"exp_to_next": 100,
	
	"hp": 100,
	"max_hp": 100,
	"attack": 20,
	"defense": 0,
	"hp_regen": 1,
	"crit_damage": 150,
	"attack_speed": 1.0,
	"crit": 5,
	"multi_shot": 1
}

var upgrade_costs = {
	"attack": 10,
	"max_hp": 15,
	"hp_regen": 20,
	"crit_damage": 25,
	"attack_speed": 30,
	"crit": 35,
	"multi_shot": 40
}

var upgrade_increments = {
	"attack": 5,
	"max_hp": 20,
	"hp_regen": 1,
	"crit_damage": 10,
	"attack_speed": 0.1,
	"crit": 1,
	"multi_shot": 1
}

var upgrade_limits = {
	"attack_speed": 10,
	"crit": 100,
	"multi_shot": 10
}

# Dependencies
var resource_system = null

# State
var animation_timer = 0.0
var regen_timer = 0.0

func _init():
	print("[PlayerSystem] Initialized")

func set_resource_system(sys):
	resource_system = sys

func upgrade_attribute(attr: String) -> Dictionary:
	if not upgrade_costs.has(attr):
		return {"success": false, "message": "Invalid Attribute"}
		
	var cost = upgrade_costs[attr]
	var increment = upgrade_increments[attr]
	
	# Check Limits
	if upgrade_limits.has(attr) and player_data[attr] >= upgrade_limits[attr]:
		return {"success": false, "message": "Max Level Reached"}
		
	# Check Cost
	if resource_system and not resource_system.has_enough_coins(cost):
		return {"success": false, "message": "Not Enough Coins"}
		
	# Pay
	if resource_system:
		resource_system.spend_coins(cost)
		
	# Apply
	player_data[attr] += increment
	
	if attr == "max_hp":
		# Heal when upgrading max HP logic
		player_data.hp = min(player_data.hp + increment, player_data.max_hp)
		
	# Increase Cost
	upgrade_costs[attr] = floor(cost * 1.15)
	
	# Emit signal or update UI hook here
	# update_display()
	
	return {"success": true, "message": "%s +%s" % [attr, str(increment)]}

func calculate_total_power() -> int:
	var p = player_data
	return floor(
		p.attack * 10 +
		p.max_hp * 0.5 +
		p.defense * 5 +
		p.hp_regen * 2 +
		p.crit_damage * 0.1 +
		p.attack_speed * 50 +
		p.crit * 3 +
		p.multi_shot * 100
	)

func update_logic(delta):
	# Regen
	regen_timer += delta * 1000 # Convert to ms for consistency with JS logic if needed, or stick to seconds
	# Using seconds is better in Godot:
	# JS usage was: if (regenTimer >= 1000)
	
	# Let's use seconds accumulation
	# regen_timer is in ms in JS logic (delta is ms there?), wait:
	# In JS requestAnimationFrame passes ms? No, usually high res time.
	# JS `update(deltaTime)`: Main.js calculates delta = currentTime - lastTime (ms)
	# So 1000 ms = 1 sec.
	
	if regen_timer >= 1000.0: # Check unit consistency
		regen_timer = 0
		if player_data.hp < player_data.max_hp:
			player_data.hp = min(player_data.hp + player_data.hp_regen, player_data.max_hp)

func get_save_data():
	return {
		"player": player_data.duplicate(),
		"upgrade_costs": upgrade_costs.duplicate()
	}

func load_save_data(data):
	if not data: return
	if data.has("player"):
		# Merge dicts
		for k in data.player:
			player_data[k] = data.player[k]
	if data.has("upgrade_costs"):
		for k in data.upgrade_costs:
			upgrade_costs[k] = data.upgrade_costs[k]

# Render logic is removed as it should be handled by the Node's _draw() or Sprite
# func render(ctx): ...
