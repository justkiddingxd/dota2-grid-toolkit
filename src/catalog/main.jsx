import { createRoot } from 'react-dom/client';
import CatalogApp from './CatalogApp.jsx';
import '../../styles/site.css';
import '../../styles/game-fonts.css';
import './catalog.css';
createRoot(document.getElementById('catalog-root')).render(<CatalogApp/>);
