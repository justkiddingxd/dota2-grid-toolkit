import { useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from 'react';
import C from '../scripts/core.mjs';
import { planOptimization, optimizeCategories } from '../scripts/category-optimization.mjs';
import { drawCategoryLabel, measureCategoryWidth } from '../scripts/dota-rendering.mjs';
import { NumberInput } from './NumberInput.jsx';

function ArtPreview({ doc, label }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const canvas = ref.current, size = C.canvasSize(doc), ctx = canvas.getContext('2d');
    const scale = Math.min(1193 / size.w, 593 / size.h);
    canvas.width = Math.max(1, Math.round(size.w * scale)); canvas.height = Math.max(1, Math.round(size.h * scale));
    ctx.setTransform(canvas.width / size.w, 0, 0, canvas.height / size.h, 0, 0);
    ctx.fillStyle = '#191821'; ctx.fillRect(0, 0, size.w, size.h);
    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      for (const item of doc.entities) {
        if (item.layer !== layer.id) continue;
        if (item.type === 'heroes') {
          ctx.strokeStyle = '#383340'; ctx.strokeRect(item.x, item.y, item.w, C.visualHeight(item));
          drawCategoryLabel(ctx, item.name, item.x, item.y);
        } else for (const glyph of C.textGlyphs(item)) drawCategoryLabel(ctx, glyph.text, glyph.x, glyph.y);
      }
    }
  }, [doc]);
  return <figure><figcaption>{label}</figcaption><canvas ref={ref} role="img" aria-label={label} /></figure>;
}

export function ArtworkOptimizer({ editor, source, onClose }) {
  const dialog = useRef(null);
  const plan = useMemo(() => {
    const ctx = document.createElement('canvas').getContext('2d'), cache = new Map();
    return planOptimization(source, (text) => {
      if (!cache.has(text)) cache.set(text, measureCategoryWidth(ctx, text));
      return cache.get(text);
    });
  }, [source]);
  const [reduce, setReduce] = useState(false);
  const [target, setTarget] = useState(Math.max(plan.minimum, Math.min(2000, Math.round(plan.losslessCount * 0.75))));
  const [targetText, setTargetText] = useState(String(target));
  const budget = reduce ? target : plan.losslessCount;
  const deferredBudget = useDeferredValue(budget), pending = deferredBudget !== budget;
  const result = useMemo(() => optimizeCategories(plan, deferredBudget), [plan, deferredBudget]);
  const canReduce = plan.minimum < plan.losslessCount;
  const setBudget = (value) => {
    const next = Math.max(plan.minimum, Math.min(plan.losslessCount, Math.round(value)));
    setTarget(next); setTargetText(String(next));
  };
  useLayoutEffect(() => {
    const trigger = document.activeElement, node = dialog.current;
    node.showModal();
    return () => { node.close(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  return <dialog className="artwork-optimizer" ref={dialog} aria-labelledby="optimizeTitle"
    onCancel={(e) => { e.preventDefault(); onClose(); }}>
    <header className="modal-header"><h2 id="optimizeTitle">Оптимизация категорий</h2>
      <button className="icon-button" aria-label="Закрыть оптимизацию" onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12m0-12L6 18" /></svg></button></header>
    <div className="optimizer-body">
      <p>Сначала объединяем совместимые строки без сдвига символов — только в скачанном файле. Если этого мало, можно сократить детали рисунка.</p>
      <div className="optimizer-stats" role="status" aria-live="polite">
        <span>На холсте<strong>{plan.rawCount.toLocaleString('ru-RU')}</strong></span>
        <span>После объединения<strong>{plan.losslessCount.toLocaleString('ru-RU')}</strong></span>
        <span>В итоговом JSON<strong>{result.count.toLocaleString('ru-RU')}</strong></span>
      </div>
      <label className="check-row optimizer-reduce"><input type="checkbox" checked={reduce} disabled={!canReduce}
        onChange={(e) => setReduce(e.target.checked)} />Сократить детали рисунка</label>
      <p className="hint">Алгоритм отдаёт приоритет тонким линиям, разреженным деталям и краям. Плотные участки сокращаются сильнее. Герои, текстовые строки и заблокированные слои сохраняются.</p>
      {reduce && <div className="optimizer-budget">
        <label htmlFor="optimizeBudget">Целевое число категорий</label>
        <NumberInput id="optimizeBudget" aria-label="Целевое число категорий" min={plan.minimum} max={plan.losslessCount} step="1"
          value={targetText} onChange={(e) => {
            setTargetText(e.target.value);
            if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber))
              setTarget(Math.max(plan.minimum, Math.min(plan.losslessCount, e.target.valueAsNumber)));
          }} onStep={(value) => setBudget(Number(value))}
          onBlur={() => setBudget(Number(targetText) || target)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <input id="optimizeRange" type="range" aria-label="Бюджет категорий" min={plan.minimum} max={plan.losslessCount} step="1"
          value={target} onChange={(e) => setBudget(Number(e.target.value))} />
      </div>}
      {!canReduce && <p className="hint">Отдельных символов для сокращения нет. Доступно только точное объединение строк при скачивании.</p>}
      {reduce && plan.minimum > 2000 && <p className="export-warning">Защищённые объекты и слои не позволяют уменьшить эту сетку до 2000 категорий.</p>}
      <div className="optimizer-comparison">
        <ArtPreview doc={source} label="Исходный рисунок" />
        <ArtPreview doc={result.doc} label={pending ? 'Пересчитываем…' : 'Результат'} />
      </div>
      <p role="status">{result.removed ? `Будет убрано символов: ${result.removed.toLocaleString('ru-RU')}. Оставшиеся не перемещаются.` : 'Все символы и их расположение сохраняются.'}</p>
      {result.count > 2000 && <p className="export-warning">Больше 2000 категорий: возможны лаги и вылет Dota 2.</p>}
      <p className="hint">Сравни детали перед применением. Герои в этом превью показаны рамками. Оптимизируется выбранная сетка; остальные сохранятся в файле.</p>
    </div>
    <footer className="modal-footer"><button className="button secondary" onClick={onClose}>Отмена</button>
      <button className="button secondary" disabled={!result.removed || pending} onClick={() => { if (editor.optimizeArt(result.budget)) onClose(); }}>Применить к холсту</button>
      <button className="button primary" disabled={pending} onClick={() => { if (editor.downloadOptimized(reduce ? result.budget : null)) onClose(); }}>Скачать JSON</button></footer>
  </dialog>;
}
