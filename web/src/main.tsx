import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/base.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element missing');
}

createRoot(container).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
