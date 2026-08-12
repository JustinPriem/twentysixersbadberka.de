import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createDartboardTexture, drawDartboard, pointForHighlight, type Highlight } from "./dartboard";
import { createDart, cubicBezier, cubicBezierTangent } from "./dart";

gsap.registerPlugin(ScrollTrigger);

const FLIGHT_END = 0.62;
const IMPACT_PEAK = 0.72;
const IMPACT_END = 0.8;
const EMBED_DIR = new THREE.Vector3(0, 0, -1);

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function initDartHero() {
  const heroSection = document.querySelector<HTMLElement>("[data-dart-hero]");
  const canvasWrap = document.querySelector<HTMLElement>("[data-canvas-wrap]");
  const flashEl = document.querySelector<HTMLElement>("[data-impact-flash]");
  const cueEl = document.querySelector<HTMLElement>("[data-scroll-cue]");
  const revealEl = document.querySelector<HTMLElement>("[data-hero-reveal]");

  if (!heroSection || !canvasWrap) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    heroSection.classList.add("is-static");
    revealEl?.classList.add("is-visible");
    cueEl?.remove();
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, canvasWrap.clientWidth / Math.max(canvasWrap.clientHeight, 1), 0.1, 100);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
  canvasWrap.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xfff3d6, 1.1);
  key.position.set(2, 2, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcda434, 0.6);
  rim.position.set(-2, -1, -2);
  scene.add(rim);

  const boardSize = 3.2;
  const { texture, canvas: boardCanvas } = createDartboardTexture(1024);
  const boardMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(boardSize, boardSize), boardMat);
  scene.add(board);

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 512;
  const gctx = glowCanvas.getContext("2d");
  if (gctx) {
    const grad = gctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    grad.addColorStop(0, "rgba(205,164,52,0.35)");
    grad.addColorStop(1, "rgba(205,164,52,0)");
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 512, 512);
  }
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(boardSize * 2.2, boardSize * 2.2), glowMat);
  glow.position.z = -0.3;
  scene.add(glow);

  const dart = createDart();
  scene.add(dart);

  const HIGHLIGHT: Highlight = { sectorValue: 20, ring: "triple" };
  const hit2D = pointForHighlight(HIGHLIGHT);
  const boardHalf = boardSize / 2;
  const hitWorld = new THREE.Vector3(hit2D.x * boardHalf, hit2D.y * boardHalf, 0.03);

  const P0 = new THREE.Vector3(1.9, -1.6, 3.4);
  const P1 = new THREE.Vector3(1.0, 0.3, 1.6);
  const P2 = new THREE.Vector3(0.25, hitWorld.y + 0.5, 0.6);
  const P3 = hitWorld.clone();

  const tmpPos = new THREE.Vector3();
  const tmpTangent = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();

  let highlightIntensity = 0;

  function render(progress: number) {
    let shakeX = 0;
    let shakeRotZ = 0;
    let impactPulse = 0;

    if (progress <= FLIGHT_END) {
      const t = easeInOutCubic(clamp01(progress / FLIGHT_END));
      cubicBezier(t, P0, P1, P2, P3, tmpPos);
      cubicBezierTangent(t, P0, P1, P2, P3, tmpTangent).normalize();
      dart.position.copy(tmpPos);
      tmpTarget.copy(tmpPos).add(tmpTangent);
      dart.lookAt(tmpTarget);
      dart.rotation.z += Math.sin(t * Math.PI * 2) * 0.15 * (1 - t);
      highlightIntensity = 0;
    } else {
      dart.position.copy(P3);
      tmpTarget.copy(P3).add(EMBED_DIR);
      dart.lookAt(tmpTarget);

      const shakeP = clamp01((progress - FLIGHT_END) / (IMPACT_PEAK - FLIGHT_END));
      const decay = 1 - shakeP;
      shakeX = Math.sin(shakeP * Math.PI * 6) * 0.02 * decay;
      shakeRotZ = shakeX * 0.4;
      impactPulse = Math.sin(shakeP * Math.PI) * 0.02;
      highlightIntensity = Math.sin(clamp01((progress - FLIGHT_END) / (IMPACT_END - FLIGHT_END)) * Math.PI);
    }

    drawDartboard(boardCanvas, { highlight: HIGHLIGHT, highlightIntensity });
    texture.needsUpdate = true;

    const revealP = clamp01((progress - IMPACT_END) / (1 - IMPACT_END));
    const revealEase = easeOutCubic(revealP);
    const boardOpacity = 1 - revealEase;
    const boardScale = (1 + revealEase * 0.35) * (1 + impactPulse);

    boardMat.opacity = boardOpacity;
    board.position.x = shakeX;
    board.rotation.z = shakeRotZ;
    board.scale.setScalar(boardScale);

    glowMat.opacity = boardOpacity * 0.8;
    glow.scale.setScalar(boardScale);

    dart.visible = boardOpacity > 0.02;
    dart.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.Material | undefined;
      if (mat) mat.opacity = boardOpacity;
    });

    if (flashEl) {
      const flashP = Math.max(0, 1 - Math.abs(progress - IMPACT_PEAK) / 0.05);
      flashEl.style.opacity = String(Math.pow(flashP, 2) * 0.9);
    }
    if (revealEl) {
      revealEl.style.opacity = String(revealEase);
      revealEl.style.transform = `translateY(${(1 - revealEase) * 24}px) scale(${0.92 + revealEase * 0.08})`;
    }
    if (cueEl) {
      cueEl.style.opacity = String(1 - clamp01(progress / 0.08));
    }

    renderer.render(scene, camera);
  }

  render(0);

  ScrollTrigger.create({
    trigger: heroSection,
    start: "top top",
    end: "+=280%",
    pin: true,
    scrub: 0.6,
    onUpdate: (self) => render(self.progress),
  });

  function handleResize() {
    const w = canvasWrap!.clientWidth;
    const h = canvasWrap!.clientHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    ScrollTrigger.refresh();
  }
  window.addEventListener("resize", handleResize);
}
