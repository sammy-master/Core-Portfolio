import * as THREE from 'three';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite, shuffle } from '../engine/helpers.js';

/**
 * REFERENCE GAME. Every mini-game default-exports this shape:
 *   { create(ctx) -> { update(dt, t), dispose?() } }
 * Mission metadata (verb, hint, time, colour) comes from data/content.js.
 */
export default {
  create(ctx) {
    const { scene, fx, audio, input, pick, gsap } = ctx;
    const N = 6;
    const bars = [];
    let order = shuffle([...Array(N).keys()]);
    while (order.every((v, i) => v === i)) order = shuffle(order);

    const v = ctx.view();
    const spacing = Math.min(1.8, (v.w * 0.82) / N);
    const maxH = Math.min(5.2, v.h * 0.55);
    const slotX = (i) => (i - (N - 1) / 2) * spacing;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(spacing * N + 2, 0.06), glowMat(ctx.accent, 1.4, 0.6));
    floor.position.set(0, -maxH / 2 - 0.1, 0);
    scene.add(floor);

    order.forEach((val, slot) => {
      const h = 0.9 + (val / (N - 1)) * (maxH - 0.9);
      const g = new THREE.Group();
      const geo = new THREE.BoxGeometry(spacing * 0.62, h, 0.6);
      const body = new THREE.Mesh(geo, bodyMat('#0a1530', 0.9));
      const edges = edgeLines(geo, ctx.accent, 1.8);
      const top = new THREE.Mesh(new THREE.BoxGeometry(spacing * 0.62, 0.07, 0.62), glowMat(ctx.accent, 2.2));
      top.position.y = h / 2;
      const halo = glowSprite(ctx.accent, spacing * 1.6, 0.0);
      halo.position.y = h / 2;
      const label = textSprite(String(val + 1), { worldH: 0.5, width: 256, height: 128, font: '700 72px "JetBrains Mono"', color: '#ffffff' });
      label.sprite.position.set(0, h / 2 + 0.55, 0);
      g.add(body, edges, top, halo, label.sprite);
      g.position.set(slotX(slot), -maxH / 2 - 0.1 + h / 2, 0);
      g.userData = { val, slot, h, body, halo, hit: body };
      body.userData.bar = g;
      scene.add(g);
      bars.push(g);
    });

    let sel = null;
    let busy = false;
    const setSel = (b, on) => {
      gsap.to(b.userData.halo.material, { opacity: on ? 0.9 : 0, duration: 0.2 });
      gsap.to(b.scale, { x: on ? 1.08 : 1, z: on ? 1.08 : 1, duration: 0.2 });
    };
    const isSorted = () => bars.every((b) => b.userData.slot === b.userData.val);
    const updateProg = () => {
      const ok = bars.filter((b) => b.userData.slot === b.userData.val).length;
      ctx.setProgress?.(`${ok} / ${N} IN PLACE`);
    };
    updateProg();

    function swap(a, b) {
      busy = true;
      audio.sfx.swap();
      const sa = a.userData.slot, sb = b.userData.slot;
      a.userData.slot = sb; b.userData.slot = sa;
      const fromA = a.position.x, fromB = b.position.x;
      const o = { t: 0 };
      gsap.to(o, {
        t: 1, duration: 0.45, ease: 'power2.inOut',
        onUpdate: () => {
          a.position.x = THREE.MathUtils.lerp(fromA, fromB, o.t);
          b.position.x = THREE.MathUtils.lerp(fromB, fromA, o.t);
          a.position.z = Math.sin(o.t * Math.PI) * 1.4;
          b.position.z = -Math.sin(o.t * Math.PI) * 1.4;
        },
        onComplete: () => {
          a.position.z = b.position.z = 0;
          setSel(a, false); setSel(b, false);
          busy = false;
          updateProg();
          fx.ring(new THREE.Vector3(a.position.x, a.position.y, 0), ctx.accent, 1.6, 0.5);
          if (isSorted()) {
            bars.forEach((bar, i) => {
              gsap.to(bar.position, { y: bar.position.y + 0.5, duration: 0.25, delay: i * 0.06, yoyo: true, repeat: 1, ease: 'power2.out' });
              fx.burst(new THREE.Vector3(bar.position.x, bar.position.y + bar.userData.h / 2, 0), ctx.accent, 18, 3.2, 0.16, 0.9, 1.5);
            });
            ctx.win();
          }
        },
      });
    }

    return {
      update(dt, t) {
        bars.forEach((b, i) => { b.children[3].position.y = b.userData.h / 2 + Math.sin(t * 2 + i) * 0.03; });
        if (!input.pressed || busy) return;
        const hit = pick(bars.map((b) => b.userData.body));
        if (!hit) return;
        const bar = hit.object.userData.bar;
        audio.sfx.pick();
        if (!sel) { sel = bar; setSel(bar, true); }
        else if (sel === bar) { setSel(bar, false); sel = null; }
        else { const a = sel; sel = null; setSel(bar, true); swap(a, bar); }
      },
    };
  },
};
