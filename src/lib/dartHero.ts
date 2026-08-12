import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  type Material,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { createDartboardTexture, drawDartboard, pointForHighlight, type Highlight } from "./dartboard";
import { createDart, createTrailPool, cubicBezier, cubicBezierTangent } from "./dart";
import { createGlowSpriteTexture, createSparkBurst, updateSparkBurst, createShockwaveRing, type SparkBurst } from "./impactEffects";

gsap.registerPlugin(ScrollTrigger, SplitText);

const FLIGHT_END = 0.5;
const IMPACT_PEAK = 0.58;
const IMPACT_END = 0.66;
const EMBED_DIR = new Vector3(0, 0, -1);
const BASE_FOV_DEG = 42;
const BOARD_SIZE = 3.2;

// GSAP-Easing-Kurven statt handgestrickter Funktionen – konsistent mit dem
// Rest des GSAP-Setups und angenehmer in der Bewegung. "power1.out" statt
// eines ein-/ausschwingenden Easings, damit der Pfeil schon bei wenig Scroll
// sichtbar in Bewegung kommt statt erst langsam anzulaufen.
const easeFlight = gsap.parseEase("power1.out");
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
  const scene = new Scene();
  const camera = new PerspectiveCamera(BASE_FOV_DEG, 1, 0.1, 100);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
  canvasWrap.appendChild(renderer.domElement);

  scene.add(new AmbientLight(0xffffff, 0.55));
  const key = new DirectionalLight(0xfff3d6, 1.1);
  key.position.set(2, 2, 4);
  scene.add(key);
  const rim = new DirectionalLight(0xcda434, 0.6);
  rim.position.set(-2, -1, -2);
  scene.add(rim);

  const { texture, canvas: boardCanvas } = createDartboardTexture(boardTextureSize);
  const boardMat = new MeshBasicMaterial({ map: texture, transparent: true });
  const board = new Mesh(new PlaneGeometry(BOARD_SIZE, BOARD_SIZE), boardMat);
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
  const glowTex = new CanvasTexture(glowCanvas);
  const glowMat = new MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false });
  const glow = new Mesh(new PlaneGeometry(BOARD_SIZE * 2.2, BOARD_SIZE * 2.2), glowMat);
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
  const hitWorld = new Vector3(hit2D.x * boardHalf, hit2D.y * boardHalf, 0.03);

  const P0 = new Vector3(1.9, -1.6, 3.4);
  const P1 = new Vector3(1.0, 0.3, 1.6);
  const P2 = new Vector3(0.25, hitWorld.y + 0.5, 0.6);
  const P3 = hitWorld.clone();

  const tmpPos = new Vector3();
  const tmpTangent = new Vector3();
  const tmpTarget = new Vector3();

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
      // Defensiv zurücksetzen, falls z. B. beim Zurückscrollen aus der
      // Impact-Phase heraus – sonst blieben Funken/Schockwelle eingefroren.
      sparks.points.visible = false;
      shockwave.visible = false;

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
        (ghost.material as MeshBasicMaterial).opacity = fade * 0.35 * (1 - t * 0.3);
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

      // Knackige Auf/Ab-Kurve (statt breitem Sinus-Plateau), damit der Glow
      // wie ein kurzer Flash wirkt statt wie ein Dauerzustand, in dem man
      // beim Anhalten "hängen bleibt".
      const impactLocal = clamp01((progress - FLIGHT_END) / (IMPACT_END - FLIGHT_END));
      const impactShape = Math.pow(Math.sin(impactLocal * Math.PI), 2.2);
      highlightIntensity = impactShape;

      if (impactLocal > 0 && impactLocal < 1) {
        updateSparkBurst(sparks, hitWorld, impactLocal);
        sparks.points.visible = true;
        sparks.material.opacity = Math.pow(Math.sin(impactLocal * Math.PI), 1.5) * 0.9;

        shockwave.visible = true;
        shockwave.position.copy(hitWorld);
        const ringScale = 0.3 + impactLocal * 2.2;
        shockwave.scale.setScalar(ringScale);
        (shockwave.material as MeshBasicMaterial).opacity = impactShape * 0.8;
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
      const mesh = obj as Mesh;
      const mat = mesh.material as Material | undefined;
      if (mat) mat.opacity = boardOpacity;
    });

    camera.position.z = baseCameraDistance - cameraPunch;
    camera.position.x = shakeX * 0.4;

    if (flashEl) {
      const flashP = Math.max(0, 1 - Math.abs(progress - IMPACT_PEAK) / 0.035);
      flashEl.style.opacity = String(Math.pow(flashP, 2) * 0.9);
    }
    revealTl.progress(revealEase);
    if (cueEl) {
      cueEl.style.opacity = String(1 - clamp01(progress / 0.08));
    }

    renderer.render(scene, camera);
  }

  render(0);

  // Kein `pin: true` mehr: Die äußere Sektion reserviert ihre Scroll-Strecke
  // bereits per CSS (siehe DartHero.astro), die innere ".dart-hero__sticky"
  // bleibt rein über `position: sticky` im Viewport. So muss GSAP nichts
  // nachträglich in den Layout-Fluss einfügen – kein Sprung, egal wie spät
  // dieses Skript auf langsamen Verbindungen lädt. "bottom bottom" ergibt
  // automatisch dieselbe Scroll-Distanz wie die per CSS reservierte Höhe.
  const trigger = ScrollTrigger.create({
    trigger: heroSection,
    start: "top top",
    end: "bottom bottom",
    scrub: 0.6,
    onUpdate: (self) => render(self.progress),
  });

  // Sicherheitshalber trotzdem hart auf den tatsächlichen Fortschritt
  // synchronisieren, sobald der Trigger existiert (z. B. falls die Seite
  // beim Skriptstart schon mitten in der reservierten Scroll-Strecke steht).
  render(trigger.progress);

  let resizeTimer: number | undefined;
  function handleResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      applySize();
      ScrollTrigger.refresh();
      render(trigger.progress);
    }, 120);
  }
  window.addEventListener("resize", handleResize);

  // Sicherheitsnetz für langsame Mobilgeräte/Verbindungen: Dieses Skript ist
  // groß (Three.js + GSAP) und kann erst laufen, NACHDEM Nutzer:innen schon
  // losgescrollt haben. Außerdem verändern iOS/Android die sichtbare Höhe
  // (Adressleiste) oft erst nach dem ersten Layout, und Web-Fonts können die
  // Header-Höhe nachträglich verschieben. Mehrfach kurz nach dem Start
  // nachjustieren und dabei IMMER auf den echten Scroll-Fortschritt
  // synchronisieren, statt bei einem veralteten Frame hängen zu bleiben.
  function resync() {
    applySize();
    ScrollTrigger.refresh();
    render(trigger.progress);
  }
  window.addEventListener("load", resync, { once: true });
  [100, 400, 900, 1800].forEach((delay) => window.setTimeout(resync, delay));
}
