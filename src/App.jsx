import { useEffect, useState } from 'react';
import { StudioLayout } from './StudioLayout.jsx';
import { StudioControls } from './StudioControls.jsx';
import { createStudio } from '../scripts/app.mjs';
import { interfaceFontsReady, gameFontsReady } from './typography.js';
import C from '../scripts/core.mjs';
import { createProjectStorage } from '../scripts/project-storage.mjs';
import { APP_VERSION } from '../scripts/version.mjs';

export default function App() {
  const [editor, setEditor] = useState(null);
  const [loadingError, setLoadingError] = useState('');
  // Read both storage copies before mounting an editable document.
  useEffect(() => {
    let instance;
    let active = true;
    (async () => {
      const storage = await createProjectStorage(C.importProject, APP_VERSION);
      const initial = await storage.load();
      if (!active) { storage.database?.close(); return; }
      instance = createStudio(storage, initial);
      setEditor(instance);
      const refresh = () => { if (active) instance.refresh(); };
      interfaceFontsReady.then(refresh);
      gameFontsReady.then(refresh);
    })().catch(() => { if (active) setLoadingError('Не удалось открыть редактор. Сохранённые данные не изменены. Обнови страницу.'); });
    return () => {
      active = false;
      instance?.dispose();
    };
  }, []);
  return (
    <>
      <StudioLayout />
      {!editor && <div className="studio-loading" role="status">{loadingError || 'Открываем проект…'}</div>}
      {editor && <StudioControls editor={editor} />}
    </>
  );
}
