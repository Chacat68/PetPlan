extends Node

class_name TerritorySystem

# Config
var building_data = {
	"main_base": {
		"name": "Main Base",
		"baseCost": { "coins": 0, "crystals": 0 },
		"costMultiplier": 2.0,
		"maxLevel": 5,
		"effects": { "type": "slotUnlock", "value": 2 },
		"productionInterval": 0
	},
	"training_ground": {
		"name": "Training Ground",
		"baseCost": { "coins": 500, "crystals": 50 },
		"costMultiplier": 1.5,
		"maxLevel": 20,
		"effects": { "type": "attackBonus", "value": 5 },
		"productionInterval": 0
	},
	"workshop": {
		"name": "Workshop",
		"baseCost": { "coins": 1000, "crystals": 100 },
		"costMultiplier": 1.8,
		"maxLevel": 10,
		"effects": { "type": "production", "resource": "coins", "value": 50 },
		"productionInterval": 60.0 # seconds
	},
	# ... others
}

var slot_config = {
	"maxSlots": 12,
	"unlockLevels": [0, 5, 10, 15, 20, 25] # 0-indexed slots
}

# State
var slots = []
var buildings = []
var unlocked_slots = 6
var expansion_count = 0
var last_production_time = 0

# Dependencies
var resource_system = null
var player_system = null

func _init():
	print("[TerritorySystem] Initialized")
	init_slots()

func init_slots():
	slots = []
	for i in range(slot_config.maxSlots):
		slots.append({
			"index": i,
			"unlockLevel": slot_config.unlockLevels[i] if i < slot_config.unlockLevels.size() else 999,
			"building": null
		})

func set_systems(res_sys, player_sys):
	resource_system = res_sys
	player_system = player_sys

func is_slot_unlocked(index):
	if index < 0 or index >= slots.size(): return false
	var player_level = 1
	if player_system: player_level = player_system.player_data.level
	
	if index < 6:
		return player_level >= slots[index].unlockLevel
	return index < unlocked_slots

func can_build(type, slot_index):
	if not is_slot_unlocked(slot_index): return {"success": false, "reason": "Locked"}
	if slots[slot_index].building != null: return {"success": false, "reason": "Occupied"}
	if not building_data.has(type): return {"success": false, "reason": "Invalid Type"}
	
	var data = building_data[type]
	if resource_system:
		if not resource_system.has_enough_coins(data.baseCost.coins):
			return {"success": false, "reason": "Not Enough Coins"}
			
	return {"success": true}

func build_building(type, slot_index):
	var check = can_build(type, slot_index)
	if not check.success: return check
	
	var data = building_data[type]
	if resource_system:
		resource_system.spend_coins(data.baseCost.coins)
		# ... crystals
	
	var building = {
		"id": "b_%d_%d" % [Time.get_unix_time_from_system(), slot_index],
		"type": type,
		"slotIndex": slot_index,
		"level": 1,
		"lastProduction": Time.get_unix_time_from_system()
	}
	
	buildings.append(building)
	slots[slot_index].building = building
	
	return {"success": true, "building": building}

func collect_resources():
	var now = Time.get_unix_time_from_system()
	var collected = {"coins": 0, "crystals": 0}
	
	for b in buildings:
		var data = building_data[b.type]
		if data.productionInterval <= 0: continue
		
		# data.productionInterval is in seconds (converted from my mind, JS was ms maybe?)
		# JS was 60000ms = 60s. I used 60.0 in Config above.
		# Time.get_unix_time_from_system() returns seconds (float).
		
		var elapsed = now - b.lastProduction
		var cycles = floor(elapsed / data.productionInterval)
		
		if cycles > 0:
			var amount = data.effects.value * b.level * cycles
			if data.effects.resource == "coins":
				collected.coins += amount
				if resource_system: resource_system.add_coins(amount)
			# ... crystals
			
			b.lastProduction = now - fmod(elapsed, data.productionInterval)
			
	return collected

func get_save_data():
	return {
		"buildings": buildings,
		"unlockedSlots": unlocked_slots,
		"expansionCount": expansion_count,
		"lastProductionTime": last_production_time
	}

func load_save_data(data):
	if not data: return
	unlocked_slots = data.get("unlockedSlots", 6)
	expansion_count = data.get("expansionCount", 0)
	
	init_slots()
	buildings = []
	
	var saved_buildings = data.get("buildings", [])
	for bd in saved_buildings:
		buildings.append(bd)
		if bd.slotIndex < slots.size():
			slots[bd.slotIndex].building = bd
