/**
 * Genere les icones PWA du jeu.
 *
 * Le projet n'embarque aucun asset dessine a la main : les textures du jeu
 * sortent de BootScene, les sons de WebAudio, et les icones de ce script.
 * Les PNG produits sont commites (un manifest ne peut pas pointer vers du
 * code), mais ils restent reproductibles : `npm run icons` les regenere.
 *
 * Usage : node scripts/make-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');

// Palette, alignee sur src/game/theme.ts et src/index.css.
const BG = [0x0d, 0x1a, 0x14];
const GRASS = [0x2f, 0x6b, 0x46];
const GRASS_DARK = [0x26, 0x5c, 0x3b];
const GOLD = [0xf2, 0xc1, 0x4e];
const GOLD_LIGHT = [0xff, 0xee, 0xb8];
const GOLD_DARK = [0x8a, 0x6b, 0x12];
const BLUE = [0x4a, 0x90, 0xe2];
const RED = [0xe2, 0x56, 0x4a];

// --------------------------------------------------------------- rasterisation

/**
 * Un canevas RGBA minimal. Chaque forme est decrite par un predicat
 * "ce point est-il dedans ?", echantillonne 3x3 par pixel : c'est ce qui donne
 * des bords lisses sans dependre d'une bibliotheque de rendu.
 */
class Canvas {
  constructor(size) {
    this.size = size;
    this.data = new Uint8ClampedArray(size * size * 4);
  }

  /** Composite une couleur sur un pixel, en tenant compte de sa couverture. */
  blend(x, y, [r, g, b], alpha) {
    if (alpha <= 0) return;
    const i = (y * this.size + x) * 4;
    const dstA = this.data[i + 3] / 255;
    const outA = alpha + dstA * (1 - alpha);
    if (outA <= 0) return;

    for (let c = 0; c < 3; c += 1) {
      const src = [r, g, b][c];
      this.data[i + c] = (src * alpha + this.data[i + c] * dstA * (1 - alpha)) / outA;
    }
    this.data[i + 3] = outA * 255;
  }

  fill(inside, color, alpha = 1) {
    const samples = 3;
    const step = 1 / (samples + 1);

    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        let hits = 0;
        for (let sy = 1; sy <= samples; sy += 1) {
          for (let sx = 1; sx <= samples; sx += 1) {
            if (inside(x + sx * step, y + sy * step)) hits += 1;
          }
        }
        if (hits > 0) this.blend(x, y, color, (alpha * hits) / (samples * samples));
      }
    }
  }
}

const rect = (x, y, w, h) => (px, py) => px >= x && px <= x + w && py >= y && py <= y + h;

const circle = (cx, cy, r) => (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r;

const roundedRect = (x, y, w, h, r) => (px, py) => {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const dx = Math.max(x + r - px, 0, px - (x + w - r));
  const dy = Math.max(y + r - py, 0, py - (y + h - r));
  return dx * dx + dy * dy <= r * r;
};

/** Intersection de deux formes : sert a clipper un motif dans un contour. */
const clip = (shape, mask) => (px, py) => shape(px, py) && mask(px, py);

const triangle = (ax, ay, bx, by, cx, cy) => (px, py) => {
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  const a = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
  const b = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
  return a >= 0 && b >= 0 && a + b <= 1;
};

// ------------------------------------------------------------------- encodage

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** PNG 8 bits RGBA, sans filtrage : suffisant pour des aplats. */
function encodePNG(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  // 10-12 : compression, filtrage et entrelacement standards, deja a zero.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------------------------------------------------------------------- dessin

/**
 * L'icone : le roi, en medaillon d'or sur un carre de pelouse, encadre de deux
 * kubbs aux couleurs des equipes.
 *
 * `padding` est exprime en pourcentage du cote : il reduit tout le dessin,
 * pour que les icones "maskable" d'Android — qui peuvent etre rognees en
 * cercle — gardent le roi et les kubbs dans leur zone sure.
 */
function drawIcon(size, { padding = 0 } = {}) {
  const c = new Canvas(size);

  // Repere local : tout le dessin est exprime en centiemes du carre interieur,
  // et `pad` decale ET reduit l'ensemble. C'est ce qui fait qu'une icone
  // maskable rentre vraiment dans sa zone sure, fond comme motif.
  const pad = (padding / 100) * size;
  const inner = size - pad * 2;
  const u = inner / 100;
  const at = (n) => pad + n * u;

  c.fill(rect(0, 0, size, size), BG, 1);

  // Carre de pelouse. La moucheture est clippee au contour, sinon elle
  // deborde dans les coins arrondis.
  const field = roundedRect(pad, pad, inner, inner, inner * 0.18);
  c.fill(field, GRASS, 1);
  for (let i = 0; i < Math.round(size * 2.2); i += 1) {
    c.fill(
      clip(rect(pad + Math.random() * inner, pad + Math.random() * inner, 2 * u, 1.2 * u), field),
      GRASS_DARK,
      0.5
    );
  }

  const cx = at(50);

  // Les deux kubbs, de part et d'autre du roi.
  const kubb = 15 * u;
  const kubbY = at(60);
  c.fill(roundedRect(cx - 36 * u, kubbY, kubb, kubb, 3 * u), BLUE, 1);
  c.fill(roundedRect(cx + 21 * u, kubbY, kubb, kubb, 3 * u), RED, 1);

  // Le roi : disque d'or cerne, couronne a trois pointes.
  const kingY = at(46);
  c.fill(circle(cx, kingY, 25 * u), GOLD_DARK, 1);
  c.fill(circle(cx, kingY - u, 22 * u), GOLD, 1);
  c.fill(circle(cx, kingY - 4 * u, 14 * u), GOLD_LIGHT, 0.5);

  const base = kingY + 8 * u;
  c.fill(triangle(cx - 17 * u, base, cx - 11 * u, kingY - 15 * u, cx - 5 * u, base), GOLD_DARK, 1);
  c.fill(triangle(cx - 8 * u, base, cx, kingY - 20 * u, cx + 8 * u, base), GOLD_DARK, 1);
  c.fill(triangle(cx + 5 * u, base, cx + 11 * u, kingY - 15 * u, cx + 17 * u, base), GOLD_DARK, 1);
  c.fill(roundedRect(cx - 17 * u, base - 2 * u, 34 * u, 7 * u, 2 * u), GOLD_DARK, 1);

  return c;
}

// ----------------------------------------------------------------------- sortie

mkdirSync(OUT, { recursive: true });

const targets = [
  // Marge nulle : icone classique, cadrage plein.
  { file: 'icon-192.png', size: 192, padding: 4 },
  { file: 'icon-512.png', size: 512, padding: 4 },
  // Android peut rogner une icone maskable en cercle : on rentre le dessin.
  { file: 'icon-maskable-512.png', size: 512, padding: 12 },
  // iOS n'accepte ni SVG ni transparence pour l'ecran d'accueil.
  { file: 'apple-touch-icon.png', size: 180, padding: 4 },
  { file: 'favicon-64.png', size: 64, padding: 2 }
];

for (const { file, size, padding } of targets) {
  const png = encodePNG(size, drawIcon(size, { padding }).data);
  writeFileSync(join(OUT, file), png);
  console.log(`${file} — ${size}x${size}, ${(png.length / 1024).toFixed(1)} ko`);
}
