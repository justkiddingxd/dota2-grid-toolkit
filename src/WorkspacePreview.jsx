import { useEffect, useMemo, useRef, useState } from 'react';
import C from '../scripts/core.mjs';
import { readWorkspacePreview, workspaceGridPreview } from '../scripts/workspace-preview.mjs';
import { catalogAPI } from './catalog/api.js';
import GridPreview from './catalog/GridPreview.jsx';
import { Icon } from './catalog/Common.jsx';

export default function WorkspacePreview({ item, disabled, onOpen }) {
  const container = useRef(null), dots = useRef(null), gesture = useRef(null), suppressClick = useRef(false);
  const [loaded, setLoaded] = useState(null), [selected, setSelected] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [direction, setDirection] = useState(1);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setLoaded(null);
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      readWorkspacePreview(item, catalogAPI, controller.signal).then(result => {
        if (!controller.signal.aborted) setLoaded(result);
      }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    }, { rootMargin: '180px' });
    observer.observe(container.current);
    return () => { observer.disconnect(); controller.abort(); };
  }, [item.id, item.updated, item.account, item.cloudRevision, item.remoteRevision, item.dirty, retry]);

  const document = loaded?.document;
  const grids = useMemo(() => document ? C.configurations(document) : [], [document]);
  const index = grids.length ? Math.min(selected ?? document.configIndex, grids.length - 1) : 0;
  const title = grids[index]?.name || item.preview?.configs[0]?.config_name || item.name;
  const preview = useMemo(() => {
    if (!document) return { grid: item.preview };
    try { return { grid: workspaceGridPreview(document, index) }; }
    catch (error) { return { error: error.message }; }
  }, [document, index, item.preview]);
  const count = grids.length, multiple = count > 1;

  function choose(next, focus = false) {
    const target = Math.max(0, Math.min(count - 1, next));
    if (!count) return;
    setDirection(target < index ? -1 : 1); setSelected(target);
    if (focus) dots.current?.children[target]?.focus({ preventScroll: true });
  }
  useEffect(() => {
    const rail = dots.current, dot = rail?.children[index];
    if (!dot) return;
    const reveal = () => {
      const bounds = rail.getBoundingClientRect(), selected = dot.getBoundingClientRect();
      const overflow = selected.top < bounds.top ? selected.top - bounds.top
        : selected.bottom > bounds.bottom ? selected.bottom - bounds.bottom : 0;
      // Keep visible dots anchored; only scroll enough to reveal an offscreen one.
      if (overflow) rail.scrollTop += overflow;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [index, count]);

  return <div className="workspace-carousel" ref={container} role="group" aria-label={`Сетки в файле ${item.name}`} onKeyDown={event => {
    if (!count || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = { ArrowLeft: index - 1, ArrowUp: index - 1, ArrowRight: index + 1, ArrowDown: index + 1, Home: 0, End: count - 1 }[event.key];
    if (step === undefined) return;
    event.preventDefault(); choose(step, dots.current?.contains(event.target));
  }}>
    <div className={`workspace-carousel-body${multiple ? ' has-pages' : ''}`}>
      <button className="workspace-file-preview" disabled={disabled} aria-label={`Открыть ${item.name}${document ? `, сетка ${index + 1}: ${title}` : ''}`}
        onPointerDown={event => { if (event.button !== 0 || !event.isPrimary) return; suppressClick.current = false; gesture.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={event => {
          const start = gesture.current; gesture.current = null; if (!start) return;
          const dx = event.clientX - start.x, dy = event.clientY - start.y;
          suppressClick.current = Math.hypot(dx, dy) > 32;
          if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2) choose(index + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => { gesture.current = null; suppressClick.current = true; }}
        onClick={event => { if (event.detail && suppressClick.current) { suppressClick.current = false; return; } onOpen(document ? index : undefined); }}>
        <span className="workspace-carousel-slide" key={`${document ? 'loaded' : 'cached'}-${index}`} style={{ '--slide-offset': `${direction * 14}px` }}>
          {preview.grid ? <GridPreview grid={preview.grid} title={title}/> : <span className="workspace-file-empty"><Icon name="grid"/><span>{preview.error ? 'Превью недоступно' : error || item.issue ? 'Доступно восстановление' : 'Загружаем превью…'}</span></span>}
        </span>
      </button>
      {multiple && <div className="workspace-carousel-dots" ref={dots} role="group" aria-label={`${count} сеток в файле`}>
        {grids.map(grid => <button key={grid.index} type="button" aria-label={`Сетка ${grid.index + 1}: ${grid.name}`} aria-pressed={index === grid.index} tabIndex={index === grid.index ? 0 : -1} onClick={() => choose(grid.index)}><span/></button>)}
      </div>}
    </div>
    {count > 0 && <div className="workspace-carousel-caption"><span className="workspace-grid-name" aria-live="polite" aria-atomic="true">{title}</span><div className="workspace-carousel-nav">
      {multiple && <button className="catalog-icon" aria-label="Предыдущая сетка" disabled={index === 0} onClick={() => choose(index - 1)}><Icon name="back"/></button>}
      <span className="workspace-grid-count" aria-label={`Сетка ${index + 1} из ${count}`}>{index + 1}<span> / {count}</span></span>
      {multiple && <button className="catalog-icon" aria-label="Следующая сетка" disabled={index === count - 1} onClick={() => choose(index + 1)}><Icon name="arrow"/></button>}
    </div></div>}
    {(error || preview.error) && <div className="workspace-preview-error" role="status">{error || preview.error}{error && <button className="catalog-link" onClick={() => setRetry(x => x + 1)}>Повторить</button>}</div>}
    {loaded?.offline && <p className="workspace-preview-error" role="status">Превью локальной копии · нет связи</p>}
  </div>;
}
