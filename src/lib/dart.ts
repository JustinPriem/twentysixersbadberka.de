import * as THREE from "three";

/**
 * Baut einen stilisierten Dartpfeil als Three.js-Gruppe.
 *
 * Wichtig: `Object3D.lookAt()` verhält sich bei normalen Objekten (Meshes/
 * Gruppen) anders als bei Kameras – es richtet die lokale +Z-Achse zum Ziel
 * aus (nicht -Z wie bei Kameras, siehe Three.js-Quellcode von Object3D.lookAt).
 * Die Spitze muss deshalb bei +Z liegen, die Federn bei -Z, damit
 * `group.lookAt(target)` tatsächlich mit der Spitze voran zeigt.
 */
export function createDart(): THREE.Group {
  const group = new THREE.Group();

  const tipMat = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, metalness: 0.7, roughness: 0.25, transparent: true });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0xcda434, metalness: 0.55, roughness: 0.35, transparent: true });
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x18171a, metalness: 0.1, roughness: 0.6, transparent: true });
  const flightMat = new THREE.MeshStandardMaterial({
    color: 0xc8202c,
    side: THREE.DoubleSide,
    metalness: 0,
    roughness: 0.8,
    transparent: true,
  });

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 16), tipMat);
  tip.rotateX(Math.PI / 2);
  tip.position.z = 0.08;
  group.add(tip);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.017, 0.32, 16), barrelMat);
  barrel.rotateX(Math.PI / 2);
  barrel.position.z = -0.08;
  group.add(barrel);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 12), shaftMat);
  shaft.rotateX(Math.PI / 2);
  shaft.position.z = -0.32;
  group.add(shaft);

  const flightGroup = new THREE.Group();
  flightGroup.position.z = -0.43;
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.11, 0.05);
  finShape.lineTo(0.14, 0.16);
  finShape.lineTo(0, 0.12);
  finShape.lineTo(-0.14, 0.16);
  finShape.lineTo(-0.11, 0.05);
  finShape.closePath();
  const finGeom = new THREE.ShapeGeometry(finShape);

  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(finGeom, flightMat);
    fin.rotation.z = (i / 3) * Math.PI * 2;
    fin.rotateY(Math.PI / 2);
    flightGroup.add(fin);
  }
  group.add(flightGroup);

  return group;
}

/**
 * Erzeugt einen Pool leichtgewichtiger "Geister"-Meshes für die Bewegungsspur
 * des Dartpfeils. Bewusst simple Geometrie (ein gestreckter Kegel statt der
 * vollen Dart-Gruppe), da davon mehrere gleichzeitig gerendert werden.
 */
export function createTrailPool(count: number): THREE.Mesh[] {
  const geometry = new THREE.ConeGeometry(0.02, 0.55, 8);
  geometry.rotateX(Math.PI / 2);
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xe8c766,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    meshes.push(mesh);
  }
  return meshes;
}

/** Kubische Bezierkurve, gibt Position bei t in [0,1] zurück. */
export function cubicBezier(
  t: number,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  out.set(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    a * p0.z + b * p1.z + c * p2.z + d * p3.z
  );
  return out;
}

/** Ableitung (Tangente) der kubischen Bezierkurve bei t. */
export function cubicBezierTangent(
  t: number,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const mt = 1 - t;
  const a = 3 * mt * mt;
  const b = 6 * mt * t;
  const c = 3 * t * t;
  out.set(
    a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x),
    a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y),
    a * (p1.z - p0.z) + b * (p2.z - p1.z) + c * (p3.z - p2.z)
  );
  return out;
}
