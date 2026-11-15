// Leaves for vines and trailing plants: a heart-shaped pothos leaf drawn once on a canvas
// (with alpha), tinted per batch so the greenery has natural colour variation.
import * as THREE from 'three';

let leafTex = null;
function leafTexture() {
  if (leafTex) return leafTex;
  const s = 128;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  // heart-shaped leaf pointing up, stem at the bottom centre
  ctx.beginPath();
  ctx.moveTo(64, 120);
  ctx.bezierCurveTo(18, 104, 4, 56, 28, 30);
  ctx.bezierCurveTo(42, 16, 58, 22, 64, 34);
  ctx.bezierCurveTo(70, 22, 86, 16, 100, 30);
  ctx.bezierCurveTo(124, 56, 110, 104, 64, 120);
  ctx.closePath();
  const g = ctx.createRadialGradient(56, 60, 6, 64, 70, 70);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#d9d9d9'); g.addColorStop(1, '#a8a8a8');
  ctx.fillStyle = g; ctx.fill();
  // midrib and side veins
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(64, 118); ctx.quadraticCurveTo(62, 70, 64, 36); ctx.stroke();
  ctx.lineWidth = 1.5;
  for (const [y, d] of [[96, 1], [80, 1], [64, 1], [96, -1], [80, -1], [64, -1]]) {
    ctx.beginPath(); ctx.moveTo(63, y); ctx.quadraticCurveTo(64 + d * 22, y - 10, 64 + d * 36, y - 26); ctx.stroke();
  }
  leafTex = new THREE.CanvasTexture(c);
  leafTex.colorSpace = THREE.SRGBColorSpace;
  return leafTex;
}

const geoCache = {};
export function leafGeometry(size = 0.085) {
  if (!geoCache[size]) {
    const geo = new THREE.PlaneGeometry(size, size);
    geo.translate(0, size * 0.42, 0);      // pivot at the stem, so rotations look like leaves on a vine
    geoCache[size] = geo;
  }
  return geoCache[size];
}

const matCache = {};
export function leafMaterial(color) {
  if (!matCache[color]) {
    matCache[color] = new THREE.MeshStandardMaterial({
      color, map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0,
    });
  }
  return matCache[color];
}

export const LEAF_COLORS = ['#3d7a33', '#4c8e3a', '#5fa646', '#2e6a2b', '#7cb850'];
