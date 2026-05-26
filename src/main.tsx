import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

pendo.initialize({
  visitor: {
    id: 'anon-' + (localStorage.getItem('carimurah_anon_id') || (() => { const id = crypto.randomUUID(); localStorage.setItem('carimurah_anon_id', id); return id; })()),
    is_guest: true
  },
  account: {
    id: 'guest',
    account_name: 'guest'
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
