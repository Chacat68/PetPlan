extends Node

class_name PetSystem

# Configuration
var pet_templates = [
	{
		"id": 1,
		"name": "Fire Dog",
		"type": "fire",
		"rarity": "common",
		"requiredLevel": 1,
		"cost": { "coins": 500, "rubies": 0 },
		"baseStats": { "attack": 15, "hp": 80, "defense": 5, "attackSpeed": 1.0 },
		"skill": { "name": "Fireball", "cooldown": 5.0, "damage": 50 } # Converted ms to sec
	},
	{
		"id": 2,
		"name": "Ice Cat",
		"type": "ice",
		"rarity": "common",
		"requiredLevel": 1,
		"cost": { "coins": 500, "rubies": 0 },
		"baseStats": { "attack": 12, "hp": 70, "defense": 8, "attackSpeed": 1.2 },
		"skill": { "name": "Frost Nova", "cooldown": 6.0, "damage": 40 }
	},
	# ... Add other pets as needed
]

# State
var unlocked_pets = []
var equipped_pets = []

# Dependencies
var resource_system = null
var player_system = null

func _init():
	print("[PetSystem] Initialized")

func set_systems(res_sys, player_sys):
	resource_system = res_sys
	player_system = player_sys

func unlock_pet(pet_id):
	var template = get_template(pet_id)
	if not template: return {"success": false, "message": "Pet not found"}
	
	for p in unlocked_pets:
		if p.templateId == pet_id:
			return {"success": false, "message": "Already owned"}
			
	if player_system and player_system.player_data.level < template.requiredLevel:
		return {"success": false, "message": "Level required: %d" % template.requiredLevel}
		
	if resource_system:
		if not resource_system.has_enough_coins(template.cost.coins):
			return {"success": false, "message": "Not enough coins"}
		# ... ruby check
		
		resource_system.spend_coins(template.cost.coins)
		
	var new_pet = {
		"instanceId": Time.get_unix_time_from_system() * 1000, # Mock unique ID
		"templateId": pet_id,
		"level": 1,
		"exp": 0,
		"friendship": 0,
		"equipped": false
	}
	
	unlocked_pets.append(new_pet)
	return {"success": true, "message": "Unlocked " + template.name, "pet": new_pet}

func equip_pet(instance_id):
	if equipped_pets.size() >= 3:
		return {"success": false, "message": "Max 3 pets equipped"}
		
	var pet = null
	for p in unlocked_pets:
		if p.instanceId == instance_id:
			pet = p
			break
			
	if not pet: return {"success": false, "message": "Pet not found"}
	if pet.equipped: return {"success": false, "message": "Already equipped"}
	
	pet.equipped = true
	equipped_pets.append(pet)
	return {"success": true, "message": "Equipped"}

func unequip_pet(instance_id):
	var index = -1
	for i in range(equipped_pets.size()):
		if equipped_pets[i].instanceId == instance_id:
			index = i
			break
	
	if index == -1: return {"success": false, "message": "Not equipped"}
	
	var pet = equipped_pets[index]
	pet.equipped = false
	equipped_pets.remove_at(index)
	return {"success": true, "message": "Unequipped"}

func get_template(id):
	for t in pet_templates:
		if t.id == id: return t
	return null

func get_total_power_bonus():
	var attack = 0
	var defense = 0
	
	for pet in equipped_pets:
		var template = get_template(pet.templateId)
		if template:
			var multiplier = 1.0 + (pet.level - 1) * 0.1
			attack += template.baseStats.attack * multiplier
			defense += template.baseStats.defense * multiplier
			
	return {"attack": floor(attack), "defense": floor(defense)}

func get_save_data():
	var equipped_ids = []
	for p in equipped_pets:
		equipped_ids.append(p.instanceId)
		
	return {
		"unlockedPets": unlocked_pets,
		"equippedPets": equipped_ids
	}

func load_save_data(data):
	if not data: return
	unlocked_pets = data.get("unlockedPets", [])
	equipped_pets = []
	
	var equipped_ids = data.get("equippedPets", [])
	for id in equipped_ids:
		for p in unlocked_pets:
			# JSON numbers might be floats, cast if needed
			if str(p.instanceId) == str(id): # Safe comparison
				p.equipped = true
				equipped_pets.append(p)
