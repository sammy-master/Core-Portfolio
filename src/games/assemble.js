import * as THREE from 'three';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite, shuffle, rand } from '../engine/helpers.js';

/**
 * Assemble the Web: drag <html>, <css>, <js> glass cubes into the matching
 * STRUCTURE / STYLE / BEHAVIOR sockets on a blueprint page.
 */
const CUBES = [
  { tag: '<html>', socket: 0, color: '#ff8a4c' },
  { tag: '<css>', socket: 1, color: '#4cc3ff' },
  { tag: '<js>', socket: 2, color: '#ffe14c' },
];
const SOCKET_LABELS = ['STRUCTURE', 'STYLE', 'BEHAVIOR'];

export default {
  create(ctx) {
    const { scene, fx, audio, input, pick, gsap } = ctx;
    const v = ctx.view();
    const sc = Math.min(1, Math.max(0.55, v.w / 9.5));

    const cs = 1.15 * sc;          // cube size
    const ss = 1.45 * sc;          // socket size
    const gap = 0.4 * sc;
    const pageW = 3 * ss + 2 * gap + 0.9 * sc;
    const pageH = ss + 2.1 * sc;
    const pageC = new THREE.Vector3(0, Math.min(0.9 * sc, v.h / 2 - pageH / 2 - 0.5), 0);
    const bx = v.w / 2 - 0.7 * sc, by = v.h / 2 - 0.7 * sc;

    const tweenTargets = [];
    const track = (o) => { tweenTargets.push(o); return o; };
    const disposables = [];
    const delayed = [];

    // ───────────── Blueprint page ─────────────
    const blue = new THREE.Group();
    blue.position.set(pageC.x, pageC.y, -0.3);
    scene.add(blue);

    const pageGeo = new THREE.BoxGeometry(pageW, pageH, 0.02);
    const pageFill = new THREE.Mesh(new THREE.PlaneGeometry(pageW, pageH), bodyMat('#06112a', 0.55));
    const pageEdges = edgeLines(pageGeo, ctx.accent, 0.9, 0.75);
    blue.add(pageFill, pageEdges);

    // grid
    const gridPts = [];
    const step = 0.4 * sc;
    for (let x = -pageW / 2 + step; x < pageW / 2 - 0.01; x += step) gridPts.push(x, -pageH / 2, 0, x, pageH / 2, 0);
    for (let y = -pageH / 2 + step; y < pageH / 2 - 0.01; y += step) gridPts.push(-pageW / 2, y, 0, pageW / 2, y, 0);
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
    const gridMat = new THREE.LineBasicMaterial({ color: new THREE.Color(ctx.accent).multiplyScalar(0.8), transparent: true, opacity: 0.1, toneMapped: false });
    blue.add(new THREE.LineSegments(gridGeo, gridMat));

    const pageTitle = textSprite('index.html', {
      worldH: 0.3 * sc, width: 384, height: 96, font: '600 38px "JetBrains Mono"', color: '#7fb6d8', align: 'left',
    });
    pageTitle.sprite.position.set(-pageW / 2 + 0.1 * sc + (384 / 96) * 0.3 * sc / 2, pageH / 2 - 0.3 * sc, 0.02);
    blue.add(pageTitle.sprite);
    const rule = new THREE.Mesh(new THREE.PlaneGeometry(pageW - 0.3 * sc, 0.02), glowMat(ctx.accent, 1.2, 0.5));
    rule.position.set(0, pageH / 2 - 0.58 * sc, 0.02);
    blue.add(rule);
    disposables.push(pageGeo, gridGeo, gridMat, rule.geometry, rule.material, pageFill.geometry, pageFill.material, pageEdges.geometry, pageEdges.material);

    // ───────────── Sockets ─────────────
    const sockets = [];
    const socketGeo = new THREE.BoxGeometry(ss, ss, 0.1);
    const socketPlane = new THREE.PlaneGeometry(ss, ss);
    const cornerGeo = new THREE.PlaneGeometry(0.16 * sc, 0.04 * sc);
    disposables.push(socketGeo, socketPlane, cornerGeo);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const x = (i - 1) * (ss + gap);
      g.position.set(pageC.x + x, pageC.y - 0.25 * sc, 0);
      const frame = edgeLines(socketGeo, ctx.accent, 1.3, 0.85);
      const fillMat = glowMat(ctx.accent, 1.0, 0.06);
      const fill = new THREE.Mesh(socketPlane, fillMat);
      fill.position.z = -0.05;
      const halo = glowSprite(ctx.accent, ss * 2.6, 0.0);
      halo.position.z = -0.1;
      const cmat = glowMat(ctx.accent, 2.6, 0.95);
      g.add(fill, frame, halo);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        for (let k = 0; k < 2; k++) {
          const c = new THREE.Mesh(cornerGeo, cmat);
          c.position.set(sx * (ss / 2 - (k === 0 ? 0.08 : 0.02) * sc), sy * (ss / 2 - (k === 0 ? 0.02 : 0.08) * sc), 0.02);
          if (k === 1) c.rotation.z = Math.PI / 2;
          g.add(c);
        }
      }
      const label = textSprite(SOCKET_LABELS[i], {
        worldH: 0.3 * sc, width: 512, height: 96, font: '700 40px "Space Grotesk"', color: '#9fe9ff',
      });
      label.sprite.position.set(0, -ss / 2 - 0.34 * sc, 0.02);
      g.add(label.sprite);
      scene.add(g);
      disposables.push(frame.material, fillMat, cmat, label);
      sockets.push({ g, frame, fillMat, halo, label, filled: false, glow: 0, pos: g.position.clone() });
    }

    // ───────────── Cubes ─────────────
    const cubeGeo = new THREE.BoxGeometry(cs, cs, cs);
    const hitGeo = new THREE.BoxGeometry(cs * 1.45, cs * 1.45, cs * 1.2);
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    disposables.push(cubeGeo, hitGeo, hitMat);

    // scatter: lower band, deranged so no cube starts above its socket column
    const dx = Math.min(4.2, v.w / 2 - 0.9 * sc);
    const cols = [0, 1, 2];
    let perm = shuffle([...cols]);
    while (perm.some((p, i) => p === i)) perm = shuffle([...cols]);
    const bandY = Math.max(-by, Math.min(pageC.y - pageH / 2 - 1.3 * sc, -1.8));
    const cubes = CUBES.map((def, i) => {
      const group = new THREE.Group();
      const col = new THREE.Color(def.color);
      const body = new THREE.Mesh(cubeGeo, bodyMat('#0a1226', 0.82));
      const edgeMat = new THREE.LineBasicMaterial({ color: col.clone().multiplyScalar(2.2), transparent: true, toneMapped: false });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cubeGeo), edgeMat);
      const core = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.3, cs * 0.3, cs * 0.3), glowMat(col, 1.8, 0.28));
      const halo = glowSprite(col, cs * 2.6, 0.32);
      halo.position.z = -cs * 0.6;
      const label = textSprite(def.tag, {
        worldH: 0.34 * sc, width: 384, height: 96, font: '700 52px "JetBrains Mono"', color: '#ffffff',
      });
      label.sprite.position.z = cs * 0.62;
      const hit = new THREE.Mesh(hitGeo, hitMat);
      group.add(body, edges, core, halo, label.sprite, hit);

      const home = new THREE.Vector3(
        THREE.MathUtils.clamp((perm[i] - 1) * dx + rand(-0.35, 0.35), -bx, bx),
        THREE.MathUtils.clamp(bandY + (perm[i] === 1 ? -0.5 * sc : 0.3 * sc) + rand(-0.25, 0.25), -by, by),
        0,
      );
      group.position.copy(home);
      group.rotation.set(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.2, 0.2));
      group.scale.setScalar(0.001);
      scene.add(group);

      const cube = {
        def, group, body, edgeMat, edges, halo, label, core, hit, home,
        state: 'idle', // idle | drag | return | snap | locked
        offset: new THREE.Vector3(), vel: new THREE.Vector3(), prev: home.clone(),
        phase: rand(0, 6.28), col, scaleK: 1,
      };
      hit.userData.cube = cube;
      disposables.push(body.material, edgeMat, edges.geometry, core.geometry, core.material, halo.material, label, hit.geometry);
      track(group.scale); track(group.position); track(group.rotation); track(halo.material);
      gsap.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.6, delay: 0.1 + i * 0.12, ease: 'back.out(2)' });
      return cube;
    });
    const hitMeshes = cubes.map((c) => c.hit);

    // ───────────── State ─────────────
    let drag = null;
    let snapped = 0;
    let finished = false;
    let nearIdx = -1;
    const tgt = new THREE.Vector3();

    function releaseCube(c) {
      c.state = 'return';
      drag = null;
      const p = c.group.position;
      // nearest socket
      let best = -1, bd = Infinity;
      sockets.forEach((s, i) => {
        const d = Math.hypot(p.x - s.pos.x, p.y - s.pos.y);
        if (d < bd) { bd = d; best = i; }
      });
      const snapR = 1.0 * sc + ss * 0.4;
      gsap.killTweensOf(c.group.position);
      gsap.killTweensOf(c.group.rotation);
      gsap.killTweensOf(c.group.scale);

      if (best >= 0 && bd < snapR && best === c.def.socket && !sockets[best].filled) {
        // ✓ correct socket
        const s = sockets[best];
        s.filled = true;
        c.state = 'snap';
        snapped++;
        audio.sfx.coin();
        gsap.to(c.group.position, { x: s.pos.x, y: s.pos.y, z: 0, duration: 0.38, ease: 'back.out(2.2)' });
        gsap.to(c.group.rotation, { x: 0, y: 0, z: 0, duration: 0.38, ease: 'power3.out' });
        gsap.to(c.group.scale, { x: 1, y: 1, z: 1, duration: 0.38, ease: 'back.out(2.5)' });
        const lp = new THREE.Vector3(s.pos.x, s.pos.y, 0.3);
        const d1 = gsap.delayedCall(0.3, () => {
          c.state = 'locked';
          fx.ring(lp, c.col, 3.2, 0.6);
          fx.ring(lp, ctx.accent, 4.4, 0.8);
          fx.burst(lp, c.col, 36, 4, 0.2, 0.85, 0.8);
          fx.burst(lp, 0xffffff, 10, 2.4, 0.12, 0.6, 0);
          fx.shake(0.05, 0.12);
          fx.pop(lp, `${c.def.tag} ✓ ${SOCKET_LABELS[best].toLowerCase()}`, c.def.color);
          const o = { k: 1 };
          gsap.to(o, {
            k: 0, duration: 0.5, ease: 'power2.out',
            onUpdate: () => {
              c.edgeMat.color.copy(c.col).multiplyScalar(2.2 + o.k * 2.2);
              s.halo.material.opacity = 0.2 + o.k * 0.6;
            },
          });
          s.fillMat.opacity = 0.2;
          s.label.setText(SOCKET_LABELS[best], '#ffffff');
          if (snapped >= 3) completeAssembly();
        });
        delayed.push(d1);
        return;
      }

      // ✗ wrong socket or empty space → spring back
      if (best >= 0 && bd < snapR) {
        fx.shake(0.14, 0.25);
        fx.pop(new THREE.Vector3(p.x, p.y + 0.8, 0.5), 'wrong socket', '#ff6b8a');
        fx.burst(p, 0xff4f6e, 10, 2, 0.12, 0.5, 0);
      }
      audio.sfx.error();
      gsap.to(c.group.position, {
        x: c.home.x, y: c.home.y, z: 0, duration: 0.8, ease: 'elastic.out(1, 0.55)',
        onComplete: () => { c.state = 'idle'; },
      });
      gsap.to(c.group.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
      gsap.to(c.group.rotation, { x: rand(-0.2, 0.2), y: rand(-0.2, 0.2), z: 0, duration: 0.6, ease: 'power3.out' });
    }

    function completeAssembly() {
      if (finished) return;
      finished = true;
      audio.sfx.whoosh();
      fx.flash('#22e4ff', 0.18);

      // blueprint "lights up"
      const o = { k: 0 };
      track(o);
      gsap.to(o, {
        k: 1, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1,
        onUpdate: () => {
          pageEdges.material.color.copy(ctx.accent).multiplyScalar(0.9 + o.k * 3.4);
          pageEdges.material.opacity = 0.75 + o.k * 0.25;
          gridMat.opacity = 0.1 + o.k * 0.22;
          rule.material.opacity = 0.5 + o.k * 0.5;
        },
      });
      sockets.forEach((s, i) => {
        gsap.to(s.halo.material, { opacity: 0.9, duration: 0.25, delay: i * 0.08, yoyo: true, repeat: 1 });
        fx.ring(new THREE.Vector3(s.pos.x, s.pos.y, 0.2), ctx.accent, 3.4, 0.7);
      });

      // cubes fuse into the centre
      const centre = new THREE.Vector3(pageC.x, pageC.y - 0.1 * sc, 0.3);
      cubes.forEach((c, i) => {
        gsap.to(c.group.position, { x: centre.x, y: centre.y, z: 0.3, duration: 0.5, delay: 0.35 + i * 0.04, ease: 'power3.in' });
        gsap.to(c.group.scale, { x: 0.05, y: 0.05, z: 0.05, duration: 0.5, delay: 0.35 + i * 0.04, ease: 'power3.in' });
        gsap.to(c.group.rotation, { y: Math.PI * 2, z: 0.6, duration: 0.5, delay: 0.35, ease: 'power3.in' });
      });
      sockets.forEach((s) => {
        gsap.to(s.g.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 0.3, delay: 0.35 });
        gsap.to(s.label.sprite.material, { opacity: 0, duration: 0.3, delay: 0.35 });
        gsap.to(s.frame.material, { opacity: 0.25, duration: 0.3, delay: 0.35 });
        track(s.g.scale); track(s.label.sprite.material); track(s.frame.material); track(s.halo.material);
      });

      // little web page assembles
      const d2 = gsap.delayedCall(0.9, () => buildMiniPage(centre));
      delayed.push(d2);

      const wait = ctx.timeLeft ? ctx.timeLeft() : 99;
      if (wait < 1.2) ctx.win();
      else delayed.push(gsap.delayedCall(0.95, () => ctx.win()));
    }

    function buildMiniPage(c) {
      audio.sfx.hit();
      fx.ring(c, 0xffffff, 4.5, 0.7);
      fx.burst(c, ctx.accent, 40, 5, 0.2, 1.0, 0.4);
      fx.burst(c, 0xffffff, 14, 3, 0.14, 0.7, 0);
      const W = 2.5 * sc, H = 2.7 * sc;
      const page = new THREE.Group();
      page.position.set(c.x, c.y, 0.5);
      const cardGeo = new THREE.BoxGeometry(W, H, 0.04);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(W, H), bodyMat('#071836', 0.95));
      const cardEdge = edgeLines(cardGeo, ctx.accent, 2.6);
      page.add(card, cardEdge);
      disposables.push(cardGeo, card.geometry, card.material, cardEdge.geometry, cardEdge.material);
      const parts = [];
      const add = (w, h, x, y, color, inten, op = 1) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glowMat(color, inten, op));
        m.position.set(x, y, 0.03);
        m.scale.set(0.001, 1, 1);
        page.add(m);
        disposables.push(m.geometry, m.material);
        parts.push(m);
      };
      add(W - 0.3 * sc, 0.4 * sc, 0, H / 2 - 0.4 * sc, '#ff8a4c', 1.8);       // header (html)
      add(W * 0.55, 0.14 * sc, -W * 0.18, H / 2 - 0.95 * sc, '#4cc3ff', 1.6);  // title (css)
      add(W * 0.78, 0.1 * sc, -W * 0.07, H / 2 - 1.25 * sc, '#8aa0d8', 1.0, 0.8);
      add(W * 0.68, 0.1 * sc, -W * 0.12, H / 2 - 1.5 * sc, '#8aa0d8', 1.0, 0.8);
      add(W * 0.5, 0.36 * sc, 0, -H / 2 + 0.5 * sc, '#ffe14c', 2.2);           // button (js)
      page.scale.setScalar(0.01);
      scene.add(page);
      track(page.scale);
      gsap.to(page.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2)' });
      parts.forEach((m, i) => {
        track(m.scale);
        gsap.to(m.scale, { x: 1, duration: 0.35, delay: 0.15 + i * 0.1, ease: 'power3.out' });
        m.position.x += 0; // anchor from centre expands symmetrically
      });
      const halo = glowSprite(ctx.accent, W * 3.2, 0.5);
      halo.position.z = -0.1;
      page.add(halo);
      disposables.push(halo.material);
      gsap.to(halo.material, { opacity: 0.9, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      track(halo.material);
    }

    // ───────────── Update ─────────────
    return {
      update(dt, t) {
        dt = Math.min(dt, 0.05);
        const pp = ctx.planePoint(0);

        // begin drag
        if (input.pressed && !drag && !finished) {
          const h = pick(hitMeshes);
          if (h) {
            const c = h.object.userData.cube;
            if (c.state !== 'locked' && c.state !== 'snap') {
              gsap.killTweensOf(c.group.position);
              gsap.killTweensOf(c.group.rotation);
              gsap.killTweensOf(c.group.scale);
              drag = c;
              c.state = 'drag';
              c.offset.set(c.group.position.x - pp.x, c.group.position.y - pp.y, 0);
              c.prev.copy(c.group.position);
              audio.sfx.pick();
              gsap.to(c.group.scale, { x: 1.14, y: 1.14, z: 1.14, duration: 0.2, ease: 'back.out(3)' });
              gsap.to(c.halo.material, { opacity: 0.7, duration: 0.2 });
              fx.burst(c.group.position, c.col, 8, 1.6, 0.1, 0.4, 0);
            }
          }
        }

        // dragging
        nearIdx = -1;
        if (drag) {
          const c = drag;
          if (!input.down) {
            gsap.to(c.halo.material, { opacity: 0.32, duration: 0.3 });
            releaseCube(c);
          } else {
            tgt.set(
              THREE.MathUtils.clamp(pp.x + c.offset.x, -bx, bx),
              THREE.MathUtils.clamp(pp.y + c.offset.y, -by, by),
              0.6,
            );
            const k = 1 - Math.exp(-dt * 16);
            c.group.position.lerp(tgt, k);
            c.vel.copy(c.group.position).sub(c.prev).divideScalar(Math.max(dt, 1e-3));
            c.prev.copy(c.group.position);
            const r = c.group.rotation;
            r.z += (THREE.MathUtils.clamp(-c.vel.x * 0.05, -0.55, 0.55) - r.z) * Math.min(1, dt * 10);
            r.x += (THREE.MathUtils.clamp(c.vel.y * 0.05, -0.55, 0.55) - r.x) * Math.min(1, dt * 10);
            r.y += (THREE.MathUtils.clamp(c.vel.x * 0.04, -0.6, 0.6) - r.y) * Math.min(1, dt * 10);
            let bd = Infinity;
            sockets.forEach((s, i) => {
              const d = Math.hypot(c.group.position.x - s.pos.x, c.group.position.y - s.pos.y);
              if (d < bd) { bd = d; nearIdx = i; }
            });
            if (bd > ss * 1.9) nearIdx = -1;
            else sockets[nearIdx]._d = bd;
          }
        }

        // idle float
        cubes.forEach((c, i) => {
          if (c.state !== 'idle') return;
          c.group.position.x = c.home.x + Math.sin(t * 0.7 + c.phase) * 0.07;
          c.group.position.y = c.home.y + Math.sin(t * 1.3 + c.phase) * 0.12;
          c.group.rotation.y += (Math.sin(t * 0.8 + c.phase) * 0.4 - c.group.rotation.y) * Math.min(1, dt * 2);
          c.group.rotation.x += (Math.cos(t * 0.6 + c.phase) * 0.25 - c.group.rotation.x) * Math.min(1, dt * 2);
          c.group.rotation.z += (Math.sin(t * 0.5 + c.phase) * 0.08 - c.group.rotation.z) * Math.min(1, dt * 2);
        });

        // sockets pulse when a cube is near
        sockets.forEach((s, i) => {
          let target = 0;
          if (!s.filled && i === nearIdx) target = 1 - THREE.MathUtils.clamp((s._d - ss * 0.4) / (ss * 1.5), 0, 1);
          s.glow += (target - s.glow) * Math.min(1, dt * 10);
          if (!finished && !s.filled) {
            const pulse = 0.5 + 0.5 * Math.sin(t * 6);
            s.halo.material.opacity = s.glow * (0.35 + 0.35 * pulse) + 0.03 * Math.sin(t * 1.5 + i) + 0.04;
            s.fillMat.opacity = 0.06 + s.glow * 0.2;
            s.frame.material.color.copy(ctx.accent).multiplyScalar(1.3 + s.glow * 2.2);
            const sc2 = 1 + s.glow * 0.06 * (0.6 + pulse);
            s.g.scale.setScalar(sc2);
          }
        });

        blue.position.y = pageC.y + Math.sin(t * 0.9) * 0.03;
      },

      dispose() {
        tweenTargets.forEach((o) => gsap.killTweensOf(o));
        cubes.forEach((c) => {
          gsap.killTweensOf(c.group.position); gsap.killTweensOf(c.group.rotation); gsap.killTweensOf(c.group.scale);
          gsap.killTweensOf(c.halo.material); gsap.killTweensOf(c.edgeMat);
        });
        sockets.forEach((s) => {
          gsap.killTweensOf(s.g.scale); gsap.killTweensOf(s.halo.material); gsap.killTweensOf(s.frame.material);
          gsap.killTweensOf(s.label.sprite.material);
        });
        delayed.forEach((d) => d.kill());
        disposables.forEach((d) => d && d.dispose && d.dispose());
      },
    };
  },
};
