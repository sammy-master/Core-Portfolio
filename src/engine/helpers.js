import * as THREE from 'three';

/** HDR emissive material (blooms). color: hex | THREE.Color | css string. */
export function glowMat(color, intensity = 1.8, opacity = 1) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: opacity < 1, opacity });
}

/** Glassy dark body with a bright edge: pair with edgeLines(). */
export function bodyMat(color = '#0b0f24', opacity = 0.85) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity, depthWrite: false });
}

export function edgeLines(geometry, color = '#ffffff', intensity = 1.6, opacity = 1) {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity, toneMapped: false }),
  );
}

/**
 * Crisp in-world text as a sprite (canvas texture).
 * Returns { sprite, setText(str), setColor(css) }. worldH = sprite height in world units.
 */
export function textSprite(text, {
  color = '#ffffff', font = '600 54px "JetBrains Mono", monospace', width = 768, height = 128,
  worldH = 0.7, bg = null, border = null, radius = 22, align = 'center',
} = {}) {
  const cv = document.createElement('canvas');
  cv.width = width; cv.height = height;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((width / height) * worldH, worldH, 1);
  const api = {
    sprite,
    setText(t, c = color) {
      g.clearRect(0, 0, width, height);
      if (bg || border) {
        g.beginPath();
        g.roundRect(4, 4, width - 8, height - 8, radius);
        if (bg) { g.fillStyle = bg; g.fill(); }
        if (border) { g.lineWidth = 4; g.strokeStyle = border; g.stroke(); }
      }
      g.font = font; g.fillStyle = c; g.textBaseline = 'middle'; g.textAlign = align;
      const x = align === 'center' ? width / 2 : align === 'left' ? 28 : width - 28;
      g.fillText(t, x, height / 2 + 3);
      tex.needsUpdate = true;
    },
    dispose() { tex.dispose(); mat.dispose(); },
  };
  api.setText(text);
  return api;
}

/** Soft radial glow sprite (additive) for halos behind objects. */
let _glowTex = null;
export function glowSprite(color = '#ffffff', size = 3, opacity = 0.8) {
  if (!_glowTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    _glowTex = new THREE.CanvasTexture(cv);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: _glowTex, color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  s.scale.setScalar(size);
  return s;
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
