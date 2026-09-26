import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyBrandTokens } from './brand/brand';
import './styles.css';

applyBrandTokens(document.documentElement);

const el = document.getElementById('root');
if (!el) throw new Error('Missing #root element');
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
