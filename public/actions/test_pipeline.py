import json, os

config = {
    "name": "Cherry Blossom Night",
    "actions_dir": r"C:\Users\Aiden\Desktop\actions",
    "steps": [
        {"action": "init_gpu", "config": {}},
        {"action": "clear_scene", "config": {}},
        {"action": "set_sky", "config": {"preset": "night", "strength": 0.5}},
        {"action": "add_ground", "config": {"preset": "grass", "location": [0, 5, -0.02]}},
        {"action": "add_camera", "config": {"location": [0.5, -3.5, 1.0], "rotation_deg": [78, 0, 3], "lens": 35}},
        {"action": "add_lighting", "config": {"preset": "moonlit"}},
        {"action": "add_props", "config": {"props": [
            {"type": "cherry_tree", "location": [0, 2], "height": 4.0, "seed": 42},
            {"type": "cherry_tree", "location": [-2, 4], "height": 3.0, "seed": 88},
            {"type": "stone_lantern", "location": [2, 3]},
            {"type": "stone_lantern", "location": [-1.5, 1]},
            {"type": "rock_cluster", "center": [1.5, 4, 0], "count": 4, "seed": 33},
            {"type": "torii_gate", "location": [0, 6], "height": 3.5, "width": 3.0},
            {"type": "fireflies", "count": 20, "seed": 55},
            {"type": "moon", "location": [-6, 15, 10], "radius": 1.2}
        ]}},
        {"action": "render_cycles", "config": {
            "output_name": "cherry_blossom_night",
            "blend_path": r"C:\Users\Aiden\Desktop\cherry_blossom_night.blend",
            "open_after": True
        }}
    ]
}

config_path = r"C:\Users\Aiden\Desktop\pipeline_test.json"
with open(config_path, 'w') as f:
    json.dump(config, f, indent=2)
print(f"Config written to {config_path}")
