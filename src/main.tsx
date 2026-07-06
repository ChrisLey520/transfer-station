import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { ToastViewport } from './components/toast.js';
import { App } from './pages/App.js';

function Root() {
  return (
    <>
      <ToastViewport />
      <App />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
