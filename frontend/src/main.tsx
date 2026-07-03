import App from './App.tsx';
import { amplifyconfiguration } from './amplifyconfiguration.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import './index.css';

Amplify.configure(amplifyconfiguration);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
