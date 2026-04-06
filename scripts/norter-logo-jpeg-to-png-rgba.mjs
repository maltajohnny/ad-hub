/**
 * O ficheiro norter-brand-norterx.png estava a ser JPEG com extensão .png (sem alpha).
 * Gera um PNG RGBA verdadeiro, tornando transparentes os pixels de fundo pretos/quase pretos.
 * Uso: node scripts/norter-logo-jpeg-to-png-rgba.mjs
 */
import Jimp from "jimp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "../src/assets/norter-brand-norterx.png");
const out = path.join(__dirname, "../src/assets/norter-brand-norterx.png");

/** Pixels com todos os canais abaixo disto são tratados como fundo (transparentes). */
const BLACK_BG_MAX = 22;

const img = await Jimp.read(src);
img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
  const r = this.bitmap.data[idx];
  const g = this.bitmap.data[idx + 1];
  const b = this.bitmap.data[idx + 2];
  if (r <= BLACK_BG_MAX && g <= BLACK_BG_MAX && b <= BLACK_BG_MAX) {
    this.bitmap.data[idx + 3] = 0;
  }
});
await img.writeAsync(out);
console.log("Wrote RGBA PNG:", out, `${img.bitmap.width}x${img.bitmap.height}`);
