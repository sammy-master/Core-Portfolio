import * as THREE from 'three';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite, rand } from '../engine/helpers.js';

/**
 * Tune the Vibe: hover the hue/lightness field to mix a colour, then click to
 * match the glowing TARGET orb (hue within 10 deg, lightness within 0.1).
 */
const HUE_TOL = 10;     // degrees
const L_TOL = 0.1;
const SAT = 0.8;
const L_MIN = 0.12, L_MAX = 0.88;

function hslToRgb(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

export default {
  create(ctx) {
    const { scene, fx, audio, input, gsap } = ctx;
    const v = ctx.view();
    const portrait = v.w < v.h * 0.95;

    const tweenTargets = [];
    const track = (o) => { tweenTargets.push(o); return o; };
    const disposables = [];
    const delayed = [];

    // ───────────── Layout ─────────────
    let fw, fh, fc, orbR, tPos, pPos, pR;
    if (portrait) {
      fw = Math.min(v.w - 0.8, 7.4);
      fh = Math.min(fw * 0.72, v.h * 0.36);
      fc = new THREE.Vector2(0, -v.h / 2 + fh / 2 + 1.7);
      const top = fc.y + fh / 2;
      const rowY = (top + v.h / 2) / 2 - 0.2;
      orbR = Math.max(0.6, Math.min(1.35, v.w * 0.2, (v.h / 2 - top) * 0.28));
      pR = orbR * 0.68;
      tPos = new THREE.Vector3(-v.w * 0.22, rowY, 0);
      pPos = new THREE.Vector3(v.w * 0.22, rowY, 0);
    } else {
      fw = Math.min(7.4, v.w * 0.55);
      fh = Math.min(5.0, v.h * 0.62);
      fc = new THREE.Vector2(Math.min(3.4, v.w / 2 - fw / 2 - 0.8), -0.3);
      const ox = (-v.w / 2 + (fc.x - fw / 2)) / 2;
      orbR = Math.min(1.5, v.h * 0.17, Math.max(0.8, (fc.x - fw / 2 + v.w / 2) * 0.25));
      pR = orbR * 0.62;
      tPos = new THREE.Vector3(ox, 1.0, 0);
      pPos = new THREE.Vector3(ox, 1.0 - orbR - pR - 1.05, 0);
    }
    const fx0 = fc.x - fw / 2, fy0 = fc.y - fh / 2;

    // ───────────── Target colour ─────────────
    const target = { h: Math.floor(rand(0, 360)), s: SAT, l: rand(0.35, 0.65) };
    const targetCol = new THREE.Color().setHSL(target.h / 360, target.s, target.l);

    // ───────────── Orb builder ─────────────
    const sphGeo = new THREE.SphereGeometry(1, 40, 28);
    const shellGeo = new THREE.IcosahedronGeometry(1, 1);
    const torusGeo = new THREE.TorusGeometry(1, 0.012, 6, 72);
    disposables.push(sphGeo, shellGeo, torusGeo);

    function makeOrb(r, pos, col) {
      const g = new THREE.Group();
      g.position.copy(pos);
      const core = new THREE.Mesh(sphGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.5), toneMapped: false }));
      core.scale.setScalar(r);
      const shell = edgeLines(shellGeo, '#ffffff', 1.4, 0.55);
      shell.scale.setScalar(r * 1.22);
      const halo = glowSprite(col, r * 5.2, 0.55);
      halo.position.z = -0.2;
      const t1 = new THREE.Mesh(torusGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.55 }));
      t1.scale.setScalar(r * 1.55);
      const t2 = t1.clone();
      t2.material = t1.material;
      t2.scale.setScalar(r * 1.75);
      g.add(halo, core, shell, t1, t2);
      scene.add(g);
      disposables.push(core.material, shell.material, halo.material, t1.material);
      track(g.scale); track(g.position);
      return { g, core, shell, halo, t1, t2, r, base: pos.clone() };
    }
    const setOrbCol = (o, c) => {
      o.core.material.color.copy(c).multiplyScalar(1.5);
      o.halo.material.color.copy(c).multiplyScalar(1.4);
      o.t1.material.color.copy(c).multiplyScalar(2);
    };

    const tOrb = makeOrb(orbR, tPos, targetCol);
    const pOrb = makeOrb(pR, pPos, new THREE.Color('#2a3350'));
    tOrb.g.scale.setScalar(0.001);
    pOrb.g.scale.setScalar(0.001);
    gsap.to(tOrb.g.scale, { x: 1, y: 1, z: 1, duration: 0.8, delay: 0.1, ease: 'elastic.out(1, 0.6)' });
    gsap.to(pOrb.g.scale, { x: 1, y: 1, z: 1, duration: 0.7, delay: 0.3, ease: 'back.out(2.2)' });
    pOrb.halo.material.opacity = 0.2;

    // labels
    const tLabel = textSprite('TARGET', {
      worldH: 0.34, width: 384, height: 96, font: '700 44px "Space Grotesk"', color: '#ffffff',
    });
    tLabel.sprite.position.set(tPos.x, tPos.y + orbR * 1.9 + 0.2, 0.1);
    scene.add(tLabel.sprite);
    const pLabel = textSprite('YOU', {
      worldH: 0.3, width: 512, height: 96, font: '700 40px "JetBrains Mono"', color: '#c9b8ff',
    });
    pLabel.sprite.position.set(pPos.x, pPos.y - pR * 1.9 - 0.2, 0.1);
    scene.add(pLabel.sprite);
    disposables.push(tLabel, pLabel);

    // ───────────── Closeness ring (around target) ─────────────
    const ringGeo = new THREE.RingGeometry(0.965, 1, 96);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5a6aa8'), toneMapped: false, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(tPos);
    ring.position.z = 0.05;
    scene.add(ring);
    const ringGeo2 = new THREE.RingGeometry(0.93, 1, 96);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5a6aa8'), toneMapped: false, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring2 = new THREE.Mesh(ringGeo2, ring2Mat);
    ring2.position.copy(ring.position);
    scene.add(ring2);
    disposables.push(ringGeo, ringMat, ringGeo2, ring2Mat);

    // ───────────── Colour field ─────────────
    const CW = 256, CH = 160;
    const cv = document.createElement('canvas');
    cv.width = CW; cv.height = CH;
    const g2 = cv.getContext('2d');
    const img = g2.createImageData(CW, CH);
    for (let y = 0; y < CH; y++) {
      const l = L_MIN + (1 - y / (CH - 1)) * (L_MAX - L_MIN);
      for (let x = 0; x < CW; x++) {
        const [r, g, b] = hslToRgb(x / CW, SAT, l);
        const i = (y * CW + x) * 4;
        img.data[i] = r * 255; img.data[i + 1] = g * 255; img.data[i + 2] = b * 255; img.data[i + 3] = 255;
      }
    }
    g2.putImageData(img, 0, 0);
    const fieldTex = new THREE.CanvasTexture(cv);
    fieldTex.colorSpace = THREE.SRGBColorSpace;
    fieldTex.minFilter = THREE.LinearFilter;
    fieldTex.generateMipmaps = false;
    const fieldGeo = new THREE.PlaneGeometry(fw, fh);
    const fieldMat = new THREE.MeshBasicMaterial({ map: fieldTex, toneMapped: false, transparent: true, opacity: 0 });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    field.position.set(fc.x, fc.y, 0);
    const glassGeo = new THREE.PlaneGeometry(fw + 0.4, fh + 0.4);
    const glass = new THREE.Mesh(glassGeo, bodyMat('#070a1c', 0.9));
    glass.position.set(fc.x, fc.y, -0.05);
    const frameGeo = new THREE.BoxGeometry(fw + 0.4, fh + 0.4, 0.05);
    const frame = edgeLines(frameGeo, ctx.accent, 1.8, 0.9);
    frame.position.copy(glass.position);
    const frameGlow = glowSprite(ctx.accent, Math.max(fw, fh) * 1.7, 0.12);
    frameGlow.position.set(fc.x, fc.y, -0.3);
    scene.add(glass, field, frame, frameGlow);
    disposables.push(fieldTex, fieldGeo, fieldMat, glassGeo, glass.material, frameGeo, frame.geometry, frame.material, frameGlow.material);
    track(fieldMat); track(glass.material); track(frame.material);
    glass.material.opacity = 0; frame.material.opacity = 0;
    gsap.to(fieldMat, { opacity: 0.96, duration: 0.6, delay: 0.2 });
    gsap.to(glass.material, { opacity: 0.9, duration: 0.5 });
    gsap.to(frame.material, { opacity: 0.9, duration: 0.5 });

    const hueLbl = textSprite('HUE  →', {
      worldH: 0.26, width: 384, height: 80, font: '600 34px "JetBrains Mono"', color: '#8f9bc8',
    });
    hueLbl.sprite.position.set(fc.x, fy0 - 0.45, 0.05);
    const lLbl = textSprite('LIGHTNESS  ↑', {
      worldH: 0.26, width: 512, height: 80, font: '600 34px "JetBrains Mono"', color: '#8f9bc8', align: 'left',
    });
    lLbl.sprite.position.set(fx0 + (512 / 80) * 0.26 / 2, fy0 + fh + 0.45, 0.05);
    scene.add(hueLbl.sprite, lLbl.sprite);
    disposables.push(hueLbl, lLbl);

    // ───────────── Reticle ─────────────
    const reticle = new THREE.Group();
    const retMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0, depthWrite: false });
    const retGeo = new THREE.RingGeometry(0.2, 0.235, 40);
    const tickGeo = new THREE.PlaneGeometry(0.03, 0.14);
    const dotGeo = new THREE.CircleGeometry(0.06, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0, depthWrite: false });
    reticle.add(new THREE.Mesh(retGeo, retMat));
    for (let i = 0; i < 4; i++) {
      const tk = new THREE.Mesh(tickGeo, retMat);
      const a = (i * Math.PI) / 2;
      tk.position.set(Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0);
      tk.rotation.z = a - Math.PI / 2;
      reticle.add(tk);
    }
    reticle.add(new THREE.Mesh(dotGeo, dotMat));
    reticle.position.z = 0.2;
    scene.add(reticle);
    disposables.push(retMat, retGeo, tickGeo, dotGeo, dotMat);

    // ───────────── State ─────────────
    const cur = new THREE.Color('#2a3350');
    const want = new THREE.Color('#2a3350');
    const ptr = { h: 0, l: 0.5, valid: false, inField: false };
    let closeness = 0;
    let lastPct = -1;
    let finished = false;
    let retOpacity = 0;
    const coldC = new THREE.Color('#5a6aa8');
    const green = new THREE.Color('#3dff8a');
    const tmpC = new THREE.Color();
    const tmpV = new THREE.Vector3();

    function measure(h, l) {
      const dh = hueDiff(h, target.h) / HUE_TOL;
      const dl = Math.abs(l - target.l) / L_TOL;
      const d = Math.hypot(dh, dl);
      const inside = dh <= 1 && dl <= 1;
      return { d, inside, dh, dl, c: inside ? 1 : Math.max(0, 1 - (d - 1) / 6) };
    }

    function win() {
      finished = true;
      const c = targetCol;
      audio.sfx.coin();
      // merge: player orb dives into the target
      gsap.killTweensOf(pOrb.g.position);
      gsap.to(pOrb.g.position, { x: tPos.x, y: tPos.y, duration: 0.55, ease: 'power3.in' });
      gsap.to(pOrb.g.scale, { x: 0.25, y: 0.25, z: 0.25, duration: 0.55, ease: 'power3.in' });
      gsap.to(tOrb.g.scale, { x: 1.28, y: 1.28, z: 1.28, duration: 0.2, delay: 0.55, ease: 'power2.out' });
      gsap.to(tOrb.g.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.7, delay: 0.75, ease: 'elastic.out(1, 0.4)' });
      gsap.to(fieldMat, { opacity: 0.25, duration: 0.5 });
      gsap.to(ringMat, { opacity: 0, duration: 0.4, delay: 0.5 });
      gsap.to(ring2Mat, { opacity: 0, duration: 0.4, delay: 0.5 });
      fx.burst(pOrb.g.position, c, 24, 3, 0.16, 0.6, 0);
      delayed.push(gsap.delayedCall(0.55, () => {
        const p = tPos.clone();
        p.z = 0.3;
        fx.burst(p, c, 70, 6.5, 0.24, 1.2, 0.3);
        fx.burst(p, 0xffffff, 18, 3.5, 0.14, 0.8, 0);
        fx.ring(p, c, 7, 0.9);
        fx.ring(p, 0xffffff, 4.5, 0.6);
        fx.flash('#' + c.getHexString(), 0.22);
        audio.sfx.hit();
      }));
      const wait = ctx.timeLeft ? ctx.timeLeft() : 99;
      if (wait < 1.3) ctx.win();
      else delayed.push(gsap.delayedCall(0.9, () => ctx.win()));
    }

    // ───────────── Update ─────────────
    return {
      update(dt, t) {
        dt = Math.min(dt, 0.05);
        const pp = ctx.planePoint(0);
        const u = (pp.x - fx0) / fw, w = (pp.y - fy0) / fh;
        const inField = u >= 0 && u <= 1 && w >= 0 && w <= 1;
        ptr.inField = inField;

        if (inField && !finished) {
          ptr.h = u * 360;
          ptr.l = L_MIN + w * (L_MAX - L_MIN);
          ptr.valid = true;
          want.setHSL(ptr.h / 360, SAT, ptr.l);
          reticle.position.x = pp.x; reticle.position.y = pp.y;
          dotMat.color.copy(want).multiplyScalar(1.4);
        }

        // reticle visibility
        const retTarget = (inField && !finished) ? 1 : (ptr.valid && !finished ? 0.35 : 0);
        retOpacity += (retTarget - retOpacity) * Math.min(1, dt * 12);
        retMat.opacity = retOpacity; dotMat.opacity = retOpacity;
        reticle.rotation.z = t * 0.6;
        reticle.scale.setScalar(1 + Math.sin(t * 5) * 0.05);

        // live player orb
        if (!finished) {
          if (ptr.valid) {
            cur.lerp(want, Math.min(1, dt * 14));
            setOrbCol(pOrb, cur);
            pOrb.halo.material.opacity += (0.6 - pOrb.halo.material.opacity) * Math.min(1, dt * 6);
          }
          const m = ptr.valid ? measure(ptr.h, ptr.l) : { c: 0, inside: false, d: 99 };
          closeness += (m.c - closeness) * Math.min(1, dt * 10);

          // closeness ring: tightens and warms to green
          const c = closeness;
          const R = orbR * (1.2 + Math.pow(1 - c, 1.4) * 1.15);
          const pulse = m.inside ? 1 + Math.sin(t * 14) * 0.03 : 1;
          ring.scale.setScalar(R * pulse);
          ring2.scale.setScalar(R * pulse * 1.04);
          if (c < 0.6) tmpC.copy(coldC).lerp(ctx.accent, c / 0.6);
          else tmpC.copy(ctx.accent).lerp(green, (c - 0.6) / 0.4);
          const inten = 0.9 + c * 2.4 + (m.inside ? 0.8 + Math.sin(t * 14) * 0.3 : 0);
          ringMat.color.copy(tmpC).multiplyScalar(inten);
          ring2Mat.color.copy(tmpC).multiplyScalar(inten);
          ring2Mat.opacity = 0.15 + c * 0.35;

          const pct = Math.round(c * 100);
          if (pct !== lastPct && ptr.valid) {
            lastPct = pct;
            pLabel.setText(`YOU · ${pct}%`, m.inside ? '#7dffb0' : '#c9b8ff');
          }
        }

        // idle floating
        const bob = Math.sin(t * 1.3);
        if (!finished) {
          tOrb.g.position.y = tOrb.base.y + bob * 0.1;
          pOrb.g.position.y = pOrb.base.y + Math.sin(t * 1.6 + 1) * 0.07;
          ring.position.y = ring2.position.y = tOrb.g.position.y;
        }
        tOrb.shell.rotation.y = t * 0.4; tOrb.shell.rotation.x = t * 0.25;
        pOrb.shell.rotation.y = -t * 0.5; pOrb.shell.rotation.x = t * 0.3;
        tOrb.t1.rotation.set(1.1, t * 0.5, 0); tOrb.t2.rotation.set(t * 0.4, 0.7, t * 0.3);
        pOrb.t1.rotation.set(1.1, -t * 0.6, 0); pOrb.t2.rotation.set(-t * 0.5, 0.7, t * 0.2);

        // click
        if (input.pressed && !finished) {
          if (inField) {
            const m = measure(ptr.h, ptr.l);
            if (m.inside) {
              win();
            } else {
              audio.sfx.error();
              fx.shake(0.16, 0.28);
              tmpV.set(pp.x, pp.y + 0.5, 0.5);
              const msg = m.d < 2 ? 'so close!' : m.d < 4.5 ? 'close!' : 'cold';
              const col = m.d < 2 ? '#7dffb0' : m.d < 4.5 ? '#ffd45c' : '#7da8ff';
              fx.pop(tmpV, msg, col);
              fx.burst(tmpV.set(pp.x, pp.y, 0.3), want, 8, 1.8, 0.1, 0.4, 0);
              gsap.killTweensOf(pOrb.g.scale);
              gsap.fromTo(pOrb.g.scale, { x: 0.8, y: 0.8, z: 0.8 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
            }
          } else {
            audio.sfx.click();
          }
        }
      },

      dispose() {
        tweenTargets.forEach((o) => gsap.killTweensOf(o));
        [tOrb, pOrb].forEach((o) => { gsap.killTweensOf(o.g.scale); gsap.killTweensOf(o.g.position); });
        gsap.killTweensOf(fieldMat); gsap.killTweensOf(ringMat); gsap.killTweensOf(ring2Mat);
        gsap.killTweensOf(glass.material); gsap.killTweensOf(frame.material);
        delayed.forEach((d) => d.kill());
        disposables.forEach((d) => d && d.dispose && d.dispose());
      },
    };
  },
};
