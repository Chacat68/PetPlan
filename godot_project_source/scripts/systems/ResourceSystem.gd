extends Node

class_name ResourceSystem

# Currency
var coins: float = 1000.0
var rubies: float = 50.0
var crystals: float = 100.0

# Suffixes for formatting
var suffixes = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc"]

# Signals (Godot way of updating UI)
signal resources_updated

func _init():
	print("[ResourceSystem] Initialized")

# ==================== Coins ====================

func add_coins(amount: float):
	if amount <= 0: return
	coins = safe_add(coins, amount)
	update_display()

func spend_coins(amount: float) -> bool:
	if amount <= 0 or coins < amount: return false
	coins -= amount
	update_display()
	return true

func has_enough_coins(amount: float) -> bool:
	return coins >= amount

# ==================== Rubies ====================

func add_rubies(amount: float):
	if amount <= 0: return
	rubies = safe_add(rubies, amount)
	update_display()

func spend_rubies(amount: float) -> bool:
	if amount <= 0 or rubies < amount: return false
	rubies -= amount
	update_display()
	return true

func has_enough_rubies(amount: float) -> bool:
	return rubies >= amount

# ==================== Crystals ====================

func add_crystals(amount: float):
	if amount <= 0: return
	crystals = safe_add(crystals, amount)
	update_display()

func spend_crystals(amount: float) -> bool:
	if amount <= 0 or crystals < amount: return false
	crystals -= amount
	update_display()
	return true

func has_enough_crystals(amount: float) -> bool:
	return crystals >= amount

# ==================== Utils ====================

func safe_add(current, amount):
	var result = current + amount
	# Godot float (64-bit) limit is huge, but we can clamp if needed
	# MAX_SAFE_INTEGER concept primarily applies to JS int precision. 
	# GDScript floats are doubles.
	return result

func format_number(num) -> String:
	if num == null: return "0"
	
	# Basic big number formatting logic
	if num < 1000:
		return str(floor(num))
	
	var suffix_index = 0
	var value = float(num)
	
	while value >= 1000 and suffix_index < suffixes.size() - 1:
		value /= 1000.0
		suffix_index += 1
	
	if value >= 100:
		return str(floor(value)) + suffixes[suffix_index]
	elif value >= 10:
		# %.1f
		return "%.1f" % value + suffixes[suffix_index]
	else:
		# %.2f
		return "%.2f" % value + suffixes[suffix_index]

func update_display():
	# In JS this updated DOM. In Godot, we emit a signal and UI listens to it.
	resources_updated.emit()

# ==================== Save/Load ====================

func get_save_data():
	return {
		"coins": coins,
		"rubies": rubies,
		"crystals": crystals
	}

func load_save_data(data):
	if not data: return
	coins = data.get("coins", 1000.0)
	rubies = data.get("rubies", 50.0)
	crystals = data.get("crystals", 100.0)
	update_display()
