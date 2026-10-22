import * as THREE from 'three';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite, rand } from '../engine/helpers.js';

/**
 * Bug Hunt: squash all 6 glowing bugs scurrying around a dark code editor.
 */
const GREEN = new THREE.Color('#3dff8a');

const angDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export default {
  create(ctx) {
    const { scene, fx, audio, input, pick, gsap } = ctx;
    const N = 6;
    const v = ctx.view();

    // Play-field extents (clamped to what the viewport can show)
    const hw = Math.max(2, Math.min(6.4, v.w / 2 - 0.9));
    const hh = Math.max(1.6, Math.min(3.7, v.h / 2 - 1.5));
    const bugScale = Math.min(1.15, Math.max(0.7, v.w / 12));

    const tweenTargets = [];
    const track = (o) => { tweenTargets.push(o); return o; };
    const disposables = [];

    // ───────────── Code editor backdrop ─────────────
    const backdrop = new THREE.Group();
    backdrop.position.z = -1;
    scene.add(backdrop);

    const pw = Math.min(v.w * 0.96, hw * 2 + 1.8);
    const ph = Math.min(v.h * 0.94, hh * 2 + 2.6);
    const panelGeo = new THREE.PlaneGeometry(pw, ph);
    const panel = new THREE.Mesh(panelGeo, bodyMat('#060a1a', 0.78));
    const frame = edgeLines(new THREE.BoxGeometry(pw, ph, 0.01), ctx.accent, 0.9, 0.7);
    backdrop.add(panel, frame);

    // title bar + traffic-light dots
    const barH = 0.38;
    const titleBar = new THREE.Mesh(new THREE.PlaneGeometry(pw, barH), glowMat('#16204a', 1.0, 0.7));
    titleBar.position.set(0, ph / 2 - barH / 2, 0.005);
    backdrop.add(titleBar);
    const dotGeo = new THREE.CircleGeometry(0.07, 14);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      const d = new THREE.Mesh(dotGeo, glowMat(c, 1.4));
      d.position.set(-pw / 2 + 0.3 + i * 0.22, ph / 2 - barH / 2, 0.01);
      backdrop.add(d);
    });

    const barGeo = new THREE.PlaneGeometry(1, 0.085);
    const codeMats = [
      glowMat('#5b7cff', 1.0, 0.16),
      glowMat('#9a6bff', 1.0, 0.14),
      glowMat('#22e4ff', 1.0, 0.12),
      glowMat('#8aa0d8', 1.0, 0.10),
      glowMat('#ff4f6e', 1.0, 0.22), // "buggy" red lines
    ];
    const gutterMat = glowMat('#8aa0d8', 1.0, 0.08);
    const lineStep = 0.26;
    const top = ph / 2 - barH - 0.3;
    const lineCount = Math.max(6, Math.floor((ph - barH - 0.5) / lineStep));
    const gx0 = -pw / 2 + 0.7;
    for (let i = 0; i < lineCount; i++) {
      const y = top - i * lineStep;
      const g = new THREE.Mesh(barGeo, gutterMat);
      g.scale.x = 0.22;
      g.position.set(-pw / 2 + 0.38, y, 0.01);
      backdrop.add(g);
      let x = gx0 + Math.floor(rand(0, 4)) * 0.35;
      const segs = 1 + Math.floor(rand(1, 5));
      for (let s = 0; s < segs; s++) {
        const w = rand(0.5, 2.6);
        if (x + w > pw / 2 - 0.4) break;
        const mat = Math.random() < 0.06 ? codeMats[4] : codeMats[Math.floor(rand(0, 4))];
        const b = new THREE.Mesh(barGeo, mat);
        b.scale.x = w;
        b.position.set(x + w / 2, y, 0.01);
        backdrop.add(b);
        x += w + 0.18;
      }
    }
    // scanning highlight line
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.2, 0.05), glowMat(ctx.accent, 1.4, 0.18));
    scan.position.z = 0.02;
    backdrop.add(scan);

    // ───────────── Shared bug resources ─────────────
    const bodyGeo = new THREE.IcosahedronGeometry(0.4, 1);
    const abdGeo = new THREE.IcosahedronGeometry(0.3, 1);
    const headGeo = new THREE.IcosahedronGeometry(0.22, 1);
    const eyeGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const coneGeo = new THREE.ConeGeometry(0.1, 0.3, 5);
    const hitGeo = new THREE.SphereGeometry(0.85, 10, 8);
    const legPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.13, 0.2, 0), new THREE.Vector3(0.06, 0.46, 0)];
    const legGeo = new THREE.BufferGeometry().setFromPoints(legPts);
    const antPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 0.1, 0), new THREE.Vector3(0.36, 0.0, 0)];
    const antGeo = new THREE.BufferGeometry().setFromPoints(antPts);
    const bodyGlass = bodyMat('#150818', 0.9);
    const eyeMat = glowMat('#ffffff', 2.5);
    const coneMat = glowMat(ctx.accent, 2.4);
    const legMat = new THREE.LineBasicMaterial({ color: new THREE.Color(ctx.accent).multiplyScalar(2.0), toneMapped: false });
    const antMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#ffd0ea').multiplyScalar(1.8), toneMapped: false });
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    disposables.push(bodyGeo, abdGeo, headGeo, eyeGeo, coneGeo, hitGeo, legGeo, antGeo, bodyGlass, eyeMat, coneMat, legMat, antMat, hitMat, barGeo, dotGeo, panelGeo, gutterMat, ...codeMats);

    const bugs = [];

    function makeBug(i) {
      const outer = new THREE.Group();
      const inner = new THREE.Group();
      outer.add(inner);

      const body = new THREE.Mesh(bodyGeo, bodyGlass);
      body.scale.set(1.15, 0.8, 0.7);
      body.add(edgeLines(bodyGeo, ctx.accent, 2.0));
      const abd = new THREE.Mesh(abdGeo, bodyGlass);
      abd.position.x = -0.5;
      abd.scale.set(1.2, 0.85, 0.7);
      abd.add(edgeLines(abdGeo, ctx.accent, 1.8));
      const head = new THREE.Mesh(headGeo, bodyGlass);
      head.position.x = 0.58;
      head.add(edgeLines(headGeo, ctx.accent, 2.2));
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(0.7, 0.1, 0.12);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.7, -0.1, 0.12);
      const sting = new THREE.Mesh(coneGeo, coneMat);
      sting.position.x = -0.92;
      sting.rotation.z = Math.PI / 2;
      inner.add(body, abd, head, eyeL, eyeR, sting);

      const legs = [];
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < 3; k++) {
          const pivot = new THREE.Group();
          pivot.position.set(0.22 - k * 0.24, side * 0.2, 0);
          pivot.scale.y = side;
          pivot.add(new THREE.Line(legGeo, legMat));
          inner.add(pivot);
          legs.push({ pivot, k, side, base: (k - 1) * 0.45 });
        }
      }
      const ants = [];
      for (let side = -1; side <= 1; side += 2) {
        const pivot = new THREE.Group();
        pivot.position.set(0.74, side * 0.1, 0.02);
        pivot.scale.y = side;
        pivot.add(new THREE.Line(antGeo, antMat));
        inner.add(pivot);
        ants.push({ pivot, side });
      }

      const halo = glowSprite(ctx.accent, 2.2, 0.28);
      halo.position.z = -0.1;
      outer.add(halo);

      const hit = new THREE.Mesh(hitGeo, hitMat);
      outer.add(hit);

      // spawn spread across a 3x2 grid with jitter
      const col = i % 3, row = Math.floor(i / 3);
      const px = ((col + 0.5) / 3 - 0.5) * hw * 1.7 + rand(-0.5, 0.5);
      const py = ((row + 0.5) / 2 - 0.5) * hh * 1.6 + rand(-0.4, 0.4);
      outer.position.set(px, py, 0);
      outer.scale.setScalar(0.001);
      scene.add(outer);

      const heading = rand(0, Math.PI * 2);
      const bug = {
        outer, inner, legs, ants, halo, hit,
        heading, angle: heading,
        speed: rand(1.5, 2.2), turn: 0, turnTarget: rand(-1.8, 1.8), turnT: rand(0.4, 1.2),
        dashT: rand(1.5, 3.5), dashing: 0, phase: rand(0, 6.28),
        alive: true, hover: 0, wasHover: false, speedNow: 0,
        baseScale: bugScale * rand(0.95, 1.1),
      };
      hit.userData.bug = bug;
      track(outer.scale);
      gsap.to(outer.scale, {
        x: bug.baseScale, y: bug.baseScale, z: bug.baseScale,
        duration: 0.55, delay: i * 0.07, ease: 'back.out(2.2)',
      });
      bugs.push(bug);
      return bug;
    }
    for (let i = 0; i < N; i++) makeBug(i);

    // ───────────── Counter + pips ─────────────
    const counterY = -(hh + 0.78);
    const counter = textSprite(`BUGS LEFT  ${N}`, {
      worldH: 0.42, width: 512, height: 96, font: '700 44px "JetBrains Mono"', color: '#ffffff',
    });
    counter.sprite.position.set(0, counterY, 0.2);
    scene.add(counter.sprite);
    const pipRing = new THREE.RingGeometry(0.1, 0.13, 20);
    const pipFill = new THREE.CircleGeometry(0.1, 16);
    const pipRingMat = glowMat(ctx.accent, 1.8, 0.9);
    const pipFillMat = glowMat(GREEN, 2.4);
    disposables.push(pipRing, pipFill, pipRingMat, pipFillMat);
    const pips = [];
    for (let i = 0; i < N; i++) {
      const g = new THREE.Group();
      g.position.set((i - (N - 1) / 2) * 0.38, counterY - 0.42, 0.2);
      const r = new THREE.Mesh(pipRing, pipRingMat);
      const f = new THREE.Mesh(pipFill, pipFillMat);
      f.scale.setScalar(0.001);
      g.add(r, f);
      scene.add(g);
      pips.push({ g, f });
      track(f.scale); track(g.scale);
    }

    let fixed = 0;
    let finished = false;
    const splats = [];

    // ───────────── Splat decal ─────────────
    const blobGeo = new THREE.CircleGeometry(1, 14);
    disposables.push(blobGeo);
    function makeSplat(p) {
      const g = new THREE.Group();
      g.position.set(p.x, p.y, -0.3);
      g.rotation.z = rand(0, 6.28);
      const mat = glowMat(GREEN, 1.6, 0.85);
      const main = new THREE.Mesh(blobGeo, mat);
      main.scale.set(0.5, 0.42, 1);
      g.add(main);
      for (let i = 0; i < 7; i++) {
        const a = rand(0, 6.28), d = rand(0.4, 0.85), s = rand(0.07, 0.2);
        const b = new THREE.Mesh(blobGeo, mat);
        b.position.set(Math.cos(a) * d, Math.sin(a) * d, 0);
        b.scale.set(s * rand(0.8, 1.4), s, 1);
        g.add(b);
        // little streak connecting blob to centre
        const st = new THREE.Mesh(blobGeo, mat);
        st.position.set(Math.cos(a) * d * 0.55, Math.sin(a) * d * 0.55, 0);
        st.rotation.z = a;
        st.scale.set(d * 0.5, s * 0.35, 1);
        g.add(st);
      }
      const halo = glowSprite(GREEN, 2.2, 0.45);
      halo.position.z = -0.05;
      g.add(halo);
      g.scale.setScalar(0.01);
      scene.add(g);
      track(g.scale); track(mat); track(halo.material);
      gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'back.out(2.5)' });
      gsap.to(mat, { opacity: 0, duration: 3.2, delay: 1.2, ease: 'power1.in' });
      gsap.to(halo.material, { opacity: 0, duration: 1.6, delay: 0.3, ease: 'power2.out' });
      splats.push({ g, mat });
    }

    // ───────────── Squash ─────────────
    function updateCounter() {
      const left = N - fixed;
      counter.setText(left > 0 ? `BUGS LEFT  ${left}` : 'ALL BUGS FIXED', left > 0 ? '#ffffff' : '#7dffb0');
    }

    function squash(bug) {
      bug.alive = false;
      const p = bug.outer.position.clone();
      const pip = pips[fixed];
      fixed++;
      gsap.killTweensOf(bug.outer.scale);
      scene.remove(bug.outer);

      audio.sfx.hit();
      fx.burst(p, GREEN, 36, 4.2, 0.2, 0.8, 2.2);
      fx.burst(p, ctx.accent, 14, 2.6, 0.14, 0.6, 1.2);
      fx.ring(p, GREEN, 2.4, 0.55);
      fx.shake(0.07, 0.15);
      fx.pop(p, '+1 bug fixed', '#7dffb0');
      makeSplat(p);

      pip.f.scale.setScalar(0.001);
      gsap.to(pip.f.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(3)' });
      gsap.fromTo(pip.g.scale, { x: 1.7, y: 1.7, z: 1.7 }, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(3)' });
      updateCounter();

      if (fixed >= N && !finished) {
        finished = true;
        audio.sfx.coin();
        fx.flash('#3dff8a', 0.25);
        fx.ring(new THREE.Vector3(0, 0, 0), GREEN, 7, 0.9);
        pips.forEach((pp, i) => fx.burst(pp.g.position, GREEN, 14, 2.6, 0.14, 0.8, 0.5));
        ctx.win();
      }
    }

    // ───────────── Update ─────────────
    const tmp = new THREE.Vector3();
    return {
      update(dt, t) {
        dt = Math.min(dt, 0.05);

        // backdrop animation
        const k = (t * 0.35) % 1;
        scan.position.y = ph / 2 - barH - k * (ph - barH);
        scan.material.opacity = 0.18 * Math.sin(k * Math.PI);
        codeMats.forEach((m, i) => { m.opacity = (i === 4 ? 0.2 : 0.12) + Math.sin(t * 1.2 + i * 1.7) * 0.04; });

        const pp = ctx.planePoint(0);
        const hovered = ctx.pick(bugs.filter((b) => b.alive).map((b) => b.hit));
        const hoverBug = hovered ? hovered.object.userData.bug : null;

        for (const b of bugs) {
          if (!b.alive) continue;
          const o = b.outer;

          // wander
          b.turnT -= dt;
          if (b.turnT <= 0) { b.turnT = rand(0.4, 1.4); b.turnTarget = rand(-2.4, 2.4); }
          b.turn += (b.turnTarget - b.turn) * Math.min(1, dt * 3);
          b.heading += b.turn * dt;

          // dash
          b.dashT -= dt;
          if (b.dashT <= 0 && b.dashing <= 0) { b.dashing = 0.35; b.dashT = rand(2.2, 4.5); b.heading += rand(-0.8, 0.8); }
          let mult = 1;
          if (b.dashing > 0) {
            b.dashing -= dt;
            mult = 2.1;
            if (Math.random() < dt * 20) fx.burst(o.position, ctx.accent, 1, 0.5, 0.1, 0.35, 0);
          }
          // stop-and-go scurry, and slow a bit when the pointer is nearby (forgiving)
          const scurry = 0.65 + 0.35 * Math.sin(t * 3.1 + b.phase);
          const near = Math.hypot(o.position.x - pp.x, o.position.y - pp.y);
          const calm = near < 1.6 ? 0.6 : 1;
          const sp = b.speed * scurry * mult * calm;
          b.speedNow += (sp - b.speedNow) * Math.min(1, dt * 8);

          o.position.x += Math.cos(b.heading) * b.speedNow * dt;
          o.position.y += Math.sin(b.heading) * b.speedNow * dt;

          // bounce off the edges
          if (o.position.x > hw) { o.position.x = hw; b.heading = Math.PI - b.heading; b.turn = 0; }
          else if (o.position.x < -hw) { o.position.x = -hw; b.heading = Math.PI - b.heading; b.turn = 0; }
          if (o.position.y > hh) { o.position.y = hh; b.heading = -b.heading; b.turn = 0; }
          else if (o.position.y < -hh) { o.position.y = -hh; b.heading = -b.heading; b.turn = 0; }

          // smooth facing
          b.angle += angDiff(b.angle, b.heading) * Math.min(1, dt * 9);
          b.inner.rotation.z = b.angle;

          // gait
          const rate = 6 + b.speedNow * 3.2;
          b.phase += dt * rate;
          for (const L of b.legs) {
            const ph0 = b.phase + L.k * 2.1 + (L.side > 0 ? 0 : Math.PI);
            L.pivot.rotation.z = L.base + Math.sin(ph0) * 0.5;
            L.pivot.rotation.x = Math.max(0, Math.cos(ph0)) * 0.0;
          }
          for (const A of b.ants) {
            A.pivot.rotation.z = Math.sin(t * 5 + b.phase * 0.2 + A.side) * 0.28 + 0.25;
          }
          b.inner.position.z = Math.sin(t * 2 + b.phase) * 0.03;
          b.inner.rotation.x = Math.sin(b.phase * 0.5) * 0.04;

          // hover
          const isHover = hoverBug === b;
          if (isHover && !b.wasHover) audio.sfx.hover();
          b.wasHover = isHover;
          b.hover += ((isHover ? 1 : 0) - b.hover) * Math.min(1, dt * 12);
          b.halo.material.opacity = 0.28 + b.hover * 0.5 + Math.sin(t * 4 + b.phase) * 0.04;
          if (o.scale.x > b.baseScale * 0.98 || b.hover > 0.01) {
            // don't fight the spawn tween until it has essentially finished
            if (!gsap.isTweening(o.scale)) o.scale.setScalar(b.baseScale * (1 + b.hover * 0.14));
          }
        }

        // squash on click
        if (input.pressed && !finished) {
          let target = hoverBug;
          if (!target) {
            // forgiving fallback: nearest bug within a generous radius of the pointer
            let best = 1.15 * bugScale;
            for (const b of bugs) {
              if (!b.alive) continue;
              const d = tmp.copy(b.outer.position).sub(pp).setZ(0).length();
              if (d < best) { best = d; target = b; }
            }
          }
          if (target) squash(target);
          else audio.sfx.click();
        }

        // gentle pulse on remaining pips' rings
        pips.forEach((p, i) => { if (i >= fixed) p.g.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.08); });
      },

      dispose() {
        tweenTargets.forEach((o) => gsap.killTweensOf(o));
        bugs.forEach((b) => { gsap.killTweensOf(b.outer.scale); gsap.killTweensOf(b.halo.material); });
        gsap.killTweensOf(counter);
        counter.dispose();
        disposables.forEach((d) => d.dispose && d.dispose());
        splats.forEach((s) => gsap.killTweensOf(s.mat));
      },
    };
  },
};
