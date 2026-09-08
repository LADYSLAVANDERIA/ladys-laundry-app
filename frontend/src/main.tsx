import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Registra el service worker. Es el requisito que le falta a Chrome en Android
// para ofrecer la instalacion de un toque; no cachea nada, para que un
// despliegue nuevo llegue siempre.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
