import * as THREE from 'three';
import { glowSprite, edgeLines, bodyMat, textSprite, rand } from '../engine/helpers.js';

/**
 * Mission 6: "Tune the Vibe" — Dark Neon-Noir Studio Color Mixer.
 * Deep saturated cyber tones (no harsh white glare), live MATCH % meter,
 * and a subtle radar hint ring on the palette so it's intuitive and fun.
 */
const L_MIN = 0.18;
const L_MAX = 0.50;
const SAT = 0.88;

export default {
  create(ctx) {
    const { scene, fx, audio, input, planePoint, gsap } = ctx;
    const v = ctx.view();
    const diff = ctx.difficulty || 'normal';
    const reqMatch = diff === 'chill' ? 0.68 : diff === 'pro' ? 0.80 : 0.74;
    let ended = false;

    // Pick a rich, dark-vibrant target color (avoiding washed-out light tones)
    const targetH = rand(0.06, 0.94);
    const targetL = rand(0.26, 0.44);
    const targetColor = new THREE.Color().setHSL(targetH, SAT, targetL);
    const playerColor = new THREE.Color().setHSL((targetH + 0.35) % 1, SAT, 0.34);

    const wide = v.w >= 10.5;
    const orbY = wide ? 1.55 : 1.95;
    const fieldY = wide ? -1.1 : -1.05;
    const fw = Math.min(7.4, v.w * 0.84);
    const fh = Math.min(3.15, v.h * 0.36);

    // ── Target Orb (Left) — Rich matte-neon, no blinding bloom ──
    const targetGroup = new THREE.Group();
    targetGroup.position.set(-1.95, orbY, 0);
    const orbGeo = new THREE.SphereGeometry(0.76, 36, 28);
    const targetMat = new THREE.MeshBasicMaterial({ color: targetColor.clone().multiplyScalar(0.95) });
    const targetMesh = new THREE.Mesh(orbGeo, targetMat);
    const targetWire = edgeLines(new THREE.IcosahedronGeometry(0.9, 1), '#b07cff', 0.85, 0.4);
    const targetHalo = glowSprite(targetColor, 2.1, 0.22);
    const targetLbl = textSprite('TARGET VIBE', {
      worldH: 0.32, width: 380, height: 80,
      font: '700 36px "JetBrains Mono", monospace', color: '#b8c7ea',
    });
    targetLbl.sprite.position.set(0, 1.18, 0);
    targetGroup.add(targetHalo, targetMesh, targetWire, targetLbl.sprite);
    scene.add(targetGroup);

    // ── Player Live Orb (Right) ──
    const playerGroup = new THREE.Group();
    playerGroup.position.set(1.95, orbY, 0);
    const playerMat = new THREE.MeshBasicMaterial({ color: playerColor.clone().multiplyScalar(0.95) });
    const playerMesh = new THREE.Mesh(orbGeo, playerMat);
    const playerWire = edgeLines(new THREE.IcosahedronGeometry(0.9, 1), '#22e4ff', 0.85, 0.4);
    const playerHalo = glowSprite(playerColor, 2.1, 0.22);
    const matchLbl = textSprite('0% · SLIDE BELOW', {
      worldH: 0.34, width: 460, height: 84,
      font: '700 36px "JetBrains Mono", monospace', color: '#e2ebff',
    });
    matchLbl.sprite.position.set(0, 1.18, 0);
    playerGroup.add(playerHalo, playerMesh, playerWire, matchLbl.sprite);
    scene.add(playerGroup);

    // Accuracy ring around player orb
    const ringGeo = new THREE.RingGeometry(0.98, 1.07, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#6c7db0'), side: THREE.DoubleSide, transparent: true, opacity: 0.7,
    });
    const matchRing = new THREE.Mesh(ringGeo, ringMat);
    playerGroup.add(matchRing);

    // ── Dark-Vibrant 2D Studio Palette Deck ──
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d');
    for (let x = 0; x < cv.width; x++) {
      const hue = (x / cv.width) * 360;
      const gr = g.createLinearGradient(0, 0, 0, cv.height);
      gr.addColorStop(0, `hsl(${hue}, 88%, 48%)`);
      gr.addColorStop(0.5, `hsl(${hue}, 90%, 33%)`);
      gr.addColorStop(1, `hsl(${hue}, 92%, 17%)`);
      g.fillStyle = gr;
      g.fillRect(x, 0, 1, cv.height);
    }
    // Subtle dark studio grid lines & vignette so it stays easy on the eyes
    g.strokeStyle = 'rgba(5, 8, 20, 0.28)';
    g.lineWidth = 1;
    for (let x = 32; x < cv.width; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cv.height); g.stroke(); }
    for (let y = 32; y < cv.height; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke(); }

    const palTex = new THREE.CanvasTexture(cv);
    palTex.colorSpace = THREE.SRGBColorSpace;

    const fieldGroup = new THREE.Group();
    fieldGroup.position.set(0, fieldY, 0);
    const frameGeo = new THREE.BoxGeometry(fw + 0.26, fh + 0.26, 0.12);
    const frameBody = new THREE.Mesh(frameGeo, bodyMat('#050814', 0.96));
    const frameEdge = edgeLines(frameGeo, '#7c5cff', 1.15);
    const palPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(fw, fh),
      new THREE.MeshBasicMaterial({ map: palTex }),
    );
    palPlane.position.z = 0.08;
    fieldGroup.add(frameBody, frameEdge, palPlane);
    scene.add(fieldGroup);

    // Subtle radar hint ring showing the neighborhood of the target color
    const targetX = (targetH - 0.5) * fw;
    const targetY = ((targetL - L_MIN) / (L_MAX - L_MIN) - 0.5) * fh;
    const hintRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.47, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.28 }),
    );
    hintRing.position.set(targetX, targetY, 0.11);
    fieldGroup.add(hintRing);

    // Player cursor reticle on palette
    const ret = new THREE.Group();
    const retRing = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.24, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    );
    ret.add(retRing);
    ret.position.set(0, 0, 0.14);
    fieldGroup.add(ret);

    let closeness = 0;

    function updateSelection(worldPt) {
      const lx = THREE.MathUtils.clamp(worldPt.x - fieldGroup.position.x, -fw / 2, fw / 2);
      const ly = THREE.MathUtils.clamp(worldPt.y - fieldGroup.position.y, -fh / 2, fh / 2);
      ret.position.x = lx;
      ret.position.y = ly;
      const curH = lx / fw + 0.5;
      const curL = L_MIN + (ly / fh + 0.5) * (L_MAX - L_MIN);
      playerColor.setHSL(curH, SAT, curL);
      playerMat.color.copy(playerColor).multiplyScalar(0.95);
      playerHalo.material.color.copy(playerColor);

      const dh = Math.min(Math.abs(curH - targetH), 1 - Math.abs(curH - targetH));
      const dl = Math.abs(curL - targetL);
      const dist = Math.hypot(dh * 2.0, dl * 1.8);
      closeness = THREE.MathUtils.clamp(1 - dist / 0.52, 0, 1);
      const pct = Math.round(closeness * 100);
      const ok = closeness >= reqMatch;
      matchLbl.setText(ok ? `${pct}% · CLICK TO LOCK!` : `${pct}% MATCH`, ok ? '#3dffb5' : '#e2ebff');
      ringMat.color.set(ok ? '#3dffb5' : '#7c5cff');
      matchRing.scale.setScalar(1.18 - closeness * 0.18);
      ctx.setProgress?.(`${pct}% HARMONY (NEED ${Math.round(reqMatch * 100)}%+)`);
    }

    updateSelection(new THREE.Vector3(0, fieldY, 0));

    return {
      update(dt, t) {
        if (ended) return;
        targetWire.rotation.y += dt * 0.45;
        targetWire.rotation.x += dt * 0.25;
        playerWire.rotation.y -= dt * 0.45;
        playerWire.rotation.x += dt * 0.25;
        hintRing.scale.setScalar(1 + Math.sin(t * 3.5) * 0.12);
        hintRing.material.opacity = 0.2 + 0.14 * Math.sin(t * 3.5);

        const pt = planePoint(0);
        updateSelection(pt);

        if (input.pressed) {
          if (closeness >= reqMatch) {
            ended = true;
            audio.sfx.coin();
            fx.ring(new THREE.Vector3(0, orbY, 0), targetColor, 2.8, 0.65);
            fx.burst(targetGroup.position, targetColor, 36, 4.5, 0.16, 0.8);
            fx.burst(playerGroup.position, playerColor, 36, 4.5, 0.16, 0.8);
            fx.pop(new THREE.Vector3(0, orbY, 0), 'VIBE LOCKED ✓', '#3dffb5');
            gsap.to(targetGroup.position, { x: 0, duration: 0.42, ease: 'back.in(1.5)' });
            gsap.to(playerGroup.position, {
              x: 0, duration: 0.42, ease: 'back.in(1.5)',
              onComplete: () => ctx.win(),
            });
          } else {
            audio.sfx.error();
            fx.shake(0.16, 0.22);
            const msg = closeness > 0.58 ? 'ALMOST THERE! MOVE TOWARD THE RING' : 'SLIDE TOWARD THE PULSING RING';
            fx.pop(playerGroup.position, msg, '#ffc23d');
          }
        }
      },
      dispose() {
        palTex.dispose();
        targetLbl.dispose();
        matchLbl.dispose();
      },
    };
  },
};
