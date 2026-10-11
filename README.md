# Novaeriah Engine

**Ashen Isle** is a browser-playable vertical slice for Novaeriah: a martial-arts role-playing game prototype built to run directly on GitHub Pages.

## Play locally

Open `index.html` with a local web server (the game imports Three.js from a public CDN). No install or build step is required.

## Controls

- `WASD` — move and look with the mouse after entering the world
- Double-tap `W` — sprint
- Hold `Shift` while moving — expend Ki for a Ki Flow speed boost
- Hold `Shift` while still — meditate to replenish Ki and a little Health
- Left mouse button — punch
- `Z`, `X`, `C` — Palm Strike, Sky Step, Guard Break
- `E` — speak to villagers
- `M` — inventory, stats, skills, and map

## Included foundation

- Procedurally shaped island terrain, water, ruins, trees, and distant mainland
- Cube-body survivors and attackers, interaction dialogue, enemy pursuit, health and damage numbers
- Ki, meditation, double-tap sprint, Ki Flow movement, and three starter martial skills
- A map, player HUD, inventory/stats/skills menu, and simple quest progression

This is intentionally dependency-free apart from the Three.js browser import, so it is ready for static GitHub Pages hosting. Later native-engine work can mirror these gameplay systems in C++/OpenGL/ImGui.
