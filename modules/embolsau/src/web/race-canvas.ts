import type { Animal } from '../model';
import { BAGS } from './art';
import { feetOf } from './sprite-feet';
import { behindCount, between, cameraX, laneOf, RENDER_DELAY_MS, smoothCamera, VIEW_METERS, type RunnerView } from './camera';

/** The drawing works in a 1280×720 frame; the canvas scales it to its real size. */
export const FRAME = { width: 1280, height: 720 };
/** Base sprite size, chosen with the mockups (about 75 m in view). */
const SIZE = 28;
/** The square picture is this many times SIZE wide; FEET is where its feet are until it is measured. */
const ART_SCALE = 3;
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
    /** The two latest standings: the race is drawn a little in the past, gliding between them. */
    prev: RunnerView[];
    next: RunnerView[];
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
  const runners = between(input.prev, input.next, now - RENDER_DELAY_MS, trackMeters);
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
  if (finish < w + 20) {
    for (let y = top, i = 0; y < bottom; y += 12, i++) {
      ctx.fillStyle = i % 2 ? COLORS.blanco : '#000';
      ctx.fillRect(finish - 6, y, 12, 12);
    }
  }

  // Runners, from the back of the crowd to the front.
  const visible = runners.filter((r) => toX(r.meters) > -SIZE * 2).sort((a, b) => laneOf(a.id) - laneOf(b.id));
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
    if (r.place <= 3) {
      ctx.fillStyle = COLORS.blanco;
      ctx.font = `bold ${Math.round(Math.max(16, s * 0.7))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(r.nickname, x, y - hop - box * feetOf(img, FEET) - 4);
      ctx.textAlign = 'left';
    }
  }

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

  // Leaders.
  const top3 = [...runners].sort((a, b) => a.place - b.place).slice(0, 3);
  ctx.fillStyle = 'rgba(26,14,46,0.88)';
  ctx.beginPath();
  ctx.roundRect(w - 300, 14, 284, 34 + top3.length * 30, 12);
  ctx.fill();
  ctx.fillStyle = COLORS.sol;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(labels.leaders, w - 284, 42);
  ctx.fillStyle = COLORS.blanco;
  ctx.font = '20px sans-serif';
  top3.forEach((r, i) => ctx.fillText(`${r.place}. ${r.nickname}`, w - 284, 72 + i * 30));

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
    ctx.arc(sx(r.meters), sy - 16 + laneOf(r.id) * 32, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
