import * as THREE from 'three';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite, rand } from '../engine/helpers.js';

const GOOD_MSGS = [
  'hey bot! 👋', '!help commands', 'anyone online?', 'gg team!',
  'is the event today?', 'nice server 🔥', '!rank @saksham',
  'how do I join?', 'ship it!!', '+1 rep', 'need mod review',
];
const SPAM_MSGS = [
  '⚠ FREE NITRO!!', '⚠ CLICK HERE NOW', '⚠ CLAIM PRIZE $', '⚠ SCAM LINK.XYZ',
];

export default {
  create(ctx) {
    const { scene, fx, audio, input, pick, gsap } = ctx;
    const v = ctx.view();
    const safeW = Math.min(12.5, v.w * 0.82);
    const safeH = Math.min(6.4, v.h * 0.68);
    const GOAL = 6;
    let score = 0;
    let ended = false;

    // Progress pips at top
    const pips = [];
    const pipY = safeH * 0.5 + 0.55;
    for (let i = 0; i < GOAL; i++) {
      const g = new THREE.Group();
      const x = (i - (GOAL - 1) / 2) * 0.72;
      const geo = new THREE.OctahedronGeometry(0.18, 0);
      const mesh = new THREE.Mesh(geo, bodyMat('#101936', 0.9));
      const edge = edgeLines(geo, ctx.accent, 1.5);
      const halo = glowSprite(ctx.accent, 0.9, 0);
      g.add(mesh, edge, halo);
      g.position.set(x, pipY, 0);
      g.userData = { mesh, halo, lit: false };
      scene.add(g);
      pips.push(g);
    }

    function lightPip(idx) {
      const p = pips[idx];
      if (!p || p.userData.lit) return;
      p.userData.lit = true;
      p.userData.mesh.material = glowMat(ctx.accent, 2.2);
      gsap.to(p.userData.halo.material, { opacity: 0.85, duration: 0.25 });
      gsap.fromTo(p.scale, { x: 1.8, y: 1.8, z: 1.8 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(2.5)' });
    }

    const bubbles = [];
    let spawnTimer = 0.08;

    function removeBubble(b) {
      const idx = bubbles.indexOf(b);
      if (idx >= 0) bubbles.splice(idx, 1);
      gsap.killTweensOf(b.group.scale);
      gsap.killTweensOf(b.group.position);
      b.label?.dispose?.();
      scene.remove(b.group);
    }

    function spawnBubble(forceGood = false) {
      if (ended || bubbles.length >= 5) return;
      const spam = !forceGood && Math.random() < 0.25;
      const text = spam
        ? SPAM_MSGS[Math.floor(Math.random() * SPAM_MSGS.length)]
        : GOOD_MSGS[Math.floor(Math.random() * GOOD_MSGS.length)];
      const color = spam ? '#ff3860' : '#3dffb5';

      const group = new THREE.Group();
      const bw = 2.8, bh = 0.82;
      const geo = new THREE.BoxGeometry(bw, bh, 0.16);
      const body = new THREE.Mesh(geo, bodyMat(spam ? '#2a0915' : '#0b1e2d', 0.9));
      const edges = edgeLines(geo, color, spam ? 2.0 : 1.7);
      const halo = glowSprite(color, 3.2, 0.32);
      const label = textSprite(text, {
        worldH: 0.44, width: 640, height: 110,
        font: '700 44px "JetBrains Mono", monospace',
        color: spam ? '#ff9bb0' : '#eafff6',
      });
      label.sprite.position.z = 0.12;

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(bw * 1.15, bh * 1.3, 0.5),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      group.add(body, edges, halo, label.sprite, hit);

      // Avoid overlapping existing bubbles
      let x = 0, y = 0;
      for (let tries = 0; tries < 10; tries++) {
        x = rand(-safeW * 0.42, safeW * 0.42);
        y = rand(-safeH * 0.38, safeH * 0.32);
        if (bubbles.every((o) => Math.hypot(o.group.position.x - x, o.group.position.y - y) > 2.2)) break;
      }
      group.position.set(x, y, rand(-0.2, 0.2));
      group.scale.setScalar(0.01);
      scene.add(group);

      const b = {
        group, hit, label, spam, color,
        age: 0, maxAge: spam ? 2.1 : 2.6,
        seed: Math.random() * 10,
        closing: false,
      };
      hit.userData.bubble = b;
      bubbles.push(b);

      gsap.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'back.out(2.2)' });
    }

    // Spawn initial wave
    spawnBubble(true);
    spawnBubble(true);

    return {
      update(dt, t) {
        if (ended) return;
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnBubble(bubbles.filter((b) => !b.spam).length === 0);
          spawnTimer = 0.42;
        }

        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          b.age += dt;
          b.group.position.y += dt * 0.22;
          b.group.rotation.z = Math.sin(t * 3.5 + b.seed) * 0.05;
          if (!b.closing && b.age >= b.maxAge) {
            b.closing = true;
            gsap.to(b.group.scale, {
              x: 0.01, y: 0.01, z: 0.01, duration: 0.22,
              onComplete: () => removeBubble(b),
            });
          }
        }

        if (input.pressed) {
          const hit = pick(bubbles.map((b) => b.hit));
          if (hit && hit.object.userData.bubble) {
            const b = hit.object.userData.bubble;
            if (b.closing) return;
            b.closing = true;
            const pos = b.group.position.clone();
            if (b.spam) {
              audio.sfx.error();
              fx.shake(0.32, 0.3);
              fx.burst(pos, '#ff3860', 32, 5, 0.18, 0.65);
              fx.pop(pos, 'SPAM! -1.2s', '#ff5470');
              ctx.penalty(1.2);
              removeBubble(b);
            } else {
              audio.sfx.coin();
              fx.ring(pos, '#3dffb5', 2.0, 0.5);
              fx.burst(pos, '#3dffb5', 36, 5.5, 0.18, 0.75);
              fx.pop(pos, 'REPLIED ✓', '#3dffb5');
              removeBubble(b);
              lightPip(score);
              score++;
              if (score >= GOAL) {
                ended = true;
                ctx.win();
              }
            }
          }
        }
      },
      dispose() {
        [...bubbles].forEach(removeBubble);
      },
    };
  },
};
