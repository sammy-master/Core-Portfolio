import * as THREE from 'three';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite, shuffle } from '../engine/helpers.js';

/**
 * "Tensor Time": 2x2 matrix multiplication. Two rounds (C[0][0], C[1][1]).
 * Pick the right orb; the dot-product data flow animates into the result cell.
 */
export default {
  create(ctx) {
    const { scene, fx, audio, input, pick, gsap } = ctx;
    const COL_A = new THREE.Color(ctx.accent);
    const COL_B = new THREE.Color('#ff6bd6');
    const COL_C = new THREE.Color('#7dffb0');
    const RED = new THREE.Color('#ff4060');

    const tweens = [];
    const to = (...a) => { const tw = gsap.to(...a); tweens.push(tw); return tw; };
    const later = (s, fn) => { const tw = gsap.delayedCall(s, fn); tweens.push(tw); return tw; };
    const extra = [];       // tracked objects for tween killing

    const v = ctx.view();
    const H = Math.min(8.5, v.h);
    const K = Math.min(1, (v.w * 0.94) / 9.2, H / 7);
    const CELL_W = 1.1, CELL_H = 1.0;

    // ---- random problem: C00 and C11 both in [2, 18] ----
    const ri = () => Math.floor(Math.random() * 4);
    let A, B, C;
    do {
      A = [[ri(), ri()], [ri(), ri()]];
      B = [[ri(), ri()], [ri(), ri()]];
      C = [0, 1].map((r) => [0, 1].map((c) => A[r][0] * B[0][c] + A[r][1] * B[1][c]));
    } while (C[0][0] < 2 || C[1][1] < 2 || C[0][0] === C[1][1] || A[0][0] * B[0][0] === 0 || A[1][0] * B[0][1] === 0);
    const rounds = [[0, 0], [1, 1]];

    // ---- backdrop grid (holographic floor lines) ----
    const gridPts = [];
    for (let i = -8; i <= 8; i++) {
      gridPts.push(i * 1.2, -H / 2, -2, i * 1.2, H / 2, -2);
    }
    for (let j = -5; j <= 5; j++) {
      gridPts.push(-v.w / 2, j * 1.2, -2, v.w / 2, j * 1.2, -2);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
    const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(ctx.accent).multiplyScalar(0.7), transparent: true, opacity: 0.1, toneMapped: false }));
    scene.add(grid);

    // ---- matrix builder ----
    function makeMatrix(vals, color, withHL) {
      const g = new THREE.Group();
      const cells = [];
      const panelGeo = new THREE.BoxGeometry(2.7, 2.5, 0.1);
      const panel = new THREE.Mesh(panelGeo, bodyMat('#071327', 0.55));
      panel.position.z = -0.12;
      const pe = edgeLines(panelGeo, color, 0.9, 0.45);
      pe.position.z = -0.12;
      const halo = glowSprite(color, 5, 0.22);
      halo.position.z = -0.3;
      g.add(panel, pe, halo);
      const bm = glowMat(color, 2.4);
      for (const s of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.3, 0.07), bm);
        bar.position.x = s * 1.2;
        g.add(bar);
        for (const yy of [-1, 1]) {
          const tick = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.07), bm);
          tick.position.set(s * (1.2 - 0.125), yy * 1.115, 0);
          g.add(tick);
        }
      }
      for (let r = 0; r < 2; r++) {
        cells[r] = [];
        for (let c = 0; c < 2; c++) {
          const t = textSprite(vals ? String(vals[r][c]) : '?', {
            worldH: 0.75, width: 192, height: 192, font: '700 120px "JetBrains Mono"',
            color: vals ? '#ffffff' : '#51658f',
          });
          t.sprite.position.set((c - 0.5) * CELL_W, (0.5 - r) * CELL_H, 0.05);
          g.add(t.sprite);
          cells[r][c] = t;
        }
      }
      return { g, cells, color, halo, panel };
    }

    const board = new THREE.Group();
    board.scale.setScalar(K);
    board.position.y = 0.55;
    scene.add(board);
    const mA = makeMatrix(A, COL_A);
    const mB = makeMatrix(B, COL_B);
    const mC = makeMatrix(null, COL_C);
    mA.g.position.x = -3.3; mB.g.position.x = 0; mC.g.position.x = 3.3;
    board.add(mA.g, mB.g, mC.g);
    const opts = { worldH: 1.1, width: 128, height: 128, font: '700 90px "JetBrains Mono"' };
    const times = textSprite('\u00d7', { ...opts, color: '#9fb4ff' });
    const eq = textSprite('=', { ...opts, color: '#9fb4ff' });
    times.sprite.position.x = -1.65; eq.sprite.position.x = 1.65;
    board.add(times.sprite, eq.sprite);

    // highlights for current row of A / column of B / target cell of C
    const hlMatA = glowMat(COL_A, 1.2, 0.22);
    const hlMatB = glowMat(COL_B, 1.2, 0.22);
    const hlMatC = glowMat(COL_C, 1.6, 0.35);
    const rowHL = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.85), hlMatA);
    const colHL = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.05), hlMatB);
    const cellHL = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.85), hlMatC);
    rowHL.position.z = colHL.position.z = cellHL.position.z = -0.04;
    mA.g.add(rowHL); mB.g.add(colHL); mC.g.add(cellHL);
    rowHL.scale.set(0.001, 0.001, 1); colHL.scale.set(0.001, 0.001, 1); cellHL.scale.set(0.001, 0.001, 1);

    // intro
    [mA, mB, mC].forEach((m, i) => {
      m.g.scale.setScalar(0.01);
      extra.push(m.g.scale);
      to(m.g.scale, { x: 1, y: 1, z: 1, duration: 0.6, delay: i * 0.1, ease: 'back.out(1.8)' });
    });

    // question label
    const qY = Math.min(3.1, H / 2 - 0.75);
    const q = textSprite('C[0][0] = ?', {
      worldH: 0.9 * Math.min(1, K * 1.3), width: 768, height: 128, font: '700 66px "JetBrains Mono"', color: '#ffffff',
      bg: 'rgba(8,16,38,0.7)', border: '#22e4ff', radius: 30,
    });
    q.sprite.position.set(0, qY, 0.2);
    scene.add(q.sprite);

    // ---- orbs ----
    let orbs = [];
    const orbSpacing = Math.min(2.5, (v.w * 0.92) / 4);
    const orbScale = Math.min(1, orbSpacing / 2.2);
    const orbY = -Math.min(2.95, H / 2 - 1.2);
    const orbGeo = new THREE.IcosahedronGeometry(0.8, 1);
    const coreGeo = new THREE.IcosahedronGeometry(0.5, 1);

    function buildOptions(ans, r, c) {
      const p0 = A[r][0] * B[0][c], p1 = A[r][1] * B[1][c];
      const cand = shuffle([p0, p1, ans + 1, ans - 1, ans + 2, ans - 2, ans + 3, ans * 2, ans - 3]
        .filter((n) => n >= 0 && n !== ans && n <= 40));
      const out = [];
      for (const n of cand) { if (!out.includes(n)) out.push(n); if (out.length === 3) break; }
      let extraN = ans + 4;
      while (out.length < 3) { if (!out.includes(extraN)) out.push(extraN); extraN++; }
      return shuffle([ans, ...out]);
    }

    function clearOrbs() {
      orbs.forEach((o) => {
        gsap.killTweensOf([o.g.scale, o.g.position, o.coreMat.color, o.edgeMat.color, o.haloMat]);
        scene.remove(o.g);
        o.label.dispose();
        o.coreMat.dispose(); o.edgeMat.dispose(); o.haloMat.dispose(); o.shell.material.dispose();
      });
      orbs = [];
    }

    function spawnOrbs(values) {
      clearOrbs();
      values.forEach((val, i) => {
        const g = new THREE.Group();
        const x = (i - 1.5) * orbSpacing;
        const shell = new THREE.Mesh(orbGeo, bodyMat('#0a1530', 0.78));
        const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(ctx.accent).multiplyScalar(2), transparent: true, opacity: 1, toneMapped: false });
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(orbGeo), edgeMat);
        const coreMat = glowMat(ctx.accent, 1.0, 0.55);
        const core = new THREE.Mesh(coreGeo, coreMat);
        const halo = glowSprite(ctx.accent, 3.2, 0.5);
        const haloMat = halo.material;
        const label = textSprite(String(val), { worldH: 0.8, width: 192, height: 192, font: '700 110px "JetBrains Mono"', color: '#ffffff' });
        label.sprite.position.z = 0.9;
        g.add(shell, edges, core, halo, label.sprite);
        g.position.set(x, orbY - 3, 0);
        g.scale.setScalar(0.01);
        scene.add(g);
        const o = { g, shell, edges, core, coreMat, edgeMat, haloMat, halo, label, val, x, i, dead: false, hover: 0, hovered: false };
        shell.userData.orb = o;
        orbs.push(o);
        to(g.position, { y: orbY, duration: 0.7, delay: 0.25 + i * 0.09, ease: 'back.out(1.6)' });
        to(g.scale, { x: orbScale, y: orbScale, z: orbScale, duration: 0.6, delay: 0.25 + i * 0.09, ease: 'back.out(2)' });
      });
    }

    // ---- round logic ----
    let round = 0;
    let busy = true;       // locked until orbs have arrived
    let finished = false;
    let hoverOrb = null;

    function startRound() {
      const [r, c] = rounds[round];
      const ans = C[r][c];
      q.setText(`C[${r}][${c}] = ?`);
      ctx.setHint(`Row ${r} of A \u00b7 column ${c} of B = C[${r}][${c}]`);
      // highlights
      rowHL.position.set(0, (0.5 - r) * CELL_H, -0.04);
      colHL.position.set((c - 0.5) * CELL_W, 0, -0.04);
      cellHL.position.set((c - 0.5) * CELL_W, (0.5 - r) * CELL_H, -0.04);
      [rowHL, colHL, cellHL].forEach((m) => { extra.push(m.scale); to(m.scale, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2)', delay: 0.1 }); });
      mC.cells[r][c].setText('?', '#22e4ff');
      extra.push(q.sprite.scale);
      const qs = q.sprite.scale.clone();
      q.sprite.scale.multiplyScalar(0.6);
      to(q.sprite.scale, { x: qs.x, y: qs.y, duration: 0.5, ease: 'back.out(2.5)' });
      audio.sfx.swap();
      spawnOrbs(buildOptions(ans, r, c));
      later(0.6, () => { busy = false; });
    }

    function cellWorld(m, r, c) { return m.cells[r][c].sprite.getWorldPosition(new THREE.Vector3()); }

    function dataFlow(r, c, onDone) {
      const target = cellWorld(mC, r, c);
      const tcell = mC.cells[r][c];
      const sGeo = new THREE.SphereGeometry(0.13 * K + 0.04, 12, 10);
      for (let k = 0; k < 2; k++) {
        const delay = k * 0.5;
        [[mA, r, k, COL_A], [mB, k, c, COL_B]].forEach(([m, rr, cc, col], idx) => {
          const mat = glowMat(col, 3.2);
          const s = new THREE.Mesh(sGeo, mat);
          const halo = glowSprite(col, 0.9, 0.9);
          s.add(halo);
          const from = cellWorld(m, rr, cc);
          s.position.copy(from);
          s.visible = false;
          scene.add(s);
          const cellSprite = m.cells[rr][cc].sprite;
          const done = () => {
            gsap.killTweensOf(s.position);
            scene.remove(s); mat.dispose(); halo.material.dispose();
          };
          to(s.position, {
            x: target.x, y: target.y, z: target.z + 0.2, duration: 0.5, delay, ease: 'power2.inOut',
            onStart: () => {
              s.visible = true;
              audio.sfx.tick();
              to(cellSprite.scale, { x: cellSprite.scale.x * 1.5, y: cellSprite.scale.y * 1.5, duration: 0.15, yoyo: true, repeat: 1 });
              fx.burst(from, col, 8, 1.8, 0.11, 0.5, 0);
            },
            onUpdate: () => fx.burst(s.position, col, 1, 0.5, 0.1, 0.4, 0),
            onComplete: () => {
              done();
              if (idx !== 1) return;
              // both operands arrived: multiply-add step
              const prod = A[r][k] * B[k][c];
              if (k === 0) {
                tcell.setText(String(prod), '#bfffe0');
                fx.ring(target, COL_C, 1.1, 0.4);
                fx.burst(target, COL_C, 12, 2.2, 0.12, 0.5, 0);
                audio.sfx.key();
              } else {
                tcell.setText(String(C[r][c]), '#7dffb0');
                audio.sfx.coin();
                fx.ring(target, COL_C, 3, 0.7);
                fx.burst(target, COL_C, 44, 4.5, 0.17, 0.9, 1);
                fx.pop(target.clone().add(new THREE.Vector3(0, 0.8, 0)), `C[${r}][${c}] = ${C[r][c]}`, '#7dffb0');
                extra.push(tcell.sprite.scale);
                const bs = tcell.sprite.scale.clone();
                tcell.sprite.scale.multiplyScalar(0.5);
                to(tcell.sprite.scale, { x: bs.x, y: bs.y, duration: 0.5, ease: 'elastic.out(1.2, 0.5)' });
                to(hlMatC.color, { r: 0.3, g: 0.3, b: 0.3, duration: 0.3 });
                sGeo.dispose();
                onDone();
              }
            },
          });
        });
      }
    }

    function correct(orb) {
      busy = true;
      const [r, c] = rounds[round];
      audio.sfx.pick();
      // orb celebrates, others dim away
      orbs.forEach((o) => {
        if (o === orb) {
          to(o.g.scale, { x: orbScale * 1.4, y: orbScale * 1.4, z: orbScale * 1.4, duration: 0.3, ease: 'back.out(3)' });
          to(o.g.position, { y: orbY + 0.6, duration: 0.4, ease: 'power2.out' });
          to(o.coreMat.color, { r: 0.4, g: 3, b: 1.5, duration: 0.25 });
        } else {
          to(o.g.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.35, ease: 'power2.in' });
        }
      });
      fx.ring(orb.g.position.clone(), COL_C, 2.2, 0.5);
      fx.burst(orb.g.position.clone(), COL_C, 24, 3.5, 0.15, 0.7, 1);
      dataFlow(r, c, () => {
        round++;
        if (round >= rounds.length) {
          finished = true;
          ctx.setHint('Tensor mastered!');
          const mid = new THREE.Vector3(0, 0.55, 0.5);
          fx.ring(mid, COL_C, 7, 1);
          fx.burst(mid, COL_C, 70, 6, 0.2, 1.2, 0.8);
          [mA, mB, mC].forEach((m, i) => {
            const p = m.g.getWorldPosition(new THREE.Vector3());
            fx.ring(p, m.color, 3.6, 0.8);
            later(i * 0.08, () => fx.burst(p, m.color, 26, 4, 0.15, 0.9, 0.5));
          });
          audio.sfx.win();
          later(0.65, () => ctx.win());
        } else {
          later(0.5, () => { clearOrbsAnim(); later(0.3, startRound); });
        }
      });
    }

    function clearOrbsAnim() {
      orbs.forEach((o) => to(o.g.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.25, ease: 'power2.in' }));
      to(hlMatA.color, { r: 0.2, g: 0.2, b: 0.2, duration: 0.2 });
    }

    function wrong(orb) {
      audio.sfx.error();
      fx.shake(0.3, 0.35);
      fx.flash('#ff4060', 0.18);
      fx.burst(orb.g.position.clone(), RED, 22, 3.2, 0.14, 0.6, 1.5);
      orb.dead = true;
      to(orb.coreMat.color, { r: 0.9, g: 0.12, b: 0.2, duration: 0.2 });
      to(orb.edgeMat.color, { r: 1.6, g: 0.25, b: 0.35, duration: 0.2 });
      to(orb.haloMat, { opacity: 0.12, duration: 0.3 });
      orb.label.setText(String(orb.val), '#ff8090');
      to(orb.g.scale, { x: orbScale * 0.82, y: orbScale * 0.82, z: orbScale * 0.82, duration: 0.3, ease: 'back.out(3)' });
      // jitter
      to(orb.g.position, { x: orb.x + 0.18, duration: 0.05, yoyo: true, repeat: 5, ease: 'none', onComplete: () => { orb.g.position.x = orb.x; } });
      ctx.penalty(1);
      fx.pop(orb.g.position.clone().add(new THREE.Vector3(0, 1.3, 0)), '-1s', '#ff4060');
    }

    startRound();

    const tmpHover = new THREE.Vector3();
    return {
      update(dt, t) {
        // float + hover
        orbs.forEach((o, i) => {
          const hv = o.hovered && !o.dead ? 1 : 0;
          o.hover += (hv - o.hover) * Math.min(1, dt * 12);
          if (o.g.scale.x > 0.05) {
            o.shell.rotation.y += dt * 0.5; o.shell.rotation.x += dt * 0.3;
            o.core.rotation.y -= dt * 0.9; o.core.rotation.z += dt * 0.6;
          }
          o.edges.rotation.copy(o.shell.rotation);
          o.halo.scale.setScalar(3.2 + o.hover * 1.0 + Math.sin(t * 2 + i) * 0.12);
          if (!o.dead && !busy) o.g.position.y = orbY + Math.sin(t * 1.6 + i * 1.3) * 0.12 + o.hover * 0.12;
          if (!o.dead && !finished && o.g.scale.x > 0.5) o.coreMat.opacity = 0.5 + o.hover * 0.4;
        });
        mA.g.position.y = Math.sin(t * 1.3) * 0.05;
        mB.g.position.y = Math.sin(t * 1.3 + 1) * 0.05;
        mC.g.position.y = Math.sin(t * 1.3 + 2) * 0.05;
        const pulse = 0.28 + (Math.sin(t * 5) + 1) * 0.12;
        if (!finished) hlMatC.opacity = pulse;
        grid.material.opacity = 0.08 + Math.sin(t * 0.8) * 0.02;

        if (finished) return;
        const hit = busy ? null : pick(orbs.filter((o) => !o.dead).map((o) => o.shell));
        const ho = hit ? hit.object.userData.orb : null;
        if (ho !== hoverOrb) {
          if (hoverOrb) hoverOrb.hovered = false;
          hoverOrb = ho;
          if (ho) { ho.hovered = true; audio.sfx.hover(); }
        }
        if (input.pressed && ho && !busy) {
          if (ho.val === C[rounds[round][0]][rounds[round][1]]) correct(ho);
          else wrong(ho);
        }
        tmpHover.set(0, 0, 0);
      },
      dispose() {
        tweens.forEach((tw) => tw.kill());
        gsap.killTweensOf([...extra, hlMatC.color, hlMatA.color, q.sprite.scale]);
        orbs.forEach((o) => gsap.killTweensOf([o.g.scale, o.g.position, o.coreMat.color, o.edgeMat.color, o.haloMat]));
        orbGeo.dispose(); coreGeo.dispose(); gridGeo.dispose();
      },
    };
  },
};
