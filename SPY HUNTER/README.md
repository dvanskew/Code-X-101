# Spy Hunter Clone

This project recreates key mechanics from the early 1980s arcade game *Spy Hunter* using HTML, CSS, and vanilla JavaScript. The goal is to provide a self-contained, browser-playable experience without external dependencies.

## Features

- Fast vertical scrolling highway with lane markings, shoulder boundaries, and attract-mode overlay.
- Player-controlled Interceptor with analog steering, throttle/brake, and forward cannon fire.
- Enemy agents spawn in lanes with varied behaviours (tracking, swerving) and award points when destroyed.
- Oil slick gadget deployable behind the car to spin out trailing vehicles; limited charges per mission.
- Score, lives, weapons, and persistent high-score tracking (stored in `localStorage`).
- Pause toggle, start/game-over overlays, and responsive HUD updates.

## Controls

- **Move**: Arrow keys or WASD
- **Fire Cannon**: `J` or `Space`
- **Deploy Oil Slick**: `K`
- **Pause**: `P`
- **Start / Restart**: `Enter` or click the on-screen button

## Running the Game

1. Open `src/index.html` in any modern desktop browser (Chrome, Edge, Firefox, Safari).
2. Press the start button or the `Enter` key to begin.
3. Keep the Interceptor alive, rack up points, and chase the high score saved to your browser.

No build step or external dependencies are required.

## Implementation Notes

- Rendering uses a single `<canvas>` with a fixed resolution of 480x640, styled via CSS for presentation.
- Game state is managed manually (attract, running, paused, game-over) with a deterministic update loop and capped delta time.
- Entities (player, enemies, projectiles, hazards, explosions) share axis-aligned bounding box collision checks.
- High scores persist using `localStorage` under the key `spyhunter_highscore`; clearing site data resets it.
