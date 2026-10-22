import * as THREE from 'three';
import { glowMat, glowSprite, bodyMat, textSprite, shuffle, rand } from '../engine/helpers.js';

/**
 * Mission 4: "Spot the Phish". Two rounds of four holographic browser cards;
 * click the fake link. Wrong click = lose (after a glitch + reveal).
 */

const PHISH = [
  'paypa1-login.verify-now.xyz', 'g00gle-security.top/alert', 'amaz0n.account-update.ru',
  'github.com.login-auth.cc', 'micr0soft-support.info/win', 'netfl1x-billing.update-pay.top',
  'app1e-id.locked-account.xyz',
];
const LEGIT = [
  'github.com/login', 'accounts.google.com', 'vercel.com/dashboard', 'linkedin.com/feed',
  'mail.google.com', 'stackoverflow.com/questions', 'en.wikipedia.org/wiki', 'docs.python.org/3',
];

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

function outline(shape, color, intensity = 1.6, opacity = 1) {
  const geo = new THREE.BufferGeometry().setFromPoints(shape.getPoints(10));
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity, toneMapped: false,
  }));
}

export default {
  create(ctx) {
    const { scene, fx, audio, input, pick, gsap } = ctx;
    const v = ctx.view();
    const accent = new THREE.Color(ctx.accent);
    const RED = new THREE.Color('#ff3b5c');
    const GREEN = new THREE.Color('#3dffb5');
    const BASE_EDGE = new THREE.Color('#5ab0ff').multiplyScalar(1.15);
    const HOVER_EDGE = new THREE.Color('#bfe2ff').multiplyScalar(2.2);

    const tweens = [];
    const track = (tw) => { tweens.push(tw); return tw; };
    const texts = [];
    let alive = true;

    // ------------------------------------------------------------ layout
    const cols = v.w >= 9 ? 4 : 2;
    let cw, ch;
    if (cols === 4) {
      cw = Math.min(3.3, (v.w * 0.95) / 4 - 0.18);
      ch = cw * 0.74;
    } else {
      cw = Math.min(4.2, v.w * 0.46);
      ch = cw * 0.74;
      const maxH = v.h * 0.72;
      if (ch * 2 + 0.45 > maxH) { ch = (maxH - 0.45) / 2; cw = ch / 0.74; }
    }
    const gapX = cols === 4 ? 0.18 : 0.22;
    const stepX = cw + gapX;
    const stepY = ch + 0.3;
    const rows = cols === 4 ? 1 : 2;
    const gridH = rows === 1 ? ch : ch * 2 + 0.3;

    // shared geometry (disposed by us)
    const cardShape = rrShape(cw, ch, 0.17);
    const cardGeo = new THREE.ShapeGeometry(cardShape, 10);
    const pillW = cw * 0.92, pillH = Math.min(0.5, ch * 0.2);
    const pillShape = rrShape(pillW, pillH, pillH * 0.4);
    const pillGeo = new THREE.ShapeGeometry(pillShape, 6);
    const btnShape = rrShape(cw * 0.42, ch * 0.13, ch * 0.05);
    const btnGeo = new THREE.ShapeGeometry(btnShape, 6);
    const dotGeo = new THREE.CircleGeometry(0.045, 14);
    const logoGeo = new THREE.CircleGeometry(ch * 0.09, 20);
    const lineGeo = new THREE.PlaneGeometry(1, ch * 0.035);
    const lockBodyGeo = new THREE.BoxGeometry(0.2, 0.15, 0.05);
    const lockArcGeo = new THREE.TorusGeometry(0.058, 0.015, 8, 18, Math.PI);
    const shardGeo = new THREE.PlaneGeometry(1, 1);
    const shared = new Set([cardGeo, pillGeo, btnGeo, dotGeo, logoGeo, lineGeo, lockBodyGeo, lockArcGeo, shardGeo]);
    const shardMats = [glowMat('#5ab0ff', 2.2), glowMat('#bfe2ff', 2.6), glowMat(ctx.accent, 2.2)];

    const arcRoot = new THREE.Group();
    scene.add(arcRoot);
    const header = textSprite('', { width: 1024, height: 96, worldH: 0.5, font: '600 38px "JetBrains Mono", monospace', color: '#cfe4ff' });
    texts.push(header);
    const hdrW = header.sprite.scale.x;
    if (hdrW > v.w * 0.95) header.sprite.scale.multiplyScalar((v.w * 0.95) / hdrW);
    header.sprite.position.set(0, Math.min(v.h / 2 - 0.5, gridH / 2 + 0.95), 0);
    scene.add(header.sprite);

    // ------------------------------------------------------------ state
    let cards = [];
    let round = 0;
    let busy = true;
    let done = false;
    let hovered = null;
    const shards = [];
    const usedPhish = [];
    const usedLegit = [];
    const phishDeck = shuffle([...PHISH]);
    const legitDeck = shuffle([...LEGIT]);

    const disposeObj = (o) => {
      o.traverse((c) => {
        if (c.geometry && !shared.has(c.geometry)) c.geometry.dispose();
        if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose());
      });
    };

    // ------------------------------------------------------------ card building
    function buildCard(url, isPhish) {
      const g = new THREE.Group();     // positioned by gsap
      const inner = new THREE.Group(); // float / hover / glitch
      g.add(inner);

      const body = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color('#071225'), transparent: true, opacity: 0.86, depthWrite: false, side: THREE.DoubleSide,
      }));
      const edge = outline(cardShape, '#5ab0ff', 1.15);
      edge.position.z = 0.01;
      const halo = glowSprite('#5ab0ff', cw * 1.9, 0.12);
      halo.scale.set(cw * 1.8, ch * 2.0, 1);
      halo.position.z = -0.12;
      inner.add(halo, body, edge);

      // browser top bar
      const barY = ch / 2 - 0.2;
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.12, 0.2), glowMat('#5ab0ff', 0.22, 0.35));
      bar.position.set(0, barY, 0.012);
      inner.add(bar);
      ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
        const d = new THREE.Mesh(dotGeo, glowMat(c, 1.4));
        d.position.set(-cw / 2 + 0.24 + i * 0.13, barY, 0.02);
        inner.add(d);
      });

      // address pill + lock + URL
      const pillY = barY - 0.2 - pillH / 2 - 0.08;
      const pill = new THREE.Mesh(pillGeo, bodyMat('#02060f', 0.9));
      pill.position.set(0, pillY, 0.02);
      const pillEdge = outline(pillShape, '#3a6fb8', 0.9, 0.8);
      pillEdge.position.set(0, pillY, 0.03);
      inner.add(pill, pillEdge);

      const lock = new THREE.Group();
      const lb = new THREE.Mesh(lockBodyGeo, glowMat(GREEN, 1.6));
      const la = new THREE.Mesh(lockArcGeo, glowMat(GREEN, 1.6));
      la.position.y = 0.07;
      lock.add(lb, la);
      const ls = pillH / 0.5;
      lock.scale.setScalar(Math.max(0.7, ls * 1.1));
      lock.position.set(-pillW / 2 + 0.28, pillY - 0.02, 0.06);
      inner.add(lock);

      const urlW = pillW - 0.62;
      const px = 640;
      const fontPx = Math.min(46, Math.floor((px - 40) / (url.length * 0.6)));
      const urlTxt = textSprite(url, {
        width: px, height: 80, worldH: urlW / 8, font: `600 ${fontPx}px "JetBrains Mono", monospace`,
        color: '#e6f1ff', align: 'left',
      });
      urlTxt.sprite.position.set(-pillW / 2 + 0.5 + urlW / 2 - 0.04, pillY, 0.07);
      texts.push(urlTxt);
      inner.add(urlTxt.sprite);

      // faux page content
      const pageTop = pillY - pillH / 2 - 0.25;
      const logo = new THREE.Mesh(logoGeo, glowMat('#5ab0ff', 0.9, 0.7));
      logo.position.set(-cw * 0.28, pageTop - ch * 0.07, 0.03);
      inner.add(logo);
      [[0.5, 0.0], [0.62, 0.1], [0.42, 0.2]].forEach(([wf, dy], i) => {
        const l = new THREE.Mesh(lineGeo, glowMat('#6aa5e8', 0.45, 0.5));
        l.scale.x = cw * wf * 0.62;
        l.position.set(-cw * 0.1 + (cw * wf * 0.62) / 2 - cw * 0.12, pageTop - ch * 0.03 - dy * ch * 0.5 + 0.02 * i, 0.03);
        inner.add(l);
      });
      const btn = new THREE.Mesh(btnGeo, glowMat(isPhish ? '#8fb6ff' : '#8fb6ff', 0.55, 0.55));
      btn.position.set(0, -ch / 2 + ch * 0.17, 0.03);
      inner.add(btn);

      const c = {
        g, inner, body, edge, halo, url, isPhish, urlTxt,
        hover: 0, red: 0, glitch: 0, ph: Math.random() * 6.28, label: null, dead: false,
        home: new THREE.Vector3(), homeRot: new THREE.Euler(),
      };
      body.userData.card = c;
      return c;
    }

    function startRound() {
      round++;
      busy = true;
      hovered = null;
      const phishUrl = phishDeck[usedPhish.length % phishDeck.length];
      usedPhish.push(phishUrl);
      const legitUrls = [];
      for (let i = 0; i < 3; i++) legitUrls.push(legitDeck[(usedLegit.length++) % legitDeck.length]);
      const list = shuffle([
        { url: phishUrl, p: true },
        ...legitUrls.map((u) => ({ url: u, p: false })),
      ]);

      header.setText(`ROUND ${round}/2  -  FIND THE FAKE LINK`, '#cfe4ff');

      cards = list.map((it, i) => {
        const c = buildCard(it.url, it.p);
        const col = i % cols, row = Math.floor(i / cols);
        const x = (col - (cols - 1) / 2) * stepX;
        let y = rows === 1 ? -0.1 - x * x * 0.012 : ((rows - 1) / 2 - row) * stepY - 0.1;
        const z = rows === 1 ? -Math.abs(x) * 0.16 : 0;
        c.home.set(x, y, z);
        c.homeRot.set(0, rows === 1 ? -x * 0.045 : 0, 0);
        arcRoot.add(c.g);

        // fly-in from alternating sides
        const side = (i % 2 === 0 ? -1 : 1);
        c.g.position.set(x + side * rand(5, 9), y + rand(-4, 4), z + 5);
        c.g.rotation.set(rand(-0.6, 0.6), rand(-1, 1), side * rand(0.4, 1.0));
        c.g.scale.setScalar(0.35);
        const d = 0.04 + i * 0.09;
        track(gsap.to(c.g.position, { x, y, z, duration: 0.75, delay: d, ease: 'back.out(1.25)' }));
        track(gsap.to(c.g.rotation, { x: 0, y: c.homeRot.y, z: 0, duration: 0.75, delay: d, ease: 'power3.out' }));
        track(gsap.to(c.g.scale, { x: 1, y: 1, z: 1, duration: 0.7, delay: d, ease: 'back.out(1.6)' }));
        track(gsap.delayedCall(d + 0.1, () => alive && audio.sfx.whoosh()));
        return c;
      });
      track(gsap.delayedCall(0.62, () => { if (alive) busy = false; }));
    }

    // ------------------------------------------------------------ effects
    function shatter(c) {
      const wp = c.g.getWorldPosition(new THREE.Vector3());
      c.g.visible = false;
      const n = 26;
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(shardGeo, shardMats[i % shardMats.length]);
        const sx = rand(0.12, 0.5), sy = rand(0.08, 0.35);
        m.position.set(wp.x + rand(-cw / 2, cw / 2), wp.y + rand(-ch / 2, ch / 2), wp.z + rand(0, 0.2));
        m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 6));
        const dir = new THREE.Vector3(m.position.x - wp.x, m.position.y - wp.y, 0).normalize().multiplyScalar(rand(2, 5));
        scene.add(m);
        shards.push({
          m, sx, sy, vx: dir.x + rand(-1, 1), vy: dir.y + rand(0, 2.5), vz: rand(0.5, 4),
          rx: rand(-9, 9), ry: rand(-9, 9), rz: rand(-9, 9), life: rand(0.7, 1.3), max: 1.3,
        });
        m.scale.set(sx, sy, 1);
      }
      fx.burst(wp, '#5ab0ff', 36, 5, 0.2, 1.0, 2);
      fx.burst(wp, GREEN, 20, 3.5, 0.16, 0.9, 1);
      fx.ring(wp, '#5ab0ff', 3.4, 0.7);
      fx.ring(wp, GREEN, 2.2, 0.55);
    }

    function removeCards(list) {
      list.forEach((c) => {
        gsap.killTweensOf(c.g.position); gsap.killTweensOf(c.g.rotation); gsap.killTweensOf(c.g.scale);
        arcRoot.remove(c.g);
        disposeObj(c.g);
        c.dead = true;
      });
    }

    function onCorrect(c) {
      busy = true;
      audio.sfx.hit();
      audio.sfx.coin();
      const wp = c.g.getWorldPosition(new THREE.Vector3());
      shatter(c);
      fx.shake(0.2, 0.3);
      fx.flash('#3dffb5', 0.16);
      fx.pop(wp.clone().add(new THREE.Vector3(0, 0.6, 0.5)), 'THREAT NEUTRALISED', '#3dffb5');
      header.setText('THREAT NEUTRALISED', '#3dffb5');

      const others = cards.filter((o) => o !== c);
      others.forEach((o, i) => {
        track(gsap.to(o.g.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.35, delay: 0.15 + i * 0.06, ease: 'back.in(2)' }));
        track(gsap.to(o.g.position, { y: o.g.position.y - 1.2, duration: 0.35, delay: 0.15 + i * 0.06, ease: 'power2.in' }));
      });
      const old = cards;
      if (round < 2) {
        track(gsap.delayedCall(1.0, () => {
          if (!alive) return;
          removeCards(old);
          startRound();
        }));
      } else {
        track(gsap.delayedCall(0.75, () => {
          if (!alive || done) return;
          done = true;
          removeCards(old);
          fx.ring(new THREE.Vector3(0, 0, 0.5), GREEN, 7, 0.9);
          audio.sfx.win();
          if (ctx.timeLeft() > 0) ctx.win();
        }));
      }
    }

    function onWrong(c) {
      busy = true;
      audio.sfx.error();
      fx.shake(0.45, 0.5);
      fx.flash('#ff3b5c', 0.3);
      const wp = c.g.getWorldPosition(new THREE.Vector3());
      fx.burst(wp, RED, 22, 4, 0.16, 0.7, 0);
      c.glitch = 1;
      track(gsap.to(c, { red: 1, duration: 0.12 }));
      track(gsap.fromTo(c.g.position, { x: c.home.x - 0.18 }, { x: c.home.x, duration: 0.5, ease: 'elastic.out(1.4,0.2)' }));
      header.setText('THAT ONE WAS REAL...', '#ff3b5c');

      // reveal the real phish
      const real = cards.find((o) => o.isPhish);
      track(gsap.delayedCall(0.4, () => {
        if (!alive || !real) return;
        audio.sfx.tick();
        track(gsap.to(real, { red: 1, duration: 0.2 }));
        real.halo.material.color.copy(RED).multiplyScalar(1.4);
        track(gsap.to(real.halo.material, { opacity: 0.7, duration: 0.25 }));
        const label = textSprite('PHISHING', {
          width: 384, height: 80, worldH: 0.34, font: '700 40px "JetBrains Mono", monospace',
          color: '#ffffff', bg: 'rgba(255,59,92,.85)', border: '#ff9aab', radius: 18,
        });
        texts.push(label);
        label.sprite.position.set(0, ch / 2 + 0.3, 0.3);
        label.sprite.scale.multiplyScalar(0.01);
        real.inner.add(label.sprite);
        real.label = label;
        track(gsap.to(label.sprite.scale, { x: (384 / 80) * 0.34, y: 0.34, duration: 0.35, ease: 'back.out(3)' }));
        const rp = real.g.getWorldPosition(new THREE.Vector3());
        fx.ring(rp, RED, 3, 0.7);
      }));
      track(gsap.delayedCall(1.15, () => {
        if (!alive || done) return;
        done = true;
        if (ctx.timeLeft() > 0) ctx.lose();
      }));
    }

    startRound();

    // ------------------------------------------------------------ loop
    const tmpC = new THREE.Color();
    return {
      update(dt, t) {
        // pointer tilt of the whole arc
        const k = Math.min(1, dt * 3.5);
        arcRoot.rotation.y += (input.ndc.x * 0.2 - arcRoot.rotation.y) * k;
        arcRoot.rotation.x += (-input.ndc.y * 0.12 - arcRoot.rotation.x) * k;

        // hover + click
        let hit = null;
        if (!busy && !done) {
          const live = cards.filter((c) => !c.dead);
          const h = pick(live.map((c) => c.body));
          hit = h ? h.object.userData.card : null;
        }
        if (hit !== hovered) {
          hovered = hit;
          if (hit) audio.sfx.hover();
        }
        if (hit && input.pressed) {
          if (hit.isPhish) onCorrect(hit); else onWrong(hit);
        }

        // cards idle animation / colour
        for (const c of cards) {
          if (c.dead) continue;
          const tgtHover = c === hovered ? 1 : 0;
          c.hover += (tgtHover - c.hover) * Math.min(1, dt * 10);
          const s = 1 + c.hover * 0.07;
          c.inner.scale.set(s, s, 1);
          c.inner.position.y = Math.sin(t * 1.3 + c.ph) * 0.07;
          c.inner.position.z = c.hover * 0.45;
          c.inner.rotation.z = Math.sin(t * 0.9 + c.ph) * 0.012;
          c.inner.rotation.x = Math.cos(t * 0.8 + c.ph) * 0.02;
          c.inner.position.x = 0;

          if (c.glitch > 0) {
            c.glitch = Math.max(0, c.glitch - dt * 1.6);
            const gx = (Math.random() - 0.5) * 0.35 * c.glitch;
            c.inner.position.x = gx;
            c.urlTxt.sprite.position.x += (Math.random() - 0.5) * 0.08 * c.glitch;
            c.urlTxt.sprite.visible = Math.random() > 0.25 * c.glitch;
            c.inner.rotation.z += (Math.random() - 0.5) * 0.08 * c.glitch;
          } else if (!c.urlTxt.sprite.visible) {
            c.urlTxt.sprite.visible = true;
          }

          tmpC.copy(BASE_EDGE).lerp(HOVER_EDGE, c.hover).lerp(RED.clone().multiplyScalar(2.6), c.red);
          c.edge.material.color.copy(tmpC);
          c.body.material.color.set('#071225').lerp(RED.clone().multiplyScalar(0.35), c.red);
          c.halo.material.opacity = c.red > 0.5 ? Math.max(c.halo.material.opacity, 0.5) * (0.9 + 0.1 * Math.sin(t * 14)) : 0.12 + c.hover * 0.3;
        }

        // shards
        for (let i = shards.length - 1; i >= 0; i--) {
          const s = shards[i];
          s.life -= dt;
          if (s.life <= 0) {
            scene.remove(s.m);
            shards.splice(i, 1);
            continue;
          }
          s.vy -= 6 * dt;
          s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt;
          s.m.rotation.x += s.rx * dt; s.m.rotation.y += s.ry * dt; s.m.rotation.z += s.rz * dt;
          const f = Math.sqrt(Math.max(0, s.life / s.max));
          s.m.scale.set(s.sx * f, s.sy * f, 1);
        }
      },
      dispose() {
        alive = false;
        tweens.forEach((tw) => tw && tw.kill && tw.kill());
        cards.forEach((c) => {
          gsap.killTweensOf(c); gsap.killTweensOf(c.g.position); gsap.killTweensOf(c.g.rotation);
          gsap.killTweensOf(c.g.scale); gsap.killTweensOf(c.halo.material);
          if (c.label) gsap.killTweensOf(c.label.sprite.scale);
        });
        shards.length = 0;
        texts.forEach((x) => x.dispose());
        shared.forEach((g) => g.dispose());
        shardMats.forEach((m) => m.dispose());
      },
    };
  },
};
