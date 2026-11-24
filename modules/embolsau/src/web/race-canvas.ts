import type { Animal } from '../model';
import { BAGS } from './art';
import { feetOf, headOf } from './sprite-feet';
import { behindCount, cameraX, laneOf, RENDER_DELAY_MS, sampleAt, smoothCamera, VIEW_METERS, type Snapshot } from './camera';

/** The drawing works in a 1280×720 frame; the canvas scales it to its real size. */
export const FRAME = { width: 1280, height: 720 };
/** Base sprite size, chosen with the mockups (about 75 m in view). */
const SIZE = 28;
/** The square picture is this many times SIZE wide; FEET is where its feet are until it is measured. */
const ART_SCALE = 3;
/** Runners whose names show over their heads. */
const NAMED_PLACES = 10;
const PODIUM = 3;

/** Whether a place shows its name over the runner, and whether it is a podium place. */
export function nameTag(place: number): { podium: boolean } | null {
  return place <= NAMED_PLACES ? { podium: place <= PODIUM } : null;
}

/** Where a runner is drawn: finishers stop 1.5–6.5 m past the line (by crowd depth), never on it. */
export function drawnMeters(r: { id: string; meters: number; finished: boolean }, trackMeters: number): number {
  return r.finished ? trackMeters + 1.5 + laneOf(r.id) * 5 : r.meters;
}

/**
 * The finish line: a two-column checkerboard straddling the line at `x`, white at the top-left,
 * black at the top-right, then the other way round on every row.
 */
export function finishSquares(x: number, top: number, bottom: number, size: number) {
  const squares: { x: number; y: number; w: number; h: number; color: 'white' | 'black' }[] = [];
  for (let row = 0, y = top; y < bottom; row++, y += size) {
    for (const col of [0, 1]) {
      squares.push({ x: x - size + col * size, y, w: size, h: Math.min(size, bottom - y), color: (row + col) % 2 === 0 ? 'white' : 'black' });
    }
  }
  return squares;
}

/** A name tag's box: (x, y) is its top-left corner. */
export interface TagBox {
  place: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: TagBox, b: TagBox) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Lays out name tags so they don't cover each other: better places first; a tag that would land
 * on another moves up a notch (twice at most); if there is still no room, a podium tag shows anyway
 * and any other is left out for this frame.
 */
export function placeTags(tags: TagBox[]): TagBox[] {
  const placed: TagBox[] = [];
  for (const tag of [...tags].sort((a, b) => a.place - b.place)) {
    let spot: TagBox | null = null;
    for (let notch = 0; notch <= 2 && !spot; notch++) {
      const candidate = { ...tag, y: tag.y - notch * tag.h };
      if (!placed.some((p) => overlaps(p, candidate))) spot = candidate;
    }
    if (spot) placed.push(spot);
    else if (tag.place <= PODIUM) placed.push(tag);
  }
  return placed;
}
const FEET = 0.96;

export interface RaceLabels {
  behind: (n: number) => string;
  leaders: string;
  all: string;
  bump: string;
  closing: (seconds: number) => string | null;
}

export type Sprites = Record<Animal, { run: HTMLImageElement; down: HTMLImageElement }>;

const COLORS = { noche: '#1A0E2E', pista: '#2B1A47', linea: '#3D2A5C', niebla: '#CFC3E6', sol: '#FFC629', tajibo: '#D63A72', blanco: '#FFFFFF' };

/** One frame of the race: the crowd near the leaders, the counter of who fell behind, the strip with everybody. */
export function drawRace(
  ctx: CanvasRenderingContext2D,
  input: {
    /** The latest standings, oldest first: the race is drawn a little in the past, gliding between them. */
    history: Snapshot[];
    now: number;
    trackMeters: number;
    closingLeftMs: number | null;
    sprites: Sprites;
    labels: RaceLabels;
    /** Camera state kept between frames, so it follows smoothly. */
    camera: { x: number; at: number };
  },
) {
  const { width: w, height: h } = FRAME;
  const { now, trackMeters, sprites, labels } = input;
  const runners = sampleAt(input.history, now - RENDER_DELAY_MS, trackMeters).map((r) => ({ ...r, meters: drawnMeters(r, trackMeters) }));
  ctx.clearRect(0, 0, w, h);

  const leader = runners.reduce((m, r) => Math.max(m, r.meters), 0);
  const target = cameraX(leader, trackMeters);
  const cam = input.camera;
  cam.x = cam.at === 0 ? target : smoothCamera(cam.x, target, now - cam.at);
  cam.at = now;
  const camX = cam.x;
  const toX = (m: number) => ((m - camX) / VIEW_METERS) * w;
  const top = 90;
  const bottom = h - 130;

  // Track, a line every 10 m, and the finish line.
  ctx.fillStyle = COLORS.pista;
  ctx.fillRect(0, top, w, bottom - top);
  ctx.strokeStyle = COLORS.linea;
  ctx.lineWidth = 2;
  ctx.font = '14px sans-serif';
  for (let m = 0; m <= trackMeters; m += 10) {
    const x = toX(m);
    if (x < -10 || x > w + 10) continue;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.fillStyle = COLORS.niebla;
    ctx.fillText(`${m} m`, x + 4, bottom + 18);
  }
  const finish = toX(trackMeters);
  if (finish < w + 40) {
    for (const sq of finishSquares(finish, top, bottom, 20)) {
      ctx.fillStyle = sq.color === 'white' ? COLORS.blanco : '#000';
      ctx.fillRect(sq.x, sq.y, sq.w, sq.h);
    }
  }

  // Runners, from the back of the crowd to the front.
  const visible = runners.filter((r) => toX(r.meters) > -SIZE * 2).sort((a, b) => laneOf(a.id) - laneOf(b.id));
  const names: { text: string; x: number; y: number; podium: boolean; s: number; place: number }[] = [];
  for (const r of visible) {
    const lane = laneOf(r.id);
    const s = SIZE * (0.7 + 0.45 * lane);
    const x = toX(r.meters);
    const y = top + SIZE * 3 + lane * (bottom - top - SIZE * 3);
    const hop = r.down || r.finished ? 0 : Math.abs(Math.sin(now / 110 + lane * 20)) * s * 0.5;
    // The player's color: a shadow on the ground (it stays put while the critter hops).
    ctx.fillStyle = BAGS[r.bag % BAGS.length]!;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(x, y, s * (r.down ? 1.3 : 0.9), s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // The critter with its sack; the fallen picture is already drawn lying down.
    const img = r.down ? sprites[r.animal].down : sprites[r.animal].run;
    const box = s * ART_SCALE;
    const feet = feetOf(img, FEET);
    if (img.complete) ctx.drawImage(img, x - box / 2, y - hop - box * feet, box, box);
    if (r.down) {
      ctx.fillStyle = COLORS.sol;
      ctx.font = `bold ${Math.round(s * 0.8)}px sans-serif`;
      ctx.fillText(labels.bump, x + s * 0.8, y - box * 0.7);
    }
    const tag = nameTag(r.place);
    if (tag) names.push({ text: r.nickname, x, y: y - hop - box * (feet - headOf(img, 0)) - 6, podium: tag.podium, s, place: r.place });
  }

  // Names of the top 10, over everybody, on a dark tag so they read in the crowd; the podium on top.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const fontOf = (n: (typeof names)[number]) => Math.round(Math.max(n.podium ? 18 : 14, n.s * (n.podium ? 0.75 : 0.6)));
  const boxes = names.map((n, i) => {
    const size = fontOf(n);
    ctx.font = `bold ${size}px sans-serif`;
    const w = ctx.measureText(n.text).width + 12;
    return { place: n.place, x: n.x - w / 2, y: n.y - size - 6, w, h: size + 8, i };
  });
  // Podium drawn last so it stays on top of the rest.
  for (const box of placeTags(boxes).reverse()) {
    const n = names[(box as (typeof boxes)[number]).i]!;
    const size = fontOf(n);
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillStyle = 'rgba(26,14,46,0.75)';
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 6);
    ctx.fill();
    ctx.fillStyle = n.podium ? COLORS.sol : COLORS.blanco;
    ctx.fillText(n.text, box.x + box.w / 2, box.y + box.h - 2);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Who fell behind the view.
  const behind = behindCount(runners, camX - (SIZE * 2 * VIEW_METERS) / w);
  if (behind > 0) {
    ctx.fillStyle = COLORS.tajibo;
    ctx.beginPath();
    ctx.roundRect(16, 20, 340, 48, 12);
    ctx.fill();
    ctx.fillStyle = COLORS.blanco;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`← ${labels.behind(behind)}`, 32, 52);
  }

  // Leaders: one line in the top band, so the box never hides runners (or the leader's name).
  const top3 = [...runners].sort((a, b) => a.place - b.place).slice(0, 3);
  const short = (name: string) => (name.length > 12 ? `${name.slice(0, 11)}…` : name);
  const leadersText = top3.map((r) => `${r.place}. ${short(r.nickname)}`).join('   ');
  ctx.font = '22px sans-serif';
  const listWidth = ctx.measureText(leadersText).width;
  ctx.font = 'bold 22px sans-serif';
  const titleWidth = ctx.measureText(labels.leaders).width;
  const boxWidth = titleWidth + listWidth + 52;
  ctx.fillStyle = 'rgba(26,14,46,0.88)';
  ctx.beginPath();
  ctx.roundRect(w - 16 - boxWidth, 20, boxWidth, 48, 12);
  ctx.fill();
  ctx.fillStyle = COLORS.sol;
  ctx.fillText(labels.leaders, w - boxWidth, 52);
  ctx.fillStyle = COLORS.blanco;
  ctx.font = '22px sans-serif';
  ctx.fillText(leadersText, w - boxWidth + titleWidth + 20, 52);

  const closing = input.closingLeftMs === null ? null : labels.closing(Math.ceil(input.closingLeftMs / 1000));
  if (closing) {
    ctx.fillStyle = COLORS.sol;
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(closing, w / 2, 60);
    ctx.textAlign = 'left';
  }

  // The strip with everybody, and the part the camera shows.
  const sy = h - 60;
  const sx = (m: number) => 24 + (m / trackMeters) * (w - 48);
  ctx.fillStyle = COLORS.niebla;
  ctx.font = '16px sans-serif';
  ctx.fillText(labels.all, 24, sy - 30);
  ctx.fillStyle = COLORS.pista;
  ctx.fillRect(24, sy - 22, w - 48, 44);
  ctx.strokeStyle = COLORS.sol;
  ctx.lineWidth = 2;
  ctx.strokeRect(sx(camX), sy - 22, sx(camX + VIEW_METERS) - sx(camX), 44);
  for (const r of runners) {
    ctx.fillStyle = r.down ? COLORS.blanco : BAGS[r.bag % BAGS.length]!;
    ctx.beginPath();
    ctx.arc(sx(Math.min(r.meters, trackMeters)), sy - 16 + laneOf(r.id) * 32, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
