import * as THREE from 'three';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite, rand } from '../engine/helpers.js';

/**
 * "Ship It": time the sweeping marker inside the green zone three times
 * (git add / git commit / git push), then the rocket launches.
 */
export default {
  create(ctx) {
    const { scene, fx, audio, input, gsap } = ctx;
    const GREEN = new THREE.Color('#3dff9a');
    const DIM = new THREE.Color('#41506f');
    const WHITE = new THREE.Color('#ffffff');

    // ---- tween bookkeeping (killed on dispose) ----
    const tweens = [];
    const to = (...a) => { const tw = gsap.to(...a); tweens.push(tw); return tw; };
    const disposables = [];

    const v = ctx.view();
    const H = Math.min(8.5, v.h);
    const W = Math.min(14, v.w);
    const S = THREE.MathUtils.clamp(H / 8.5, 0.6, 1);
    const top = H / 2;

    // ---- starfield ----
    const STARS = 110;
    const sPos = new Float32Array(STARS * 3);
    for (let i = 0; i < STARS; i++) {
      sPos[i * 3] = rand(-v.w / 2, v.w / 2);
      sPos[i * 3 + 1] = rand(-v.h / 2, v.h / 2);
      sPos[i * 3 + 2] = rand(-4, -1);
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    const sMat = new THREE.PointsMaterial({ color: new THREE.Color('#9fb4ff').multiplyScalar(1.2), size: 0.07, transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false });
    const stars = new THREE.Points(sGeo, sMat);
    stars.frustumCulled = false;
    scene.add(stars);
    disposables.push(sGeo, sMat);

    // ---- pad ----
    const padY = -top + 0.9 * S;
    const padGeo = new THREE.BoxGeometry(3.6 * S, 0.22, 1.4);
    const pad = new THREE.Mesh(padGeo, bodyMat('#0a1530', 0.95));
    pad.position.set(0, padY - 0.11, 0);
    const padEdge = edgeLines(padGeo, ctx.accent, 1.8);
    padEdge.position.copy(pad.position);
    const padGlow = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, 0.05), glowMat(ctx.accent, 1.3, 0.55));
    padGlow.position.set(0, padY - 0.24, 0);
    const padHalo = glowSprite(ctx.accent, 4.5 * S, 0.5);
    padHalo.position.set(0, padY, -0.2);
    padHalo.scale.set(5 * S, 1.2, 1);
    scene.add(pad, padEdge, padGlow, padHalo);

    // ---- rocket ----
    const rocket = new THREE.Group();
    rocket.scale.setScalar(S);
    scene.add(rocket);
    const redOrange = new THREE.Color('#ff7a45');

    const bodyGeo = new THREE.CylinderGeometry(0.48, 0.48, 1.8, 8);
    const body = new THREE.Mesh(bodyGeo, bodyMat('#0d1836', 0.92));
    body.position.y = 1.1;
    const bodyE = edgeLines(bodyGeo, ctx.accent, 1.9);
    bodyE.position.y = 1.1;
    const noseGeo = new THREE.ConeGeometry(0.48, 1.0, 8);
    const nose = new THREE.Mesh(noseGeo, bodyMat('#101c3e', 0.95));
    nose.position.y = 2.5;
    const noseE = edgeLines(noseGeo, ctx.accent, 2.2);
    noseE.position.y = 2.5;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.495, 0.495, 0.07, 8), glowMat(ctx.accent, 2.4));
    band.position.y = 2.02;
    const nozGeo = new THREE.CylinderGeometry(0.22, 0.34, 0.28, 8);
    const noz = new THREE.Mesh(nozGeo, bodyMat('#0a1020', 0.95));
    noz.position.y = 0.06;
    const nozE = edgeLines(nozGeo, redOrange, 1.6);
    nozE.position.y = 0.06;
    rocket.add(body, bodyE, nose, noseE, band, noz, nozE);

    const finShape = new THREE.Shape();
    finShape.moveTo(0, 1.0); finShape.lineTo(0.72, 0.1); finShape.lineTo(0.72, -0.15); finShape.lineTo(0, 0.0); finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: false });
    finGeo.translate(0, 0, -0.04);
    for (let i = 0; i < 3; i++) {
      const fg = new THREE.Group();
      const fm = new THREE.Mesh(finGeo, bodyMat('#2a0f1c', 0.95));
      const fe = edgeLines(finGeo, redOrange, 2.2);
      fg.add(fm, fe);
      fg.position.set(0, 0.35, 0);
      fg.rotation.y = (i * Math.PI * 2) / 3 + Math.PI / 2;
      const holder = new THREE.Group();
      fg.position.x = 0;
      fm.position.x = 0.4; fe.position.x = 0.4;
      holder.add(fg);
      rocket.add(holder);
    }
    disposables.push(bodyGeo, noseGeo, nozGeo, finGeo);

    const win = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), glowMat('#8defff', 2.6));
    win.position.set(0, 1.75, 0.42);
    const winRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 8, 20), glowMat(ctx.accent, 2.2));
    winRing.position.copy(win.position);
    const winHalo = glowSprite('#8defff', 1.2, 0.8);
    winHalo.position.set(0, 1.75, 0.55);
    rocket.add(win, winRing, winHalo);

    // flame (tip downward, origin at nozzle)
    const flameGeoO = new THREE.ConeGeometry(0.3, 1, 10, 1, true).rotateX(Math.PI).translate(0, -0.5, 0);
    const flameGeoI = new THREE.ConeGeometry(0.17, 1, 8, 1, true).rotateX(Math.PI).translate(0, -0.5, 0);
    const flameO = new THREE.Mesh(flameGeoO, glowMat('#ff8a2a', 2.4, 0.75));
    const flameI = new THREE.Mesh(flameGeoI, glowMat('#fff1b0', 3.2, 0.95));
    flameO.position.y = -0.08; flameI.position.y = -0.08;
    flameO.material.side = flameI.material.side = THREE.DoubleSide;
    flameO.material.blending = THREE.AdditiveBlending;
    const flameHalo = glowSprite('#ff9a3a', 2.4, 0.7);
    flameHalo.position.y = -0.5;
    rocket.add(flameO, flameI, flameHalo);
    disposables.push(flameGeoO, flameGeoI);

    // ---- power gauge ----
    const gw = Math.min(10, W * 0.9);
    const gy = top - 1.6 * S - 0.1;
    const gh = 0.95;
    const gauge = new THREE.Group();
    gauge.position.set(0, gy, 0);
    scene.add(gauge);
    const frameGeo = new THREE.BoxGeometry(gw + 0.4, gh, 0.3);
    const frame = new THREE.Mesh(frameGeo, bodyMat('#0a1530', 0.88));
    const frameE = edgeLines(frameGeo, ctx.accent, 2);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh - 0.3), glowMat('#16213f', 1, 1));
    track.position.z = 0.16;
    gauge.add(frame, frameE, track);
    disposables.push(frameGeo);

    const tickPts = [];
    for (let i = 0; i <= 20; i++) {
      const x = -gw / 2 + (gw * i) / 20;
      const h = i % 5 === 0 ? 0.14 : 0.07;
      tickPts.push(x, gh / 2 - 0.02, 0.18, x, gh / 2 - 0.02 - h, 0.18);
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPts, 3));
    const ticks = new THREE.LineSegments(tickGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(ctx.accent).multiplyScalar(1.2), transparent: true, opacity: 0.6, toneMapped: false }));
    gauge.add(ticks);
    disposables.push(tickGeo);

    // green zone
    const zoneMat = glowMat(GREEN, 1.7, 0.85);
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(1, gh - 0.3), zoneMat);
    zone.position.z = 0.2;
    const zoneEdgeMat = glowMat(GREEN, 3, 1);
    const zoneL = new THREE.Mesh(new THREE.PlaneGeometry(0.05, gh - 0.14), zoneEdgeMat);
    const zoneR = new THREE.Mesh(new THREE.PlaneGeometry(0.05, gh - 0.14), zoneEdgeMat);
    zoneL.position.z = zoneR.position.z = 0.22;
    const zoneHalo = glowSprite(GREEN, 2, 0.55);
    zoneHalo.position.z = 0.1;
    gauge.add(zone, zoneL, zoneR, zoneHalo);

    // marker
    const marker = new THREE.Group();
    const markMat = glowMat('#ffffff', 3.4);
    const markBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, gh + 0.45, 0.1), markMat);
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.26, 3), glowMat(ctx.accent, 3));
    tri.rotation.z = Math.PI;
    tri.position.y = gh / 2 + 0.36;
    const tri2 = tri.clone();
    tri2.rotation.z = 0; tri2.position.y = -(gh / 2 + 0.36);
    const markHalo = glowSprite(ctx.accent, 1.8, 0.8);
    marker.add(markBar, tri, tri2, markHalo);
    marker.position.z = 0.3;
    gauge.add(marker);

    // ---- stage pills ----
    const labels = ['git add', 'git commit', 'git push'];
    const pillW = Math.min(2.8, (W * 0.94) / 3 - 0.15);
    const pillK = pillW / 2.8;
    const pillY = gy - 1.15;
    const pills = labels.map((txt, i) => {
      const g = new THREE.Group();
      g.position.set((i - 1) * (pillW + 0.25), pillY, 0);
      const geo = new THREE.BoxGeometry(2.8 * pillK, 0.62, 0.2);
      const m = new THREE.Mesh(geo, bodyMat('#0a1530', 0.85));
      const e = edgeLines(geo, DIM, 1.6);
      const label = textSprite(txt, { worldH: 0.62 * pillK, width: 512, height: 128, font: '700 54px "JetBrains Mono"', color: '#6f7fa6' });
      label.sprite.scale.set(label.sprite.scale.x * 0.92, label.sprite.scale.y * 0.92, 1);
      label.sprite.position.z = 0.15;
      const halo = glowSprite(GREEN, 3.2 * pillK, 0);
      halo.scale.set(3.8 * pillK, 1.4 * pillK, 1);
      halo.position.z = -0.1;
      g.add(m, e, label.sprite, halo);
      scene.add(g);
      disposables.push(geo, label);
      return { g, e, label, halo, txt, done: false };
    });

    // ---- state ----
    const st = { lift: 0, flame: 0.6, rumble: 0, speedMul: 1 };
    let stage = 0;
    let p = -0.9, dir = 1;
    const zoneHalf = [0.23, 0.19, 0.155];
    let zoneC = 0.15;
    let zoneH = zoneHalf[0];
    let busy = false;      // post-hit cooldown (can't spam)
    let launching = false;
    let won = false;
    let missMul = 1;
    let time = 0;
    const baseSpeed = 1.05;
    const tmp = new THREE.Vector3();

    const layoutZone = () => {
      const half = zoneH * (gw / 2);
      const cx = zoneC * (gw / 2);
      zone.scale.x = half * 2;
      zone.position.x = cx;
      zoneL.position.x = cx - half; zoneR.position.x = cx + half;
      zoneHalo.position.x = cx;
      zoneHalo.scale.set(half * 2 + 1.6, gh + 1.0, 1);
    };
    layoutZone();
    ctx.setHint('Press / tap / SPACE when the marker is in the green zone');

    const gaugeX = (pp) => pp * (gw / 2 - 0.05);
    const zoneWorld = () => tmp.set(zoneC * (gw / 2), gy, 0.3).clone();
    const nozzleWorld = (out) => out.set(rocket.position.x, rocket.position.y - 0.05 * S, 0);

    const tint = (mat, from, to, dur) => {
      const o = { k: 0 };
      const c0 = from.clone(), c1 = to.clone();
      to(o, { k: 1, duration: dur, ease: 'power2.out', onUpdate: () => mat.color.copy(c0).lerp(c1, o.k) });
    };

    function completeStage() {
      const i = stage;
      const pill = pills[i];
      pill.done = true;
      audio.sfx.hit();
      setTimeout_(() => audio.sfx.coin(), 90);
      const zp = zoneWorld();
      fx.ring(zp, GREEN, 2.6, 0.7);
      fx.burst(zp, GREEN, 36, 4.2, 0.17, 0.9, 1.5);
      fx.pop(zp.clone().add(new THREE.Vector3(0, 0.6, 0)), '+ ' + pill.txt, '#3dff9a');
      fx.shake(0.1 + i * 0.05, 0.25);
      // pill lights up
      tint(pill.e.material, DIM, GREEN.clone().multiplyScalar(2.4), 0.3);
      pill.label.setText(pill.txt, '#3dff9a');
      to(pill.halo.material, { opacity: 0.85, duration: 0.3 });
      to(pill.g.scale, { x: 1.14, y: 1.14, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
      fx.ring(new THREE.Vector3(pill.g.position.x, pill.g.position.y, 0), GREEN, 1.4, 0.5);
      // marker flash
      markMat.color.copy(GREEN).multiplyScalar(4);
      tint(markMat, GREEN.clone().multiplyScalar(4), WHITE.clone().multiplyScalar(3.4), 0.4);

      stage++;
      // rocket reacts
      const nextLift = stage * 0.28 * S;
      to(st, { lift: nextLift, duration: 0.5, ease: 'back.out(2)' });
      to(st, { flame: 0.6 + stage * 0.8, duration: 0.4, ease: 'power2.out' });
      to(st, { rumble: stage, duration: 0.3 });
      to(rocket.scale, { x: S * 1.12, y: S * 0.9, z: S * 1.12, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' });

      if (stage >= 3) { startLaunch(); return; }
      ctx.setHint(`${pill.txt} done. Next: ${pills[stage].txt}`);
      busy = true;
      to(zone.scale, { y: 1.5, duration: 0.2, yoyo: true, repeat: 1 });
      // relocate zone (smaller)
      const side = zoneC > 0 ? -1 : 1;
      const newC = side * rand(0.2, 0.6);
      const o = { c: zoneC, h: zoneH };
      to(o, {
        c: newC, h: zoneHalf[stage], duration: 0.5, delay: 0.2, ease: 'power3.inOut',
        onUpdate: () => { zoneC = o.c; zoneH = o.h; layoutZone(); },
        onComplete: () => { busy = false; },
      });
      missMul = Math.max(1, missMul * 0.9);
      st.speedMul = 1 + stage * 0.1;
    }

    // tiny timer helper that is cleaned up by gsap kill
    function setTimeout_(fn, ms) { tweens.push(gsap.delayedCall(ms / 1000, fn)); }

    function startLaunch() {
      launching = true;
      ctx.setHint('All green. Launching!');
      const dur = Math.max(0.8, Math.min(1.5, ctx.timeLeft() - 0.6));
      audio.sfx.launch();
      fx.shake(0.45, 0.5 + dur);
      fx.flash('#ffd27a', 0.3);
      fx.ring(new THREE.Vector3(0, padY, 0), ctx.accent, 6, 0.9);
      fx.burst(new THREE.Vector3(0, padY, 0.2), '#ffb347', 70, 6, 0.2, 1.1, -0.2);
      to(st, { flame: 3.4, duration: 0.5, ease: 'power2.out' });
      to(st, { rumble: 4, duration: 0.3 });
      to(st, {
        lift: top + 7, duration: dur, delay: 0.4, ease: 'power2.in',
        onUpdate: () => {
          if (!won && rocket.position.y > top + 0.8) { won = true; ctx.win(); }
        },
      });
    }

    function attempt() {
      const hit = Math.abs(p - zoneC) <= zoneH + 0.04;
      if (hit) { completeStage(); return; }
      // miss
      audio.sfx.error();
      fx.shake(0.18, 0.25);
      missMul = Math.min(1.7, missMul * 1.08);
      markMat.color.set('#ff4060').multiplyScalar(3.5);
      tint(markMat, new THREE.Color('#ff4060').multiplyScalar(3.5), WHITE.clone().multiplyScalar(3.4), 0.35);
      to(frame.scale, { y: 1.08, duration: 0.07, yoyo: true, repeat: 1 });
      fx.burst(tmp.set(gaugeX(p), gy, 0.4).clone(), '#ff4060', 12, 2.5, 0.12, 0.5, 1);
    }

    // initial pulse in
    gauge.scale.setScalar(0.01);
    to(gauge.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.8)' });
    rocket.position.set(0, padY + 0.18 * S, 0);

    const sceneBase = scene.position.clone();

    return {
      update(dt, t) {
        time += dt;
        // idle visuals
        winHalo.scale.setScalar(1.2 + Math.sin(t * 4) * 0.12);
        markHalo.material.opacity = 0.65 + Math.sin(t * 9) * 0.15;
        padHalo.material.opacity = 0.4 + Math.sin(t * 2) * 0.08;
        zoneHalo.material.opacity = 0.45 + Math.sin(t * 6) * 0.12;
        win.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
        pills.forEach((pl, i) => { if (!pl.done) pl.g.position.y = pillY + Math.sin(t * 1.8 + i) * 0.04; });

        // marker sweep
        if (!launching) {
          const sp = baseSpeed * st.speedMul * missMul;
          p += dir * sp * dt;
          if (p > 1) { p = 1 - (p - 1); dir = -1; }
          else if (p < -1) { p = -1 - (p + 1); dir = 1; }
        }
        marker.position.x = gaugeX(p);
        const inZone = Math.abs(p - zoneC) <= zoneH + 0.04;
        zoneMat.color.copy(GREEN).multiplyScalar(inZone && !launching ? 2.4 : 1.7);

        // input
        if (!launching && !busy && time > 0.35 && (input.pressed || input.keysPressed.has('Space'))) attempt();

        // rocket transform + flame
        const rum = st.rumble * 0.012 * S;
        rocket.position.x = (Math.random() - 0.5) * rum * 2;
        rocket.position.y = padY + 0.18 * S + st.lift + (launching ? 0 : Math.sin(t * 2.4) * 0.025) + (Math.random() - 0.5) * rum;
        const fl = st.flame * (0.88 + Math.random() * 0.24);
        flameO.scale.set(1 + st.flame * 0.12, fl, 1 + st.flame * 0.12);
        flameI.scale.set(1 + st.flame * 0.08, fl * 0.72, 1 + st.flame * 0.08);
        flameHalo.scale.setScalar(1.6 + st.flame * 0.5);
        flameHalo.position.y = -0.3 - fl * 0.45;

        // engine particles
        nozzleWorld(tmp);
        tmp.y -= 0.15;
        const n = launching ? 6 : 1 + stage * 2;
        fx.burst(tmp, '#ffae45', n, 1.2 + stage * 0.8 + (launching ? 3 : 0), 0.12 + stage * 0.03, 0.55, 5);
        if (launching && rocket.position.y > padY + 0.8) {
          fx.burst(tmp, '#ffe9a8', 2, 2.2, 0.16, 0.9, 0.5);
        }

        // scene shake (camera feel) during launch
        if (launching) {
          const amp = 0.05 + Math.min(1, st.lift / 3) * 0.1;
          scene.position.set(sceneBase.x + (Math.random() - 0.5) * amp, sceneBase.y + (Math.random() - 0.5) * amp, sceneBase.z);
          // stars streak past
          const arr = sGeo.attributes.position.array;
          const speed = 2 + Math.min(1, st.lift / 4) * 22;
          for (let i = 0; i < STARS; i++) {
            arr[i * 3 + 1] -= speed * dt * (0.5 + (arr[i * 3 + 2] + 4) * 0.2);
            if (arr[i * 3 + 1] < -v.h / 2) arr[i * 3 + 1] += v.h;
          }
          sGeo.attributes.position.needsUpdate = true;
        } else {
          const arr = sGeo.attributes.position.array;
          for (let i = 0; i < STARS; i++) {
            arr[i * 3 + 1] -= 0.2 * dt;
            if (arr[i * 3 + 1] < -v.h / 2) arr[i * 3 + 1] += v.h;
          }
          sGeo.attributes.position.needsUpdate = true;
        }
      },
      dispose() {
        tweens.forEach((tw) => tw.kill());
        gsap.killTweensOf([st, rocket.scale, gauge.scale, frame.scale, zone.scale, markMat.color]);
        pills.forEach((pl) => gsap.killTweensOf([pl.g.scale, pl.halo.material]));
        scene.position.copy(sceneBase);
        disposables.forEach((d) => d.dispose && d.dispose());
      },
    };
  },
};
