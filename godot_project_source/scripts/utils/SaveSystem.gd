extends Node

class_name SaveSystem

const MAX_SLOTS = 5
const SAVE_DIR = "user://saves/"

# Dependencies
# In Godot we can use a dictionary or references to nodes
var game_systems = {}

func _init():
	if not DirAccess.dir_exists_absolute(SAVE_DIR):
		DirAccess.make_dir_absolute(SAVE_DIR)
	print("[SaveSystem] Initialized")

func set_game_systems(systems):
	game_systems = systems # Expects dict: { "player": node, "resource": node, ... }

func get_save_path(slot):
	return SAVE_DIR + "save_%d.json" % slot

func save_game(slot):
	if slot < 1 or slot > MAX_SLOTS: return false
	
	var save_data = {
		"version": "1.0.0",
		"timestamp": Time.get_unix_time_from_system(),
		"slot": slot,
		"data": {}
	}
	
	# Collect Data
	if game_systems.has("player"):
		save_data.data.player = game_systems.player.get_save_data()
	if game_systems.has("resource"):
		save_data.data.resource = game_systems.resource.get_save_data()
	if game_systems.has("combat"):
		save_data.data.combat = game_systems.combat.get_save_data()
	if game_systems.has("pet"):
		save_data.data.pet = game_systems.pet.get_save_data()
	if game_systems.has("territory"):
		save_data.data.territory = game_systems.territory.get_save_data()
		
	# Write File
	var file = FileAccess.open(get_save_path(slot), FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_data))
		print("[SaveSystem] Saved to slot ", slot)
		return true
	else:
		print("[SaveSystem] Error saving file: ", FileAccess.get_open_error())
		return false

func load_game(slot):
	if slot < 1 or slot > MAX_SLOTS: return false
	
	var path = get_save_path(slot)
	if not FileAccess.file_exists(path):
		print("[SaveSystem] No save file in slot ", slot)
		return false
		
	var file = FileAccess.open(path, FileAccess.READ)
	if not file: return false
	
	var content = file.get_as_text()
	var json = JSON.new()
	var error = json.parse(content)
	
	if error != OK:
		print("[SaveSystem] JSON Parse Error")
		return false
		
	var data = json.data
	
	# Load Data
	var systems_data = data.get("data", {})
	if game_systems.has("player") and systems_data.has("player"):
		game_systems.player.load_save_data(systems_data.player)
	if game_systems.has("resource") and systems_data.has("resource"):
		game_systems.resource.load_save_data(systems_data.resource)
	# ... others
	
	print("[SaveSystem] Loaded slot ", slot)
	return true
