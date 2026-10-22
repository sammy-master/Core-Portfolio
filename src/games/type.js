import * as THREE from 'three';
import { glowMat, glowSprite, bodyMat, textSprite } from '../engine/helpers.js';

/**
 * Mission 1: "Hello, World". Type the C snippet `printf("hi");` exactly.
 * Per-character glass tiles float over a terminal panel; correct keys light up,
 * wrong keys flash red (no progress lost). Finishes with a short "compile" flourish.
 */

const SNIPPET = 'printf("hi");';

function rrShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function outline(shape, color, intensity = 1.8, opacity = 1) {
  const geo = new THREE.BufferGeometry().setFromPoints(shape.getPoints(10));
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity, toneMapped: false,
  }));
}

// Normalise fancy mobile-keyboard quotes so autocorrect does not block progress.
const norm = (ch) => (ch === '\u201C' || ch === '\u201D' ? '"' : ch === '\u2018' || ch === '\u2019' ? "'" : ch);

export default {
  create(ctx) {
    const { scene, fx, audio, input, gsap } = ctx;
    const accent = new THREE.Color(ctx.accent);
    const RED = new THREE.Color('#ff3b5c');
    const N = SNIPPET.length;
    const v = ctx.view();

    const tweens = [];
    const track = (tw) => { tweens.push(tw); return tw; };
    const texts = [];
    let alive = true;

    ctx.showKeyboard();

    // ---------------------------------------------------------------- layout
    const panelW = Math.min(14.4, v.w * 0.96);
    const panelH = Math.min(4.6, v.h * 0.62);
    const tw = Math.min(0.95, (panelW - 0.9) / N);
    const th = tw * 1.32;

    const root = new THREE.Group();
    root.position.z = -0.2;
    scene.add(root);

    // ------------------------------------------------------------- terminal panel
    const panelShape = rrShape(panelW, panelH, 0.28);
    const panelBody = new THREE.Mesh(new THREE.ShapeGeometry(panelShape, 12), bodyMat('#050a1a', 0.9));
    panelBody.position.z = -0.4;
    const panelEdge = outline(panelShape, accent, 0.9, 0.85);
    panelEdge.position.z = -0.38;
    const panelHalo = glowSprite(accent, Math.max(panelW, panelH) * 1.25, 0.14);
    panelHalo.scale.set(panelW * 1.3, panelH * 1.9, 1);
    panelHalo.position.z = -0.6;
    root.add(panelHalo, panelBody, panelEdge);

    // title bar: strip + three window dots + title
    const barH = 0.5;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.1, barH), glowMat(accent, 0.28, 0.35));
    bar.position.set(0, panelH / 2 - barH / 2 - 0.05, -0.37);
    root.add(bar);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), glowMat(c, 1.5));
      dot.position.set(-panelW / 2 + 0.4 + i * 0.26, bar.position.y, -0.36);
      root.add(dot);
    });
    const title = textSprite('hello.c  -  terminal', { width: 512, height: 64, worldH: 0.3, font: '500 26px "JetBrains Mono", monospace', color: '#8fa5d6' });
    title.sprite.position.set(0, bar.position.y, -0.35);
    texts.push(title);
    root.add(title.sprite);

    // prompt line
    const prompt = textSprite('$ gcc hello.c -o hello && ./hello', { width: 768, height: 64, worldH: 0.32, font: '500 28px "JetBrains Mono", monospace', color: '#5f7bb5', align: 'left' });
    prompt.sprite.position.set(-panelW / 2 + 0.3 + prompt.sprite.scale.x / 2 - 0.1, panelH / 2 - 0.95, -0.35);
    texts.push(prompt);
    root.add(prompt.sprite);

    // sweeping scanline
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.2, 0.05), glowMat(accent, 0.9, 0.18));
    scan.position.z = -0.3;
    root.add(scan);

    // output line
    const outH = Math.min(0.7, panelW * 0.09);
    const out = textSprite('', { width: 768, height: 128, worldH: outH, font: '700 64px "JetBrains Mono", monospace', color: '#ffffff', align: 'left' });
    out.sprite.position.set(-panelW / 2 + 0.3 + out.sprite.scale.x / 2 - 0.1, -panelH * 0.33, -0.3);
    texts.push(out);
    root.add(out.sprite);

    // ------------------------------------------------------------------ tiles
    const tilesY = panelH * 0.06;
    const tileShape = rrShape(tw * 0.88, th, tw * 0.14);
    const tileGeo = new THREE.ShapeGeometry(tileShape, 8);
    const IDLE_EDGE = new THREE.Color('#3b5da8');
    const IDLE_BODY = new THREE.Color('#0a1330');
    const tiles = [];
    const x0 = -((N - 1) / 2) * tw;

    for (let i = 0; i < N; i++) {
      const ch = SNIPPET[i];
      const g = new THREE.Group();
      const body = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ color: IDLE_BODY.clone(), transparent: true, opacity: 0.92, depthWrite: false }));
      const edge = outline(tileShape, IDLE_EDGE, 1.0);
      const glyph = textSprite(ch, { width: 128, height: 128, worldH: tw * 1.1, font: '700 84px "JetBrains Mono", monospace', color: '#8ea3d4' });
      glyph.sprite.position.z = 0.12;
      texts.push(glyph);
      const halo = glowSprite(accent, tw * 2.4, 0);
      halo.position.z = -0.05;
      const base = new THREE.Mesh(new THREE.PlaneGeometry(tw * 0.62, 0.05), glowMat(accent, 0.6, 0.35));
      base.position.set(0, -th / 2 + 0.12, 0.05);
      g.add(halo, body, edge, glyph.sprite, base);
      g.position.set(x0 + i * tw, tilesY, 0);
      root.add(g);
      tiles.push({ g, body, edge, glyph, halo, base, ch, k: 0, err: 0, jump: 0, done: false, i });
    }

    // blinking cursor
    const cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.07, th * 0.9), glowMat('#ffffff', 2.4));
    cursor.position.set(x0 - tw / 2, tilesY, 0.2);
    root.add(cursor);
    const cursorHalo = glowSprite(accent, 1.2, 0.55);
    cursorHalo.position.copy(cursor.position);
    root.add(cursorHalo);

    // ---------------------------------------------------------------- state
    let next = 0;
    let finished = false;
    let hintSet = false;
    let progressGlow = 0;
    const tmp = new THREE.Color();
    const hot = new THREE.Color();
    const worldPos = (t, dy = 0) => t.g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, dy, 0.3));

    // entrance
    tiles.forEach((t, i) => {
      t.g.scale.setScalar(0.001);
      track(gsap.to(t.g.scale, { x: 1, y: 1, z: 1, duration: 0.5, delay: 0.05 + i * 0.035, ease: 'back.out(2.2)' }));
    });
    root.scale.setScalar(0.92);
    track(gsap.to(root.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power3.out' }));

    function correct(t) {
      t.done = true;
      next++;
      audio.sfx.key();
      track(gsap.to(t, { k: 1, duration: 0.22, ease: 'power2.out' }));
      t.halo.material.opacity = 0;
      track(gsap.to(t.halo.material, { opacity: 0.85, duration: 0.15, yoyo: true, repeat: 1 }));
      track(gsap.fromTo(t.g.scale, { x: 1.35, y: 1.35 }, { x: 1, y: 1, duration: 0.4, ease: 'elastic.out(1.1,0.5)', overwrite: 'auto' }));
      t.glyph.setText(t.ch, '#ffffff');
      const p = worldPos(t);
      fx.burst(p, accent, 14, 3.2, 0.15, 0.7, 1.2);
      if (next % 4 === 0) fx.ring(p, accent, 1.6, 0.5);
      progressGlow = next / N;
    }

    function wrong(t) {
      t.err = 1;
      audio.sfx.error();
      fx.shake(0.14, 0.25);
      fx.burst(worldPos(t), RED, 8, 2.4, 0.12, 0.45, 0);
    }

    function compile() {
      finished = true;
      cursor.visible = false;
      cursorHalo.visible = false;
      tiles.forEach((t, i) => {
        track(gsap.to(t, { jump: 0.35, duration: 0.18, yoyo: true, repeat: 1, delay: i * 0.035, ease: 'power2.out' }));
      });
      fx.ring(new THREE.Vector3(0, tilesY, 0.3), accent, 6, 0.8);
      fx.flash('#ffffff', 0.12);
      audio.sfx.whoosh();
      out.setText('> compiling...', '#7f9ad8');
      track(gsap.delayedCall(0.38, () => {
        if (!alive) return;
        out.setText('> hi', '#7dffb0');
        audio.sfx.win();
        const p = new THREE.Vector3(-panelW / 2 + 1.2, -panelH * 0.33, 0.3);
        fx.burst(p, '#7dffb0', 30, 4, 0.18, 0.9, 1);
        fx.ring(p, '#7dffb0', 2.4, 0.6);
        out.sprite.scale.multiplyScalar(0.8);
        track(gsap.to(out.sprite.scale, { x: out.sprite.scale.x / 0.8, y: out.sprite.scale.y / 0.8, duration: 0.4, ease: 'back.out(3)' }));
        track(gsap.delayedCall(0.4, () => { if (alive && ctx.timeLeft() > 0) ctx.win(); }));
      }));
    }

    return {
      update(dt, t) {
        // tap-to-focus on touch devices
        if (input.touch && !hintSet) {
          hintSet = true;
          ctx.setHint('Tap the screen to open the keyboard, then type the code');
        }
        if (input.pressed && !finished) ctx.showKeyboard();

        if (!finished) {
          for (const raw of input.typed) {
            if (finished) break;
            const ch = norm(raw);
            const tile = tiles[next];
            if (!tile) break;
            if (ch === tile.ch) {
              correct(tile);
              if (next >= N) { compile(); break; }
            } else if (raw.length === 1) {
              wrong(tile);
            }
          }
        }

        // gentle pointer tilt
        root.rotation.y += ((input.ndc.x * 0.12) - root.rotation.y) * Math.min(1, dt * 4);
        root.rotation.x += ((-input.ndc.y * 0.07) - root.rotation.x) * Math.min(1, dt * 4);

        // panel / scanline
        const pg = 0.9 + progressGlow * 1.6;
        panelEdge.material.color.set(accent).multiplyScalar(pg);
        scan.position.y = ((t * 0.35) % 1) * panelH - panelH / 2;
        scan.visible = Math.abs(scan.position.y) < panelH / 2 - 0.05;

        // tiles
        for (const tl of tiles) {
          tl.err = Math.max(0, tl.err - dt * 3.2);
          const isNext = !finished && tl.i === next;
          const bob = Math.sin(t * 1.7 + tl.i * 0.55) * (isNext ? 0.09 : 0.045);
          tl.g.position.y = tilesY + bob + tl.jump + (isNext ? 0.06 : 0);
          tl.g.position.z = isNext ? 0.2 : 0;
          tl.g.position.x = x0 + tl.i * tw + Math.sin(t * 90 + tl.i) * 0.06 * tl.err * tl.err;
          tl.g.rotation.z = Math.sin(t * 1.3 + tl.i) * 0.015 + Math.sin(t * 70) * 0.05 * tl.err;

          hot.set(accent).multiplyScalar(2.3);
          tl.edge.material.color.copy(IDLE_EDGE).lerp(hot, tl.k);
          if (isNext) tl.edge.material.color.lerp(hot, 0.35 + 0.25 * Math.sin(t * 6));
          tl.edge.material.color.lerp(tmp.set(RED).multiplyScalar(2.6), tl.err);

          tl.body.material.color.copy(IDLE_BODY).lerp(tmp.set(accent).multiplyScalar(0.3), tl.k);
          tl.body.material.color.lerp(tmp.set(RED).multiplyScalar(0.55), tl.err);
          tl.base.material.opacity = 0.25 + tl.k * 0.75;
        }

        // cursor
        if (!finished) {
          const target = tiles[Math.min(next, N - 1)];
          cursor.position.x = x0 + next * tw - tw / 2 + 0.02;
          cursor.position.y = tilesY + (target ? target.g.position.y - tilesY : 0);
          cursor.visible = (t % 1) < 0.62;
          cursorHalo.position.copy(cursor.position);
          cursorHalo.visible = cursor.visible;
        }
      },
      dispose() {
        alive = false;
        tweens.forEach((tw2) => tw2 && tw2.kill && tw2.kill());
        tiles.forEach((tl) => {
          gsap.killTweensOf(tl);
          gsap.killTweensOf(tl.g.scale);
          gsap.killTweensOf(tl.halo.material);
        });
        gsap.killTweensOf(root.scale);
        gsap.killTweensOf(out.sprite.scale);
        texts.forEach((x) => x.dispose());
      },
    };
  },
};
