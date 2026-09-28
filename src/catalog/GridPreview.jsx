import { useEffect, useRef, useState } from 'react';
import D from '../../scripts/data.mjs';
import { drawCatalogGrid } from '../../scripts/catalog-rendering.mjs';
import { gameFontsReady } from '../typography.js';
import { catalogAPI } from './api.js';

const portraits = new Map();
function portrait(id) {
  if (!portraits.has(id)) portraits.set(id, new Promise(resolve => {
    const hero = D.heroes.find(hero => hero.id === id); if (!hero) return resolve(null);
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = hero.portrait;
  }));
  return portraits.get(id);
}
export default function GridPreview({ grid: supplied, id, title = 'Превью сетки', large = false }) {
  const canvas = useRef(null), container = useRef(null);
  const [grid, setGrid] = useState(supplied), [error, setError] = useState('');
  useEffect(() => {
    setGrid(supplied); setError(''); if (supplied || !id) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return; observer.disconnect();
      catalogAPI(`/works/${id}`, { signal: controller.signal }).then(item => setGrid(item.grid)).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    }, { rootMargin: '150px' }); observer.observe(container.current);
    return () => { observer.disconnect(); controller.abort(); };
  }, [id, supplied]);
  useEffect(() => {
    if (!grid) return;
    let active = true;
    const categories = grid.configs[0].categories;
    const ids = [...new Set(categories.flatMap(category => category.hero_ids))];
    Promise.all([gameFontsReady, ...ids.map(portrait)]).then(([, ...images]) => {
      if (!active) return;
      const element = canvas.current, ctx = element.getContext('2d');
      const width = large ? 1193 : 716, scale = width / 1193;
      element.width = width; element.height = Math.round(593 * scale);
      drawCatalogGrid(ctx, grid, new Map(ids.map((id, i) => [id, images[i]])), width);
    }).catch(() => { if (active) setError('Не удалось нарисовать превью.'); });
    return () => { active = false; };
  }, [grid, large]);
  return <div className="catalog-preview" ref={container}>
    <canvas ref={canvas} width="716" height="356" role="img" aria-label={title} />
    {!grid && !error && <span className="catalog-preview-status" role="status">Загружаем сетку…</span>}
    {error && <span className="catalog-preview-status" role="status">{error}</span>}
  </div>;
}
