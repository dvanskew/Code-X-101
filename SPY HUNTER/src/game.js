const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const ROAD_WIDTH = 280;
const ROAD_MARGIN = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
const LANES = [ROAD_MARGIN + 48, CANVAS_WIDTH / 2 - 18, CANVAS_WIDTH - ROAD_MARGIN - 66];
const MAX_DELTA = 1 / 24;

const GameState = Object.freeze({
  ATTRACT: "ATTRACT",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  GAME_OVER: "GAME_OVER",
});

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score-value");
const highScoreEl = document.getElementById("high-score-value");
const livesEl = document.getElementById("lives-value");
const weaponEl = document.getElementById("weapon-value");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayMessageEl = document.getElementById("overlay-message");
const overlayFooterEl = document.getElementById("overlay-footer");
const startButton = document.getElementById("start-button");

class InputManager {
  constructor() {
    this.keys = new Map();
    this.pressed = new Set();
    window.addEventListener("keydown", (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      this.keys.set(event.code, true);
      if (!event.repeat) {
        this.pressed.add(event.code);
      }
    });
    window.addEventListener("keyup", (event) => {
      this.keys.set(event.code, false);
    });
    window.addEventListener("blur", () => {
      this.keys.clear();
    });
  }

  isDown(code) {
    return this.keys.get(code);
  }

  consumePress(code) {
    const has = this.pressed.has(code);
    this.pressed.delete(code);
    return has;
  }

  endFrame() {
    this.pressed.clear();
  }
}

const input = new InputManager();

class PlayerCar {
  constructor() {
    this.width = 36;
    this.height = 64;
    this.maxSpeed = 260;
    this.acceleration = 620;
    this.friction = 480;
    this.fireCooldown = 0;
    this.fireRate = 0.25;
     this.gadgetCooldown = 0.75;
    this.gadgetTimer = 0;
    this.oilCharges = 3;
    this.invulnerableTimer = 0;
    this.resetPosition();
    this.resetLoadout();
  }

  resetPosition() {
    this.x = CANVAS_WIDTH / 2 - this.width / 2;
    this.y = CANVAS_HEIGHT - this.height - 36;
    this.speedX = 0;
    this.speedY = 0;
    this.facing = 0;
  }

  resetLoadout() {
    this.fireCooldown = 0;
    this.gadgetTimer = 0;
    this.oilCharges = 3;
    this.invulnerableTimer = 0;
  }

  update(dt) {
    const left = input.isDown("ArrowLeft") || input.isDown("KeyA");
    const right = input.isDown("ArrowRight") || input.isDown("KeyD");
    const up = input.isDown("ArrowUp") || input.isDown("KeyW");
    const down = input.isDown("ArrowDown") || input.isDown("KeyS");

    const targetSpeedX = (right - left) * this.maxSpeed;
    const targetSpeedY = (down - up) * (this.maxSpeed * 0.65);

    this.speedX = approach(this.speedX, targetSpeedX, this.acceleration * dt);
    this.speedY = approach(this.speedY, targetSpeedY, this.acceleration * dt);

    if (!left && !right) {
      this.speedX = approach(this.speedX, 0, this.friction * dt);
    }
    if (!up && !down) {
      this.speedY = approach(this.speedY, 0, this.friction * dt);
    }

    this.x += this.speedX * dt;
    this.y += this.speedY * dt;

    const minX = ROAD_MARGIN + 12;
    const maxX = CANVAS_WIDTH - ROAD_MARGIN - this.width - 12;
    const minY = CANVAS_HEIGHT * 0.4;
    const maxY = CANVAS_HEIGHT - this.height - 12;

    this.x = clamp(this.x, minX, maxX);
    this.y = clamp(this.y, minY, maxY);

    this.facing = clamp(this.speedX / this.maxSpeed, -1, 1);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    this.gadgetTimer = Math.max(0, this.gadgetTimer - dt);
  }

  canFire() {
    return this.fireCooldown <= 0;
  }

  triggerFire() {
    this.fireCooldown = this.fireRate;
  }

  makeInvulnerable(seconds) {
    this.invulnerableTimer = seconds;
  }

  canDeployOil() {
    return this.oilCharges > 0 && this.gadgetTimer <= 0;
  }

  useOilCharge() {
    if (this.oilCharges <= 0) {
      return false;
    }
    this.oilCharges -= 1;
    this.gadgetTimer = this.gadgetCooldown;
    return true;
  }

  isInvulnerable() {
    return this.invulnerableTimer > 0;
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate((this.facing * Math.PI) / 8);
    ctx.fillStyle = this.isInvulnerable() && Math.floor(this.invulnerableTimer * 10) % 2 === 0 ? "#dddddd" : "#f5f5f5";
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.fillStyle = "#2c2cf0";
    ctx.fillRect(-this.width / 4, -this.height / 2 + 6, this.width / 2, this.height - 12);
    ctx.fillStyle = "#f7072a";
    ctx.fillRect(-this.width / 2 + 4, -this.height / 2 + 8, this.width - 8, 8);
    ctx.restore();
  }
}

class Projectile {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 4;
    this.height = 16;
    this.speed = 520;
    this.active = true;
  }

  update(dt) {
    this.y -= this.speed * dt;
    if (this.y + this.height < 0) {
      this.active = false;
    }
  }

  draw(ctx) {
    ctx.fillStyle = "#ffeb3b";
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }
}

class OilSlick {
  constructor(x, y) {
    this.width = 48;
    this.height = 28;
    this.x = x - this.width / 2;
    this.y = y;
    this.speed = 140;
    this.life = 0;
    this.duration = 4.5;
    this.active = true;
    this.hits = 0;
    this.maxHits = 2;
  }

  update(dt) {
    this.life += dt;
    this.y += this.speed * dt;
    if (this.life >= this.duration || this.y > CANVAS_HEIGHT + this.height) {
      this.active = false;
    }
  }

  registerHit() {
    this.hits += 1;
    if (this.hits >= this.maxHits) {
      this.active = false;
    }
  }

  draw(ctx) {
    const gradient = ctx.createRadialGradient(
      this.x + this.width / 2,
      this.y + this.height / 2,
      0,
      this.x + this.width / 2,
      this.y + this.height / 2,
      this.width / 2
    );
    gradient.addColorStop(0, "rgba(0,0,0,0.9)");
    gradient.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y + this.height / 3,
      width: this.width,
      height: this.height / 2,
    };
  }
}

class EnemyCar {
  constructor({ laneIndex, speed, behavior }) {
    this.width = 40;
    this.height = 66;
    this.x = LANES[laneIndex];
    this.y = -this.height;
    this.speed = speed;
    this.behavior = behavior;
    this.spawnTime = 0;
    this.active = true;
    this.health = 1;
    this.pointValue = 150;
  }

  update(dt, elapsed, player) {
    this.spawnTime += dt;
    this.y += this.speed * dt;

    if (this.behavior === "swerve") {
      const sway = Math.sin((this.spawnTime + elapsed) * 3);
      this.x += sway * 24 * dt;
    } else if (this.behavior === "hunter") {
      const centerSelf = this.x + this.width / 2;
      const centerPlayer = player.x + player.width / 2;
      const dir = Math.sign(centerPlayer - centerSelf);
      this.x += dir * 90 * dt;
    }

    const minX = ROAD_MARGIN + 12;
    const maxX = CANVAS_WIDTH - ROAD_MARGIN - this.width - 12;
    this.x = clamp(this.x, minX, maxX);

    if (this.y > CANVAS_HEIGHT + this.height) {
      this.active = false;
    }
  }

  takeHit() {
    this.health -= 1;
    if (this.health <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }

  draw(ctx) {
    ctx.fillStyle = "#ff4136";
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.fillStyle = "#4d0000";
    ctx.fillRect(this.x + 6, this.y + 10, this.width - 12, this.height - 20);
    ctx.fillStyle = "#111";
    ctx.fillRect(this.x + 10, this.y + 4, this.width - 20, 8);
  }
}

class Explosion {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.life = 0;
    this.duration = 0.45;
    this.active = true;
  }

  update(dt) {
    this.life += dt;
    if (this.life >= this.duration) {
      this.active = false;
    }
  }

  draw(ctx) {
    const t = this.life / this.duration;
    const radius = 12 + t * 24;
    const alpha = 1 - t;
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.6, `rgba(255,128,0,${alpha * 0.6})`);
    gradient.addColorStop(1, `rgba(255,0,0,0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Road {
  constructor() {
    this.scroll = 0;
    this.baseSpeed = 160;
    this.lineSpacing = 64;
  }

  update(dt, playerSpeedY) {
    const effectiveSpeed = this.baseSpeed + playerSpeedY * 0.4;
    this.scroll = (this.scroll + effectiveSpeed * dt) % this.lineSpacing;
  }

  draw(ctx) {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "#2c2c2c";
    ctx.fillRect(ROAD_MARGIN, 0, ROAD_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = "#f8f094";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ROAD_MARGIN + 6, 0);
    ctx.lineTo(ROAD_MARGIN + 6, CANVAS_HEIGHT);
    ctx.moveTo(CANVAS_WIDTH - ROAD_MARGIN - 6, 0);
    ctx.lineTo(CANVAS_WIDTH - ROAD_MARGIN - 6, CANVAS_HEIGHT);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.setLineDash([28, 24]);
    ctx.lineDashOffset = -this.scroll;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

class Game {
  constructor() {
    this.road = new Road();
    this.player = new PlayerCar();
    this.projectiles = [];
    this.enemies = [];
    this.explosions = [];
    this.hazards = [];
    this.state = GameState.ATTRACT;
    this.lastTime = performance.now();
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1.8;
    this.score = 0;
    this.lives = 3;
    this.highScore = loadHighScore();

    requestAnimationFrame((timestamp) => this.loop(timestamp));
    this.updateHud();
    setOverlay({
      title: "Spy Hunter",
      message: `Welcome, Agent. High Score ${this.highScore.toString().padStart(6, "0")}.`,
      footer: "Press Enter or click to begin",
      buttonText: "Start Mission",
      visible: true,
    });
  }

  loop(timestamp) {
    const delta = clamp((timestamp - this.lastTime) / 1000, 0, MAX_DELTA);
    this.lastTime = timestamp;

    if (this.state === GameState.RUNNING) {
      this.update(delta);
    } else if (this.state === GameState.ATTRACT) {
      this.road.update(delta, -60);
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  startGame() {
    this.reset();
    this.state = GameState.RUNNING;
    overlayEl.hidden = true;
  }

  reset() {
    this.projectiles.length = 0;
    this.enemies.length = 0;
    this.explosions.length = 0;
    this.hazards.length = 0;
    this.player.resetPosition();
    this.player.resetLoadout();
    this.player.makeInvulnerable(1.5);
    this.road.scroll = 0;
    this.elapsed = 0;
    this.spawnTimer = 0.5;
    this.spawnInterval = 1.8;
    this.score = 0;
    this.lives = 3;
    this.weapon = "Cannon";
    this.updateHud();
  }

  togglePause() {
    if (this.state === GameState.RUNNING) {
      this.state = GameState.PAUSED;
    } else if (this.state === GameState.PAUSED) {
      this.state = GameState.RUNNING;
    }
  }

  update(dt) {
    this.elapsed += dt;
    this.player.update(dt);
    this.road.update(dt, this.player.speedY);

    if (input.consumePress("KeyJ") || input.consumePress("Space")) {
      this.tryFireProjectile();
    }
    if (input.consumePress("KeyK")) {
      this.tryDeployOil();
    }

    this.projectiles.forEach((projectile) => projectile.update(dt));
    this.enemies.forEach((enemy) => enemy.update(dt, this.elapsed, this.player));
    this.explosions.forEach((explosion) => explosion.update(dt));
    this.hazards.forEach((hazard) => hazard.update(dt));

    this.performSpawning(dt);
    this.handleCollisions();
    this.cleanupEntities();
    this.updateScore(dt);

    this.updateHud();
    input.endFrame();
  }

  render() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.road.draw(ctx);

    this.projectiles.forEach((projectile) => projectile.draw(ctx));
    this.enemies.forEach((enemy) => enemy.draw(ctx));
    this.hazards.forEach((hazard) => hazard.draw(ctx));
    this.explosions.forEach((explosion) => explosion.draw(ctx));
    this.player.draw(ctx);

    if (this.state === GameState.ATTRACT) {
      drawAttractOverlay(ctx);
    } else if (this.state === GameState.PAUSED) {
      drawPauseOverlay(ctx);
    } else if (this.state === GameState.GAME_OVER) {
      drawGameOverOverlay(ctx);
    }
  }

  tryFireProjectile() {
    if (!this.player.canFire()) {
      return;
    }
    this.player.triggerFire();
    const projectile = new Projectile(
      this.player.x + this.player.width / 2 - 2,
      this.player.y - 12
    );
    this.projectiles.push(projectile);
  }

  tryDeployOil() {
    if (!this.player.canDeployOil()) {
      return;
    }
    this.player.useOilCharge();
    const slick = new OilSlick(
      this.player.x + this.player.width / 2,
      this.player.y + this.player.height - 12
    );
    this.hazards.push(slick);
  }

  performSpawning(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) {
      return;
    }

    const enemyCount = this.enemies.filter((enemy) => enemy.active).length;
    if (enemyCount < 5) {
      const laneIndex = chooseLane(this.enemies);
      const difficulty = 1 + Math.min(2.5, this.elapsed / 45);
      const speed = 160 + difficulty * 35 + Math.random() * 20;
      const behaviors = ["standard", "swerve", "hunter"];
      const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
      const enemy = new EnemyCar({ laneIndex, speed, behavior });
      this.enemies.push(enemy);
    }

    this.spawnInterval = clamp(1.6 - this.elapsed / 60, 0.8, 1.6);
    this.spawnTimer = this.spawnInterval + Math.random() * 0.7;
  }

  handleCollisions() {
    const playerBounds = this.player.getBounds();

    this.enemies.forEach((enemy) => {
      if (!enemy.active) {
        return;
      }

      // Projectile collisions
      this.projectiles.forEach((projectile) => {
        if (!projectile.active) return;
        if (rectsIntersect(projectile.getBounds(), enemy.getBounds())) {
          projectile.active = false;
          const destroyed = enemy.takeHit();
          if (destroyed) {
            this.score += enemy.pointValue;
            this.explosions.push(
              new Explosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2)
            );
          }
        }
      });

      // Player collision
      if (!enemy.active) {
        return;
      }
      if (!this.player.isInvulnerable() && rectsIntersect(playerBounds, enemy.getBounds())) {
        enemy.active = false;
        this.explosions.push(
          new Explosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2)
        );
        this.handlePlayerCrash();
      }
    });

    this.hazards.forEach((hazard) => {
      if (!hazard.active) return;
      this.enemies.forEach((enemy) => {
        if (!enemy.active) return;
        if (rectsIntersect(hazard.getBounds(), enemy.getBounds())) {
          hazard.registerHit();
          enemy.active = false;
          this.score += 100;
          this.explosions.push(
            new Explosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2)
          );
        }
      });
    });
  }

  handlePlayerCrash() {
    this.lives -= 1;
    if (this.lives < 0) {
      this.triggerGameOver();
      return;
    }

    this.player.resetPosition();
    this.player.makeInvulnerable(2.5);
    this.enemies.forEach((enemy) => {
      if (enemy.y > CANVAS_HEIGHT * 0.6) {
        enemy.active = false;
      }
    });
  }

  updateScore(dt) {
    this.score += Math.floor(dt * 25);
  }

  cleanupEntities() {
    this.projectiles = this.projectiles.filter((projectile) => projectile.active);
    this.enemies = this.enemies.filter((enemy) => enemy.active);
    this.explosions = this.explosions.filter((explosion) => explosion.active);
    this.hazards = this.hazards.filter((hazard) => hazard.active);
  }

  triggerGameOver() {
    this.state = GameState.GAME_OVER;
    let footer = "Press Enter or click to retry";
    let message = `Final Score ${this.score.toString().padStart(6, "0")} · High Score ${this.highScore
      .toString()
      .padStart(6, "0")}`;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.highScore);
      footer = "New high score! Engage again to push it higher.";
      message = `Final Score ${this.score.toString().padStart(6, "0")} · High Score ${this.highScore
        .toString()
        .padStart(6, "0")}`;
    }
    setOverlay({
      title: "Mission Failed",
      message,
      footer,
      buttonText: "Restart Mission",
      visible: true,
    });
  }

  updateHud() {
    scoreEl.textContent = this.score.toString().padStart(6, "0");
    highScoreEl.textContent = this.highScore.toString().padStart(6, "0");
    livesEl.textContent = Math.max(0, this.lives).toString();
    const oilStatus = this.player.oilCharges > 0 ? `Oil x${this.player.oilCharges}` : "Oil Empty";
    weaponEl.textContent = `Cannon | ${oilStatus}`;
  }
}

const game = new Game();

startButton.addEventListener("click", () => {
  if (game.state === GameState.RUNNING) {
    return;
  }
  game.startGame();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyP") {
    if (game.state === GameState.RUNNING || game.state === GameState.PAUSED) {
      game.togglePause();
    }
  } else if (event.code === "Enter") {
    if (game.state === GameState.ATTRACT || game.state === GameState.GAME_OVER) {
      game.startGame();
    }
  } else if (event.code === "Escape" && game.state === GameState.PAUSED) {
    game.togglePause();
  }
});

function setOverlay({ title, message, footer, buttonText, visible }) {
  overlayTitleEl.textContent = title;
  overlayMessageEl.textContent = message;
  overlayFooterEl.textContent = footer || "";
  startButton.textContent = buttonText;
  overlayEl.hidden = !visible;
}

function drawAttractOverlay(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#4af5ff";
  ctx.font = "28px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PRESS START TO BEGIN", CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.55);
  ctx.restore();
}

function drawPauseOverlay(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = "26px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.restore();
}

function drawGameOverOverlay(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#ff5252";
  ctx.font = "30px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MISSION FAILED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.restore();
}

function rectsIntersect(a, b) {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

function chooseLane(existingEnemies) {
  const occupied = existingEnemies
    .filter((enemy) => enemy.active && enemy.y < CANVAS_HEIGHT * 0.35)
    .map((enemy) => {
      const center = enemy.x + enemy.width / 2;
      const laneDistances = LANES.map((lane) => Math.abs(center - (lane + enemy.width / 2)));
      return laneDistances.indexOf(Math.min(...laneDistances));
    });

  const available = LANES.map((_, index) => index).filter((index) => !occupied.includes(index));
  if (available.length === 0) {
    return Math.floor(Math.random() * LANES.length);
  }
  return available[Math.floor(Math.random() * available.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function approach(value, target, amount) {
  if (value < target) {
    return Math.min(value + amount, target);
  }
  if (value > target) {
    return Math.max(value - amount, target);
  }
  return value;
}

function loadHighScore() {
  try {
    const stored = localStorage.getItem("spyhunter_highscore");
    return stored ? parseInt(stored, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem("spyhunter_highscore", value.toString());
  } catch {
    // ignore storage failures
  }
}
