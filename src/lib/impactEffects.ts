import * as THREE from "three";

/** Weicher, radialer Glow-Punkt als Sprite-Textur (für Funken). */
export function createGlowSpriteTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(232,199,102,0.9)");
  grad.addColorStop(1, "rgba(232,199,102,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export interface SparkBurst {
  points: THREE.Points;
  material: THREE.PointsMaterial;
  directions: Float32Array;
}

/** Funkenbündel, das deterministisch über `updateSparkBurst` mit dem Scrollfortschritt animiert wird. */
export function createSparkBurst(count: number, texture: THREE.Texture): SparkBurst {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.55 + Math.random() * 0.85;
    directions[i * 3] = Math.cos(angle) * speed;
    directions[i * 3 + 1] = Math.sin(angle) * speed * 0.75 + 0.25;
    directions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 0.085,
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.visible = false;
  points.frustumCulled = false;
  return { points, material, directions };
}

/** Positioniert die Funken für den Scrollfortschritt `t` (0–1) innerhalb des Impact-Fensters. */
export function updateSparkBurst(burst: SparkBurst, origin: THREE.Vector3, t: number) {
  const posAttr = burst.points.geometry.getAttribute("position") as THREE.BufferAttribute;
  const ease = 1 - Math.pow(1 - t, 2);
  const gravity = t * t * 0.55;
  for (let i = 0; i < posAttr.count; i++) {
    const dx = burst.directions[i * 3];
    const dy = burst.directions[i * 3 + 1];
    const dz = burst.directions[i * 3 + 2];
    posAttr.setXYZ(
      i,
      origin.x + dx * ease * 0.85,
      origin.y + dy * ease * 0.85 - gravity,
      origin.z + dz * ease * 0.85 + 0.06
    );
  }
  posAttr.needsUpdate = true;
}

/** Expandierender Ring als Schockwellen-Effekt am Einschlagpunkt. */
export function createShockwaveRing(): THREE.Mesh {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const r = size * 0.34;
  ctx.strokeStyle = "rgba(232,199,102,1)";
  ctx.lineWidth = size * 0.05;
  ctx.shadowColor = "rgba(232,199,102,0.9)";
  ctx.shadowBlur = size * 0.07;
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.visible = false;
  return mesh;
}
