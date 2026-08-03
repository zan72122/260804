/**
 * Object-pooled sparks and water mist.
 * Particles live in grinder-local side coordinates:
 *   dx = metres BEHIND the grinding stone (opposite of travel)
 *   dy = metres above the rail head
 * Each view (side / perspective) maps these to screen itself, so rotating the
 * device never resets or duplicates particles.
 */
export interface Particle {
  active: boolean;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  /** 0..1 — 1 is white-hot, cools toward deep orange. */
  heat: number;
  /** lateral offset from track centre, metres (used by the perspective view). */
  lat: number;
}

const GRAVITY = 9.0;
/** Spark deflector plate behind the stone: sparks are kept low and behind. */
const PLATE_DX0 = 0.25;
const PLATE_DX1 = 1.4;
const PLATE_DY = 0.55;

export class ParticlePool {
  readonly capacity: number;
  readonly pool: Particle[];
  private cursor = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.pool = Array.from({ length: capacity }, () => ({
      active: false,
      dx: 0,
      dy: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      heat: 1,
      lat: 0,
    }));
  }

  spawn(init: (p: Particle) => void): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    p.active = true;
    init(p);
  }

  count(): number {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }

  forEach(fn: (p: Particle) => void): void {
    for (const p of this.pool) if (p.active) fn(p);
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
  }
}

export class SparkSystem {
  readonly sparks = new ParticlePool(600);
  readonly mist = new ParticlePool(220);
  private emitCarry = 0;
  private mistCarry = 0;

  /**
   * @param intensity 0..1 combined (contact × speed × local roughness)
   * @param carSpeed  m/s, stretches sparks backwards
   * @param mistLevel 0..1 water mist strength (auto + tap boost)
   */
  update(dt: number, intensity: number, carSpeed: number, mistLevel: number, rnd: () => number): void {
    // --- emission ---
    if (intensity > 0.02) {
      this.emitCarry += dt * (40 + intensity * 260);
      while (this.emitCarry >= 1) {
        this.emitCarry -= 1;
        this.sparks.spawn((p) => {
          p.dx = 0.05 + rnd() * 0.1;
          p.dy = 0.06 + rnd() * 0.08;
          // stream opposite to travel; faster car → longer, flatter stream
          p.vx = (1.2 + rnd() * 1.6) * (0.5 + carSpeed * 0.55);
          p.vy = 0.4 + rnd() * 1.6 + intensity * 1.2;
          p.maxLife = 0.25 + rnd() * 0.45;
          p.life = p.maxLife;
          p.size = 0.6 + rnd() * 0.9;
          p.heat = 0.75 + rnd() * 0.25;
          p.lat = (rnd() < 0.5 ? -0.75 : 0.75) + (rnd() - 0.5) * 0.3;
        });
      }
    } else {
      this.emitCarry = 0;
    }
    if (mistLevel > 0.02) {
      this.mistCarry += dt * (14 + mistLevel * 60);
      while (this.mistCarry >= 1) {
        this.mistCarry -= 1;
        this.mist.spawn((p) => {
          p.dx = 0.35 + rnd() * 0.9;
          p.dy = 0.5 + rnd() * 0.35;
          p.vx = 0.3 + rnd() * 0.5;
          p.vy = -0.25 - rnd() * 0.5;
          p.maxLife = 0.5 + rnd() * 0.7;
          p.life = p.maxLife;
          p.size = 1 + rnd() * 1.6;
          p.heat = 0;
          p.lat = (rnd() - 0.5) * 1.8;
        });
      }
    }

    // --- simulation ---
    this.sparks.forEach((p) => {
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        return;
      }
      p.dx += p.vx * dt;
      p.dy += p.vy * dt;
      p.vy -= GRAVITY * dt;
      // deflector plate keeps the shower low and behind the stone
      if (p.dx > PLATE_DX0 && p.dx < PLATE_DX1 && p.dy > PLATE_DY && p.vy > 0) {
        p.dy = PLATE_DY;
        p.vy = -Math.abs(p.vy) * 0.35;
      }
      // ground bounce with damping
      if (p.dy < 0 && p.vy < 0) {
        p.dy = 0;
        p.vy = -p.vy * 0.3;
        p.vx *= 0.7;
        p.life *= 0.7;
      }
      p.heat = Math.max(0, p.heat - dt * 1.4);
    });
    this.mist.forEach((p) => {
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        return;
      }
      p.dx += p.vx * dt;
      p.dy += p.vy * dt;
      p.vy -= 0.4 * dt; // gentle fall, not ballistic
      if (p.dy < 0.02) p.dy = 0.02;
    });
  }

  clear(): void {
    this.sparks.clear();
    this.mist.clear();
    this.emitCarry = 0;
    this.mistCarry = 0;
  }
}
