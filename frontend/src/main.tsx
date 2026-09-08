import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { vigilarVersion } from './lib/version'

// Registra el service worker. Es el requisito que le falta a Chrome en Android
// para ofrecer la instalacion de un toque; no cachea nada, para que un
// despliegue nuevo llegue siempre.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => {})
  })
}

// Si se publica una version nueva, se avisa con una barra abajo en vez de
// recargar por sorpresa: recargar a alguien que esta escribiendo una orden le
// borra el trabajo.
vigilarVersion(() => {
  if (document.getElementById('ladys-version-nueva')) return
  const b = document.createElement('div')
  b.id = 'ladys-version-nueva'
  b.setAttribute('style', [
    'position:fixed', 'left:12px', 'right:12px', 'bottom:12px', 'z-index:9999',
    'background:#1F2430', 'color:#fff', 'border-radius:14px',
    'padding:12px 14px', 'display:flex', 'align-items:center', 'gap:12px',
    'font:500 14px system-ui,-apple-system,sans-serif',
    'box-shadow:0 8px 24px rgba(0,0,0,.28)',
  ].join(';'))
  b.innerHTML =
    '<span style="flex:1">Hay una versión nueva de la app.</span>' +
    '<button id="ladys-actualizar" style="background:#E8177A;color:#fff;border:0;' +
    'border-radius:10px;padding:8px 14px;font:600 14px system-ui;cursor:pointer">Actualizar</button>' +
    '<button id="ladys-luego" style="background:transparent;color:#9aa1ad;border:0;' +
    'font:500 14px system-ui;cursor:pointer">Luego</button>'
  document.body.appendChild(b)
  document.getElementById('ladys-actualizar')!.onclick = () => location.reload()
  document.getElementById('ladys-luego')!.onclick = () => b.remove()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
