import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles.css';

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Не удалось найти корневой элемент #app');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

