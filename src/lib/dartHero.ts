import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { createDartboardTexture, drawDartboard, pointForHighlight, type Highlight } from "./dartboard";
import { createDart, createTrailPool, cubicBezier, cubicBezierTangent } from "./dart";
import { createGlowSpriteTexture, createSparkBurst, updateSparkBurst, createShockwaveRing, type SparkBurst } from "./impactEffects";

gsap.registerPlugin(ScrollTrigger, SplitText);

const FLIGHT_END = 0.62;
const IMPACT_PEAK = 0.72;
const IMPACT_END = 0.8;
const EMBED_DIR = new THREE.Vector3(0, 0, -1);
const BASE_FOV_DEG = 42;
const BOARD_SIZE = 3.2;

// GSAP-Easing-Kurven statt handgestrickter Funktionen – konsistent mit dem
// Rest des GSAP-Setups und angenehmer in der Bewegung.
const easeFlight = gsap.parseEase("power2.inOut");
const easeReveal = gsap.parseEase("power3.out");
const easeOut2 = gsap.parseEase("power2.out");

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function initDartHero() {
  const heroSection = document.querySelector<HTMLElement>("[data-dart-hero]");
  const canvasWrap = document.querySelector<HTMLElement>("[data-canvas-wrap]");
  const flashEl = document.querySelector<HTMLElement>("[data-impact-flash]");
  const cueEl = document.querySelector<HTMLElement>("[data-scroll-cue]");
  const eyebrowEl = document.querySelector<HTMLElement>("[data-hero-eyebrow]");
  const taglineEl = document.querySelector<HTMLElement>("[data-hero-tagline]");
  const ctaEl = document.querySelector<HTMLElement>("[data-hero-cta]");
  const splitLineEls = Array.from(document.querySelectorAll<HTMLElement>("[data-split-line]"));

  if (!heroSection || !canvasWrap) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    heroSection.classList.add("is-static");
    cueEl?.remove();
    return;
  }

  const isMobile = window.matchMedia("(max-width: 640px)").matches;
  const trailCount = isMobile ? 3 : 6;
  const sparkCount = isMobile ? 14 : 26;
  const boardTextureSize = isMobile ? 640 : 1024;
  const dprCap = isMobile ? 1.5 : 2;
  const pinEnd = isMobile ? "+=220%" : "+=280%";

  // iOS-Adressleisten-Resize soll ScrollTrigger nicht zu Sprüngen verleiten.
  ScrollTrigger.config({ ignoreMobileResize: true });

  // ---- Textzeilen für den Buchstaben-Stagger-Reveal aufteilen ----
  const splits = splitLineEls.map((el) => new SplitText(el, { type: "chars", charsClass: "char" }));
  const allChars = splits.flatMap((s) => s.chars);

  gsap.set(allChars, { opacity: 0, yPercent: 65, rotateX: -50, transformOrigin: "50% 100%" });
  gsap.set([eyebrowEl, taglineEl, ctaEl].filter(Boolean), { opacity: 0, y: 14 });

  const revealTl = gsap.timeline({ paused: true });
  revealTl
    .to(allChars, {
      opacity: 1,
      yPercent: 0,
      rotateX: 0,
      duration: 1,
      ease: "power3.out",
      stagger: { each: 0.022, from: "start" },
    })
    .to(eyebrowEl, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "<0.1")
    .to(taglineEl, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.55")
    .to(ctaEl, { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.6)" }, "-=0.35");

  // ---- Three.js-Szene ----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV_DEG, 1, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
  canvasWrap.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xfff3d6, 1.1);
  key.position.set(2, 2, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcda434, 0.6);
  rim.position.set(-2, -1, -2);
  scene.add(rim);

  const { texture, canvas: boardCanvas } = createDartboardTexture(boardTextureSize);
  const boardMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_SIZE, BOARD_SIZE), boardMat);
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
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_SIZE * 2.2, BOARD_SIZE * 2.2), glowMat);
  glow.position.z = -0.3;
  scene.add(glow);

  const dart = createDart();
  scene.add(dart);

  const trailPool = createTrailPool(trailCount);
  trailPool.forEach((m) => scene.add(m));

  const sparkTexture = createGlowSpriteTexture();
  const sparks: SparkBurst = createSparkBurst(sparkCount, sparkTexture);
  scene.add(sparks.points);

  const shockwave = createShockwaveRing();
  scene.add(shockwave);

  const HIGHLIGHT: Highlight = { sectorValue: 20, ring: "triple" };
  const hit2D = pointForHighlight(HIGHLIGHT);
  const boardHalf = BOARD_SIZE / 2;
  const hitWorld = new THREE.Vector3(hit2D.x * boardHalf, hit2D.y * boardHalf, 0.03);

  const P0 = new THREE.Vector3(1.9, -1.6, 3.4);
  const P1 = new THREE.Vector3(1.0, 0.3, 1.6);
  const P2 = new THREE.Vector3(0.25, hitWorld.y + 0.5, 0.6);
  const P3 = hitWorld.clone();

  const tmpPos = new THREE.Vector3();
  const tmpTangent = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();

  let highlightIntensity = 0;
  let lastDrawnIntensity = -1;
  let baseCameraDistance = 5;

  // "Contain"-Fit: sorgt dafür, dass die Scheibe auch auf schmalen
  // Hochkant-Viewports (Handy) nicht seitlich abgeschnitten wird.
  function fitCameraDistance(aspect: number): number {
    const halfV = Math.tan((BASE_FOV_DEG * Math.PI) / 360);
    const targetSpan = BOARD_SIZE * 1.55;
    const distForHeight = targetSpan / (2 * halfV);
    const distForWidth = targetSpan / (2 * halfV * Math.max(aspect, 0.0001));
    return Math.max(distForHeight, distForWidth, 3.2);
  }

  function applySize() {
    const w = canvasWrap!.clientWidth;
    const h = Math.max(canvasWrap!.clientHeight, 1);
    camera.aspect = w / h;
    baseCameraDistance = fitCameraDistance(w / h);
    camera.position.z = baseCameraDistance;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  applySize();

  function render(progress: number) {
    let shakeX = 0;
    let shakeRotZ = 0;
    let impactPulse = 0;
    let cameraPunch = 0;

    if (progress <= FLIGHT_END) {
      const t = easeFlight(clamp01(progress / FLIGHT_END));
      cubicBezier(t, P0, P1, P2, P3, tmpPos);
      cubicBezierTangent(t, P0, P1, P2, P3, tmpTangent).normalize();
      dart.position.copy(tmpPos);
      tmpTarget.copy(tmpPos).add(tmpTangent);
      dart.lookAt(tmpTarget);
      dart.rotation.z += Math.sin(t * Math.PI * 2) * 0.15 * (1 - t);
      highlightIntensity = 0;

      // Bewegungsspur: Geister-Darts an leicht früheren t-Werten entlang der Kurve.
      for (let i = 0; i < trailPool.length; i++) {
        const ghost = trailPool[i];
        const lag = (i + 1) * 0.028;
        const gt = clamp01(t - lag);
        if (gt <= 0.001 || t < 0.03) {
          ghost.visible = false;
          continue;
        }
        cubicBezier(gt, P0, P1, P2, P3, tmpPos);
        ghost.position.copy(tmpPos);
        cubicBezierTangent(gt, P0, P1, P2, P3, tmpTarget).normalize();
        ghost.lookAt(tmpPos.clone().add(tmpTarget));
        const fade = 1 - i / trailPool.length;
        (ghost.material as THREE.MeshBasicMaterial).opacity = fade * 0.35 * (1 - t * 0.3);
        ghost.visible = true;
      }
    } else {
      dart.position.copy(P3);
      tmpTarget.copy(P3).add(EMBED_DIR);
      dart.lookAt(tmpTarget);
      trailPool.forEach((ghost) => (ghost.visible = false));

      const shakeP = clamp01((progress - FLIGHT_END) / (IMPACT_PEAK - FLIGHT_END));
      const decay = 1 - shakeP;
      shakeX = Math.sin(shakeP * Math.PI * 6) * 0.02 * decay;
      shakeRotZ = shakeX * 0.4;
      impactPulse = Math.sin(shakeP * Math.PI) * 0.02;
      cameraPunch = Math.sin(shakeP * Math.PI) * 0.18 * easeOut2(1 - shakeP * 0.3);
      highlightIntensity = Math.sin(clamp01((progress - FLIGHT_END) / (IMPACT_END - FLIGHT_END)) * Math.PI);

      // Funken + Schockwelle, nur innerhalb des kurzen Impact-Fensters aktiv.
      const impactLocal = clamp01((progress - FLIGHT_END) / (IMPACT_END - FLIGHT_END));
      if (impactLocal > 0 && impactLocal < 1) {
        updateSparkBurst(sparks, hitWorld, impactLocal);
        sparks.points.visible = true;
        sparks.material.opacity = Math.sin(impactLocal * Math.PI) * 0.9;

        shockwave.visible = true;
        shockwave.position.copy(hitWorld);
        const ringScale = 0.3 + impactLocal * 2.2;
        shockwave.scale.setScalar(ringScale);
        (shockwave.material as THREE.MeshBasicMaterial).opacity = (1 - impactLocal) * 0.8;
      } else {
        sparks.points.visible = false;
        shockwave.visible = false;
      }
    }

    // Board-Textur nur neu zeichnen, wenn sich das Highlight sichtbar ändert –
    // spart auf Mobilgeräten unnötige Canvas-Redraws bei jedem Scroll-Tick.
    if (Math.abs(highlightIntensity - lastDrawnIntensity) > 0.004) {
      drawDartboard(boardCanvas, { highlight: HIGHLIGHT, highlightIntensity });
      texture.needsUpdate = true;
      lastDrawnIntensity = highlightIntensity;
    }

    const revealP = clamp01((progress - IMPACT_END) / (1 - IMPACT_END));
    const revealEase = easeReveal(revealP);
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

    camera.position.z = baseCameraDistance - cameraPunch;
    camera.position.x = shakeX * 0.4;

    if (flashEl) {
      const flashP = Math.max(0, 1 - Math.abs(progress - IMPACT_PEAK) / 0.05);
      flashEl.style.opacity = String(Math.pow(flashP, 2) * 0.9);
    }
    revealTl.progress(revealEase);
    if (cueEl) {
      cueEl.style.opacity = String(1 - clamp01(progress / 0.08));
    }

    renderer.render(scene, camera);
  }

  render(0);

  ScrollTrigger.create({
    trigger: heroSection,
    start: "top top",
    end: pinEnd,
    pin: true,
    scrub: 0.6,
    anticipatePin: 1,
    onUpdate: (self) => render(self.progress),
  });

  let resizeTimer: number | undefined;
  function handleResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      applySize();
      ScrollTrigger.refresh();
    }, 120);
  }
  window.addEventListener("resize", handleResize);
}
