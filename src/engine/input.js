import * as THREE from 'three';
import { camera } from './renderer.js';

/**
 * Unified pointer / keyboard state. Flags `pressed`, `released`, `typed`,
 * `keysPressed` are valid for ONE frame (cleared by endFrame()).
 */
export const input = {
  ndc: new THREE.Vector2(0, 0),
  px: 0, py: 0,            // CSS pixels
  down: false,
  pressed: false,
  released: false,
  moved: false,
  dx: 0, dy: 0,            // drag delta this frame (CSS px) while down
  wheel: 0,
  typed: [],               // printable chars typed this frame
  keysDown: new Set(),
  keysPressed: new Set(),
  touch: false,
};

const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let kb = null;

function setPointer(e) {
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = -(e.clientY / window.innerHeight) * 2 + 1;
  if (input.down) { input.dx += e.clientX - input.px; input.dy += e.clientY - input.py; }
  input.px = e.clientX; input.py = e.clientY;
  input.ndc.set(nx, ny);
  input.moved = true;
}

export function initInput() {
  kb = document.getElementById('kb');
  const onUI = (t) => t instanceof Element && !!t.closest('[data-ui]');

  window.addEventListener('pointermove', (e) => {
    input.touch = e.pointerType === 'touch';
    setPointer(e);
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    input.touch = e.pointerType === 'touch';
    input.px = e.clientX; input.py = e.clientY;
    setPointer(e);
    if (onUI(e.target)) return;
    input.down = true; input.pressed = true;
  });
  const up = (e) => {
    if (input.down) input.released = true;
    input.down = false;
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('wheel', (e) => { if (!onUI(e.target)) input.wheel += e.deltaY; }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target !== kb) return;
    if (!input.keysDown.has(e.code)) input.keysPressed.add(e.code);
    input.keysDown.add(e.code);
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      input.typed.push(e.key);
      if (e.key === ' ') e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => input.keysDown.delete(e.code));
  window.addEventListener('blur', () => { input.keysDown.clear(); input.down = false; });

  // Mobile soft keyboard bridge (desktop keydown handles its own chars).
  kb.addEventListener('input', (e) => {
    const d = e.data;
    if (d) for (const ch of d) input.typed.push(ch);
    kb.value = '';
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('dragstart', (e) => e.preventDefault());
}

export function showKeyboard() { if (kb && input.touch) kb.focus({ preventScroll: true }); }
export function hideKeyboard() { if (kb) kb.blur(); }

export function endFrame() {
  input.pressed = false; input.released = false; input.moved = false;
  input.dx = 0; input.dy = 0; input.wheel = 0;
  input.typed.length = 0; input.keysPressed.clear();
}

/** First intersection of the pointer ray with the given objects (or null). */
export function pick(objects, recursive = false) {
  raycaster.setFromCamera(input.ndc, camera);
  const hits = raycaster.intersectObjects(objects, recursive);
  return hits.length ? hits[0] : null;
}

/** Pointer position projected onto the plane z = planeZ (default 0). */
export function planePoint(planeZ = 0, out = new THREE.Vector3()) {
  raycaster.setFromCamera(input.ndc, camera);
  plane.constant = -planeZ;
  return raycaster.ray.intersectPlane(plane, out) || out.set(0, 0, planeZ);
}
