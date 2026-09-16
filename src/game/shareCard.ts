/**
 * Image de partage du resultat de match (Web Share API / telechargement).
 * Purement cosmetique/joueur (comme les skins) : dessine sur un <canvas>
 * hors-DOM a partir de donnees deja calculees par ResultScreen, ne touche
 * ni les regles ni l'IA.
 */

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

// Emoji en fin de pile (coinsGained embarque "🪙") : sans police emoji
// explicite, certains environnements sans emoji systeme (Linux headless)
// dessinent un glyphe manquant au lieu de repasser sur une police adaptee.
const FONT_STACK =
  "'Trebuchet MS', 'Segoe UI', system-ui, -apple-system, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

// Memes teintes que src/index.css (:root) — dupliquees ici, un canvas ne
// peut pas lire des custom properties CSS.
const COLORS = {
  bgTop: '#0d1a14',
  bgBottom: '#0a140f',
  panel: 'rgba(16, 34, 26, 0.96)',
  border: 'rgba(255, 255, 255, 0.16)',
  cellFill: 'rgba(255, 255, 255, 0.04)',
  text: '#eef4ef',
  muted: '#9fb3a7',
  gold: '#f2c14e',
  goldText: '#2a1e04'
};

/** Meme URL canonique que index.html (balises SEO/partage), sans le protocole pour l'affichage. */
const FOOTER_URL = 'thoomaslef.github.io/kubb-kings';

export interface ShareCardData {
  tagline: string;
  headline: string;
  detail: string;
  blueLabel: string;
  blueScore: number;
  redLabel: string;
  redScore: number;
  blueColor: string;
  redColor: string;
  /** Couleur du titre de resultat (team color, ou dore pour un match nul). */
  accent: string;
  /** Ligne "Niveau X · +Y XP · +Z pieces", deja composee de chaines traduites — absente hors solo/defi. */
  levelLine: string | null;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Decoupe `text` en lignes tenant dans `maxWidth`, sans jamais couper un mot. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Dessine la carte de resultat sur un <canvas> hors-DOM et le renvoie. */
export function renderShareCard(data: ShareCardData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexte 2D indisponible');

  const bgGradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  bgGradient.addColorStop(0, COLORS.bgTop);
  bgGradient.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const margin = 48;
  roundedRect(ctx, margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2, 40);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  const centerX = CARD_WIDTH / 2;
  const contentWidth = CARD_WIDTH - margin * 2 - 120;
  let y = margin + 108;

  ctx.textBaseline = 'alphabetic';

  // Titre "KUBB: Kings" (deux tailles/couleurs sur la meme ligne).
  ctx.font = `800 76px ${FONT_STACK}`;
  const kubbWidth = ctx.measureText('KUBB').width;
  ctx.font = `600 54px ${FONT_STACK}`;
  const suffixWidth = ctx.measureText(': Kings').width;
  let tx = centerX - (kubbWidth + suffixWidth) / 2;
  ctx.textAlign = 'left';
  ctx.font = `800 76px ${FONT_STACK}`;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText('KUBB', tx, y);
  tx += kubbWidth;
  ctx.font = `600 54px ${FONT_STACK}`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText(': Kings', tx, y);
  ctx.textAlign = 'center';
  y += 58;

  ctx.font = `400 28px ${FONT_STACK}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(data.tagline, centerX, y);
  y += 66;

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - contentWidth / 2, y);
  ctx.lineTo(centerX + contentWidth / 2, y);
  ctx.stroke();
  y += 84;

  ctx.font = `800 60px ${FONT_STACK}`;
  ctx.fillStyle = data.accent;
  for (const line of wrapText(ctx, data.headline, contentWidth)) {
    ctx.fillText(line, centerX, y);
    y += 72;
  }
  y += 12;

  if (data.detail) {
    ctx.font = `400 32px ${FONT_STACK}`;
    ctx.fillStyle = COLORS.muted;
    for (const line of wrapText(ctx, data.detail, contentWidth)) {
      ctx.fillText(line, centerX, y);
      y += 42;
    }
  }
  y += 54;

  const cellWidth = 400;
  const cellHeight = 260;
  const gap = 40;
  let cx = centerX - (cellWidth * 2 + gap) / 2;
  for (const cell of [
    { score: data.blueScore, label: data.blueLabel, color: data.blueColor },
    { score: data.redScore, label: data.redLabel, color: data.redColor }
  ]) {
    roundedRect(ctx, cx, y, cellWidth, cellHeight, 24);
    ctx.fillStyle = COLORS.cellFill;
    ctx.fill();
    ctx.strokeStyle = cell.color;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.font = `800 120px ${FONT_STACK}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(String(cell.score), cx + cellWidth / 2, y + 150);

    ctx.font = `700 26px ${FONT_STACK}`;
    ctx.fillStyle = COLORS.muted;
    const labelLines = wrapText(ctx, cell.label, cellWidth - 40);
    let labelY = y + 200;
    for (const line of labelLines) {
      ctx.fillText(line, cx + cellWidth / 2, labelY);
      labelY += 32;
    }
    cx += cellWidth + gap;
  }
  y += cellHeight + 64;

  if (data.levelLine) {
    ctx.font = `700 32px ${FONT_STACK}`;
    const pillPadding = 36;
    const pillWidth = ctx.measureText(data.levelLine).width + pillPadding * 2;
    const pillHeight = 76;
    roundedRect(ctx, centerX - pillWidth / 2, y, pillWidth, pillHeight, pillHeight / 2);
    ctx.fillStyle = COLORS.gold;
    ctx.fill();
    ctx.fillStyle = COLORS.goldText;
    ctx.fillText(data.levelLine, centerX, y + pillHeight / 2 + 11);
  }

  ctx.font = `600 26px ${FONT_STACK}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(FOOTER_URL, centerX, CARD_HEIGHT - margin - 40);

  return canvas;
}

/** `renderShareCard` converti en PNG, pret a joindre a un partage ou un telechargement. */
export function shareCardBlob(data: ShareCardData): Promise<Blob> {
  const canvas = renderShareCard(data);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob a echoue'));
    }, 'image/png');
  });
}

/** Declenche un telechargement classique (navigateurs sans Web Share API / partage de fichiers). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
