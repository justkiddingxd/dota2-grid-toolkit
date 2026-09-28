import { useEffect, useState } from 'react';
import { catalogAPI, CATALOG_PATH } from './api.js';
import { Icon, Modal, Notice } from './Common.jsx';
import SubmissionForm from './SubmissionForm.jsx';
import GridPreview from './GridPreview.jsx';
import './catalog.css';

export default function EditorCatalog({ editor }) {
  const [sharing, setSharing] = useState(null), [incoming, setIncoming] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const share = event => setSharing(event.detail);
    window.addEventListener('gridstudio:share', share);
    return () => window.removeEventListener('gridstudio:share', share);
  }, []);
  useEffect(() => {
    const url = new URL(location.href), id = url.searchParams.get('catalog'); if (!id) return;
    const c = new AbortController();
    catalogAPI(`/works/${id}`, { signal: c.signal }).then(setIncoming).catch(e => { if (!c.signal.aborted) setError(e.message); });
    return () => c.abort();
  }, []);
  function dismiss() { setIncoming(null); setError(''); const url = new URL(location.href); url.searchParams.delete('catalog'); history.replaceState(null, '', url); }
  return <>
    {sharing && <Modal title="Опубликовать в галерею" onClose={() => setSharing(null)}><SubmissionForm grid={sharing}/></Modal>}
    {(incoming || error) && <Modal title="Сетка из каталога" onClose={dismiss}><div className="catalog-report">{incoming && <><h3>{incoming.title}</h3><GridPreview grid={incoming.grid} title={incoming.title} large/><p>Добавить эту сетку к текущему файлу? Твои сетки и правки сохранятся. Добавление можно отменить через Ctrl+Z.</p><div className="catalog-actions"><button className="catalog-button primary" onClick={() => { if (editor.addCatalogGrid(incoming.grid)) dismiss(); }}>Добавить к моим сеткам<Icon name="plus"/></button><button className="catalog-button" onClick={dismiss}>Отмена</button></div></>}{error && <Notice error>{error}</Notice>}<a className="catalog-link" href={CATALOG_PATH}>Открыть каталог</a></div></Modal>}
  </>;
}
