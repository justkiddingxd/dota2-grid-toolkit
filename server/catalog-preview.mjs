import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { drawCatalogGrid } from '../scripts/catalog-rendering.mjs';
import { normalizeCatalogGrid } from '../scripts/catalog-document.mjs';
import D from '../scripts/data.mjs';

let ready = false;
const portraits = new Map(), knownHeroes = new Map(D.heroes.map(hero => [hero.id, hero.portrait]));
export async function renderCatalogPreview(source) {
  const { grid } = normalizeCatalogGrid(source);
  if (!ready) {
    for (const [file, family] of [['radiance-semibold.otf', 'StudioRadiance'], ['ydygo540.ttf', 'StudioDotaKorean']]) {
      if (!GlobalFonts.registerFromPath(fileURLToPath(new URL(`../assets/fonts/${file}`, import.meta.url)), family))
        throw new Error('Не удалось загрузить шрифт превью.');
    }
    ready = true;
  }
  const ids = [...new Set(grid.configs[0].categories.flatMap(c => c.hero_ids))];
  const images = new Map(await Promise.all(ids.map(async id => {
    // No URLs or filesystem paths from a submission are ever opened.
    if (!knownHeroes.has(id)) return [id, null];
    if (!portraits.has(id)) portraits.set(id, loadImage(fileURLToPath(new URL(`../${knownHeroes.get(id)}`, import.meta.url))).catch(() => null));
    return [id, await portraits.get(id)];
  })));
  const canvas = createCanvas(1193, 593);
  drawCatalogGrid(canvas.getContext('2d'), grid, images);
  return canvas.encode('png');
}
