extends Node

# This script should be attached to the Root Node of your Main Scene (e.g. "Main" Node2D or Control)

var game_core: GameCore
var resource_system: ResourceSystem
var player_system: PlayerSystem
var pet_system: PetSystem
var territory_system: TerritorySystem
var combat_system: CombatSystem
var save_system: SaveSystem

func _ready():
	print("[Main] Initializing Game...")
	
	# 1. Initialize Resource System
	resource_system = ResourceSystem.new()
	add_child(resource_system)
	
	# 2. Player System
	player_system = PlayerSystem.new()
	player_system.set_resource_system(resource_system)
	add_child(player_system)
	
	# 3. Pet System
	pet_system = PetSystem.new()
	pet_system.set_systems(resource_system, player_system)
	add_child(pet_system)
	
	# 4. Combat System
	combat_system = CombatSystem.new()
	combat_system.set_player_system(player_system)
	combat_system.set_resource_system(resource_system)
	add_child(combat_system)
	
	# 5. Territory System
	territory_system = TerritorySystem.new()
	territory_system.set_systems(resource_system, player_system)
	add_child(territory_system)
	
	# 6. Save System
	save_system = SaveSystem.new()
	save_system.set_game_systems({
		"player": player_system,
		"resource": resource_system,
		"combat": combat_system,
		"pet": pet_system,
		"territory": territory_system
	})
	add_child(save_system)
	
	# 7. Game Core
	game_core = GameCore.new()
	game_core.set_systems({
		"player": player_system,
		"combat": combat_system,
		"resource": resource_system,
		"save": save_system,
		"pet": pet_system,
		"territory": territory_system
	})
	add_child(game_core)
	
	# Load Game
	save_system.load_game(1)
	
	# Start Game
	game_core.start()
	
	print("[Main] Game Started!")
