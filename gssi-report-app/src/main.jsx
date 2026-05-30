import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import GSSIReportApp from './GSSIReportApp.jsx';

// The live PDF-preview window loads this same bundle at "#preview" and mounts
// a read-only mirror (no editor tools) that the editor feeds over IPC.
const previewOnly = typeof window !== 'undefined' && window.location.hash === '#preview';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GSSIReportApp previewOnly={previewOnly} />
  </React.StrictMode>
);
