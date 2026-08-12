import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * Erzeugt eine Dartscheibe als Canvas-Textur – kein Bild-Asset nötig.
 * Kreisfläche ist deckend, der Rest des Canvas bleibt transparent, damit
 * das Plane-Mesh in Three.js wie eine runde Scheibe wirkt.
 *
 * Proportionen orientieren sich an einer echten Steel-Dart-Wettkampfscheibe
 * (Bull/Single/Triple/Single/Double etwa im Verhältnis 6:94:8:53:8 der
 * Spielfläche). Der Zahlenkranz sitzt als eigener, spürbar breiter Ring
 * außerhalb des Doubles – vorher lagen die Zahlen zu nah am goldenen Rand
 * und wurden davon angeschnitten.
 */

export const SECTOR_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

export const SEGMENT_ANGLE = (Math.PI * 2) / 20;

// Ring-Radien als Anteil des Canvas-Radius R.
export const RINGS = {
  bullInner: 0.038,
  bullOuter: 0.095,
  tripleInner: 0.44,
  tripleOuter: 0.49,
  doubleInner: 0.7,
  doubleOuter: 0.75,
  numbersInner: 0.78,
  numbersOuter: 0.93,
  wire: 0.965,
};

const COLOR_RED = "#c8202c";
const COLOR_GREEN = "#0e7a45";
const COLOR_BLACK = "#141216";
const COLOR_CREAM = "#efe6cd";
const COLOR_GOLD = "#cda434";
const COLOR_GOLD_BRIGHT = "#e8c766";
const COLOR_GOLD_DARK = "#8a6a1f";

export interface Highlight {
  sectorValue: number;
  ring: "triple" | "double" | "single" | "bull";
}

/** Winkel (Canvas-Koordinaten, 0 = rechts, im Uhrzeigersinn) für die Mitte eines Sektors. */
export function sectorCenterAngle(index: number): number {
  return -Math.PI / 2 + index * SEGMENT_ANGLE;
}

export function sectorIndexForValue(value: number): number {
  return SECTOR_ORDER.indexOf(value as (typeof SECTOR_ORDER)[number]);
}

/** Weltkoordinaten (x, y in [-1, 1]) für die Mitte eines Rings innerhalb eines Sektors. */
export function pointForHighlight(h: Highlight): { x: number; y: number } {
  const index = sectorIndexForValue(h.sectorValue);
  const angle = sectorCenterAngle(index);
  const radiusMap = {
    triple: (RINGS.tripleInner + RINGS.tripleOuter) / 2,
    double: (RINGS.doubleInner + RINGS.doubleOuter) / 2,
    single: (RINGS.bullOuter + RINGS.tripleInner) / 2,
    bull: RINGS.bullInner / 2,
  };
  const r = radiusMap[h.ring];
  // Canvas-Winkel sind Y-nach-unten; die Three.js-Weltachse ist Y-nach-oben,
  // daher hier das Vorzeichen von y umkehren.
  return { x: Math.cos(angle) * r, y: -Math.sin(angle) * r };
}

function drawWedge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  innerFrac: number,
  outerFrac: number,
  startAngle: number,
  endAngle: number,
  color: string
) {
  ctx.beginPath();
  ctx.arc(cx, cy, R * outerFrac, startAngle, endAngle);
  ctx.arc(cx, cy, R * innerFrac, endAngle, startAngle, true);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawDartboard(
  canvas: HTMLCanvasElement,
  opts: { highlight?: Highlight | null; highlightIntensity?: number } = {}
) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Schwarzer Grundkörper bis knapp unter den Golddraht (Zahlenkranz-Fläche).
  ctx.beginPath();
  ctx.arc(cx, cy, R * RINGS.wire, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_BLACK;
  ctx.fill();

  for (let i = 0; i < 20; i++) {
    const start = sectorCenterAngle(i) - SEGMENT_ANGLE / 2;
    const end = sectorCenterAngle(i) + SEGMENT_ANGLE / 2;
    const isEven = i % 2 === 0;
    const singleColor = isEven ? COLOR_BLACK : COLOR_CREAM;
    const ringColor = isEven ? COLOR_RED : COLOR_GREEN;

    drawWedge(ctx, cx, cy, R, RINGS.bullOuter, RINGS.tripleInner, start, end, singleColor);
    drawWedge(ctx, cx, cy, R, RINGS.tripleInner, RINGS.tripleOuter, start, end, ringColor);
    drawWedge(ctx, cx, cy, R, RINGS.tripleOuter, RINGS.doubleInner, start, end, singleColor);
    drawWedge(ctx, cx, cy, R, RINGS.doubleInner, RINGS.doubleOuter, start, end, ringColor);
  }

  // Bull
  ctx.beginPath();
  ctx.arc(cx, cy, R * RINGS.bullOuter, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_GREEN;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, R * RINGS.bullInner, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_RED;
  ctx.fill();

  // Trennlinien ("Spider") – vom Bull bis zum äußeren Rand des Doubles,
  // etwas kräftiger als zuvor für einen echten Drahtgitter-Look.
  ctx.strokeStyle = "rgba(15,14,17,0.95)";
  ctx.lineWidth = size * 0.0026;
  for (let i = 0; i < 20; i++) {
    const angle = sectorCenterAngle(i) - SEGMENT_ANGLE / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * R * RINGS.bullOuter, cy + Math.sin(angle) * R * RINGS.bullOuter);
    ctx.lineTo(cx + Math.cos(angle) * R * RINGS.doubleOuter, cy + Math.sin(angle) * R * RINGS.doubleOuter);
    ctx.stroke();
  }
  // Dünner Ring exakt am Rand von Triple- und Double-Zone, wie das
  // umlaufende Drahtband auf echten Scheiben.
  ctx.strokeStyle = "rgba(15,14,17,0.9)";
  ctx.lineWidth = size * 0.0018;
  for (const ringFrac of [RINGS.bullOuter, RINGS.tripleInner, RINGS.tripleOuter, RINGS.doubleInner, RINGS.doubleOuter]) {
    ctx.beginPath();
    ctx.arc(cx, cy, R * ringFrac, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Zahlenkranz – eigener, breiter schwarzer Ring außerhalb des Doubles,
  // damit die Ziffern nicht mehr mit dem Golddraht kollidieren.
  ctx.fillStyle = COLOR_CREAM;
  ctx.font = `700 ${Math.round(size * 0.052)}px Oswald, Arial Narrow, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const numbersRadius = R * ((RINGS.numbersInner + RINGS.numbersOuter) / 2);
  SECTOR_ORDER.forEach((value, i) => {
    const angle = sectorCenterAngle(i);
    ctx.fillText(String(value), cx + Math.cos(angle) * numbersRadius, cy + Math.sin(angle) * numbersRadius);
  });

  // Golddraht-Kontur: zwei feine Linien für einen leichten Metall-Bevel
  // statt einer flachen einzelnen Linie.
  ctx.beginPath();
  ctx.arc(cx, cy, R * RINGS.wire, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR_GOLD_DARK;
  ctx.lineWidth = size * 0.009;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R * RINGS.wire - size * 0.0025, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR_GOLD_BRIGHT;
  ctx.lineWidth = size * 0.0035;
  ctx.stroke();

  // Highlight (z. B. Triple-20 beim Einschlag)
  const intensity = opts.highlightIntensity ?? 0;
  if (opts.highlight && intensity > 0.001) {
    const index = sectorIndexForValue(opts.highlight.sectorValue);
    const start = sectorCenterAngle(index) - SEGMENT_ANGLE / 2;
    const end = sectorCenterAngle(index) + SEGMENT_ANGLE / 2;
    const ringBounds: Record<Highlight["ring"], [number, number]> = {
      triple: [RINGS.tripleInner, RINGS.tripleOuter],
      double: [RINGS.doubleInner, RINGS.doubleOuter],
      single: [RINGS.bullOuter, RINGS.tripleInner],
      bull: [0, RINGS.bullInner],
    };
    const [inner, outer] = ringBounds[opts.highlight.ring];

    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.shadowColor = COLOR_GOLD;
    ctx.shadowBlur = size * 0.05 * intensity;
    drawWedge(ctx, cx, cy, R, inner, outer, start, end, "rgba(232,199,102,0.55)");
    ctx.lineWidth = size * 0.01;
    ctx.strokeStyle = COLOR_GOLD;
    ctx.beginPath();
    ctx.arc(cx, cy, R * outer, start, end);
    ctx.arc(cx, cy, R * inner, end, start, true);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

export function createDartboardTexture(size = 1024): { texture: CanvasTexture; canvas: HTMLCanvasElement } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  drawDartboard(canvas);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, canvas };
}
