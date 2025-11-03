import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MobileApp from './mobile.tsx';
import './index.css';
import { Preloader } from './components/Preloader';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preloader />
    <MobileApp />
  </StrictMode>,
);