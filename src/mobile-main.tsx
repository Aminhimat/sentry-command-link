import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MobileApp from './mobile.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
);