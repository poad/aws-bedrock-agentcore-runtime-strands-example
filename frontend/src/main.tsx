import { Amplify } from 'aws-amplify';
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';

import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';

const amplifyconfiguration = await (await fetch('/amplifyconfiguration.json')).json();

Amplify.configure(amplifyconfiguration);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
