extends Node

class_name GameCore

# Configuration
var config = {
	"base_width": 750,
	"base_height": 1800,
	"width": 750,
	"height": 1800,
	"target_fps": 60,
	"auto_save_interval": 30.0 # seconds
}

# State
var is_running = false
var scale_factor = 1.0
var auto_save_timer = 0.0

# Systems (In Godot, these might be children nodes or Autoloads)
# We will assume they are children nodes for this port to keep structure similar
var systems = {}

# Scene Elements (Clouds etc would be Nodes in the scene, effectively)
var clouds = []

func _ready():
	print("[GameCore] Initializing...")
	# In Godot, 'resizeCanvas' is handled by Window project settings, 
	# but we can hook into size_changed if needed.
	get_tree().root.size_changed.connect(_on_window_resize)
	_on_window_resize()
	
	# Initialize clouds (simple data structure port)
	clouds = _generate_clouds()
	
	# Start if needed
	start()

func set_systems(new_systems):
	systems = new_systems

func _generate_clouds():
	var new_clouds = []
	for i in range(5):
		new_clouds.append({
			"x": randf() * config.width,
			"y": 30 + randf() * 60,
			"size": 20 + randf() * 30,
			"speed": 10 + randf() * 20
		})
	return new_clouds

func start():
	if is_running: return
	is_running = true
	set_process(true)
	print("[GameCore] Game Started")

func stop():
	is_running = false
	set_process(false)
	print("[GameCore] Game Stopped")

func _process(delta):
	# Loop is controlled by Godot engine
	if not is_running: return
	
	# Update logic
	_update_logic(delta)
	
	# Render is handled by Godot's scene graph traversal

func _update_logic(delta):
	# Update Systems
	if systems.has("player"):
		systems.player.update_logic(delta)
	
	if systems.has("combat"):
		systems.combat.update_logic(delta)
		
	# Update Clouds
	_update_clouds(delta)
	
	# Auto Save
	auto_save_timer += delta
	if auto_save_timer >= config.auto_save_interval:
		auto_save_timer = 0
		if systems.has("save"):
			systems.save.save_game(1)

func _update_clouds(delta):
	for cloud in clouds:
		cloud.x += cloud.speed * delta
		if cloud.x > config.width + cloud.size:
			cloud.x = -cloud.size
			cloud.y = 30 + randf() * 60
	# Note: Visual update would happen in a _draw or by moving Sprites

func _on_window_resize():
	# Handle resolution changes logic mirroring JS 'resizeCanvas'
	var viewport_size = get_viewport().get_visible_rect().size
	config.width = viewport_size.x
	config.height = viewport_size.y
	
	if systems.has("combat"):
		systems.combat.map_width = config.width
		systems.combat.map_height = config.height
		
	print("[GameCore] Resized to ", viewport_size)

# Helper for resolution setting (Ported logic)
func set_resolution(w, h):
	if w == null or h == null:
		# Auto mode - usually full window
		# In Godot, you might set the window size or viewport size
		DisplayServer.window_set_size(Vector2i(750, 1334)) # Default?
	else:
		DisplayServer.window_set_size(Vector2i(w, h))
