import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import ThemeEngine from './theme/engine.js';
import GSSIReportApp from './GSSIReportApp.jsx';

// Tokens must be on <html> before first paint — components only ever
// reference var(--token), so initing here means no flash, no re-render.
ThemeEngine.init();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GSSIReportApp />
  </React.StrictMode>
);
