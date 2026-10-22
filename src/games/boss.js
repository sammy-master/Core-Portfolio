import * as THREE from 'three';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite, rand } from '../engine/helpers.js';

const HZ_LABELS = ['DEADLINE', 'MERGE CONFLICT', '3AM BUG', 'DEMO IN 5M', 'SCOPE CREEP'];

export default {
  timeoutWins: true,
  create(ctx) {
    const { scene, fx, audio, input, planePoint, gsap } = ctx;
    const v = ctx.view();
    const halfW = Math.min(6.8, v.w * 0.45);
    const halfH = Math.min(3.8, v.h * 0.42);
    let ended = false;
    let lives = 3;
    let invuln = 0;

    // Arena boundary frame
    const arenaGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(halfW * 2, halfH * 2, 0.1));
    const arena = new THREE.LineSegments(
      arenaGeo,
      new THREE.LineBasicMaterial({ color: new THREE.Color(ctx.accent).multiplyScalar(1.4), transparent: true, opacity: 0.45, toneMapped: false }),
    );
    scene.add(arena);

    // Lives HUD pips at top
    const lifePips = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const geo = new THREE.OctahedronGeometry(0.22, 0);
      const m = new THREE.Mesh(geo, glowMat('#3dffb5', 2.0));
      const halo = glowSprite('#3dffb5', 1.1, 0.7);
      g.add(m, halo);
      g.position.set((i - 1) * 0.75, halfH + 0.55, 0);
      scene.add(g);
      lifePips.push(g);
    }

    // Player ship
    const ship = new THREE.Group();
    const shipGeo = new THREE.ConeGeometry(0.38, 0.95, 4);
    const shipMesh = new THREE.Mesh(shipGeo, bodyMat('#0b1f38', 0.95));
    const shipEdge = edgeLines(shipGeo, '#22e4ff', 2.2);
    const shipHalo = glowSprite('#22e4ff', 2.2, 0.75);
    const shield = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.62, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#22e4ff').multiplyScalar(1.8), side: THREE.DoubleSide, transparent: true, opacity: 0.45, toneMapped: false }),
    );
    ship.add(shipMesh, shipEdge, shipHalo, shield);
    ship.position.set(0, -halfH * 0.55, 0);
    scene.add(ship);

    const hazards = [];
    const stars = [];
    let hzTimer = 0.25;
    let starTimer = 1.1;

    function spawnHazard(t) {
      const g = new THREE.Group();
      const w = rand(1.4, 2.2), h = 0.48;
      const geo = new THREE.BoxGeometry(w, h, 0.22);
      const body = new THREE.Mesh(geo, bodyMat('#2b0812', 0.92));
      const edge = edgeLines(geo, '#ff3860', 2.2);
      const halo = glowSprite('#ff3860', 2.5, 0.45);
      const txt = HZ_LABELS[Math.floor(Math.random() * HZ_LABELS.length)];
      const lbl = textSprite(txt, { worldH: 0.28, width: 420, height: 72, font: '700 34px "JetBrains Mono"', color: '#ffb8c6' });
      lbl.sprite.position.z = 0.14;
      g.add(body, edge, halo, lbl.sprite);

      const x = rand(-halfW + w * 0.5, halfW - w * 0.5);
      g.position.set(x, halfH + 0.6, 0);
      scene.add(g);
      hazards.push({
        g, lbl, w, h,
        vx: rand(-1.2, 1.2),
        vy: -rand(3.4, 5.1) * (1 + Math.min(t, 10) * 0.03),
      });
    }

    function spawnStar() {
      const g = new THREE.Group();
      const geo = new THREE.OctahedronGeometry(0.28, 0);
      const m = new THREE.Mesh(geo, glowMat('#ffc23d', 2.4));
      const halo = glowSprite('#ffc23d', 1.6, 0.8);
      g.add(m, halo);
      g.position.set(rand(-halfW * 0.8, halfW * 0.8), halfH + 0.5, 0);
      scene.add(g);
      stars.push({ g, vy: -2.8 });
    }

    return {
      update(dt, t) {
        if (ended) return;
        ctx.setProgress?.(`SHIELDS: ${'◆'.repeat(lives)}${'◇'.repeat(3 - lives)} · SURVIVE ${Math.ceil(ctx.timeLeft())}s`);

        // Player movement: pointer + keyboard override
        const pt = planePoint(0);
        let tx = pt.x, ty = pt.y;
        const kd = input.keysDown;
        const keySpeed = 7.5;
        if (kd.has('ArrowLeft') || kd.has('KeyA')) tx = ship.position.x - keySpeed * dt * 4;
        if (kd.has('ArrowRight') || kd.has('KeyD')) tx = ship.position.x + keySpeed * dt * 4;
        if (kd.has('ArrowUp') || kd.has('KeyW')) ty = ship.position.y + keySpeed * dt * 4;
        if (kd.has('ArrowDown') || kd.has('KeyS')) ty = ship.position.y - keySpeed * dt * 4;

        tx = THREE.MathUtils.clamp(tx, -halfW + 0.5, halfW - 0.5);
        ty = THREE.MathUtils.clamp(ty, -halfH + 0.5, halfH - 0.5);
        const vx = tx - ship.position.x;
        ship.position.x += vx * Math.min(1, dt * 12);
        ship.position.y += (ty - ship.position.y) * Math.min(1, dt * 12);
        ship.rotation.z = THREE.MathUtils.clamp(-vx * 0.25, -0.45, 0.45);
        shipMesh.rotation.y += dt * 2.4;

        // Engine trail
        if (Math.random() < 0.65) {
          fx.burst(new THREE.Vector3(ship.position.x, ship.position.y - 0.48, 0), '#22e4ff', 1, 1.2, 0.11, 0.28);
        }

        if (invuln > 0) {
          invuln -= dt;
          ship.visible = Math.floor(invuln * 20) % 2 === 0;
        } else {
          ship.visible = true;
        }

        // Spawners
        hzTimer -= dt;
        if (hzTimer <= 0) {
          spawnHazard(10 - ctx.timeLeft());
          hzTimer = Math.max(0.34, 0.58 - (10 - ctx.timeLeft()) * 0.02);
        }
        starTimer -= dt;
        if (starTimer <= 0) {
          spawnStar();
          starTimer = 2.0;
        }

        // Update hazards
        for (let i = hazards.length - 1; i >= 0; i--) {
          const h = hazards[i];
          h.g.position.x += h.vx * dt;
          h.g.position.y += h.vy * dt;
          if (h.g.position.x < -halfW + h.w * 0.5 || h.g.position.x > halfW - h.w * 0.5) h.vx *= -1;

          // Forgiving hitbox
          if (
            invuln <= 0 &&
            Math.abs(ship.position.x - h.g.position.x) < h.w * 0.42 &&
            Math.abs(ship.position.y - h.g.position.y) < h.h * 0.65
          ) {
            lives--;
            invuln = 1.1;
            audio.sfx.hit();
            fx.shake(0.42, 0.35);
            fx.flash('#ff2d55', 0.35);
            fx.burst(ship.position.clone(), '#ff3860', 45, 6, 0.2, 0.7);
            const pip = lifePips[lives];
            if (pip) gsap.to(pip.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.25 });
            h.lbl.dispose();
            scene.remove(h.g);
            hazards.splice(i, 1);
            if (lives <= 0) {
              ended = true;
              ctx.lose();
              return;
            }
            continue;
          }

          if (h.g.position.y < -halfH - 1.0) {
            h.lbl.dispose();
            scene.remove(h.g);
            hazards.splice(i, 1);
          }
        }

        // Update idea stars
        for (let i = stars.length - 1; i >= 0; i--) {
          const s = stars[i];
          s.g.position.y += s.vy * dt;
          s.g.rotation.y += dt * 3;
          s.g.rotation.x += dt * 2;
          if (ship.position.distanceTo(s.g.position) < 0.75) {
            audio.sfx.coin();
            fx.ring(s.g.position.clone(), '#ffc23d', 1.8, 0.45);
            fx.burst(s.g.position.clone(), '#ffc23d', 28, 5, 0.16, 0.65);
            fx.pop(s.g.position.clone(), '+IDEA SPARK!', '#ffc23d');
            scene.remove(s.g);
            stars.splice(i, 1);
            continue;
          }
          if (s.g.position.y < -halfH - 1.0) {
            scene.remove(s.g);
            stars.splice(i, 1);
          }
        }
      },
      dispose() {
        hazards.forEach((h) => h.lbl.dispose());
      },
    };
  },
};
