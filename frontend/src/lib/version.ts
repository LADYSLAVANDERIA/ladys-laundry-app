// Aviso de version nueva.
//
// La app se publica copiando el build a otro repositorio y Vite le pone un
// nombre distinto al bundle en cada despliegue. El navegador, en cambio, se
// queda con el index.html que ya tenia y sigue cargando el bundle viejo hasta
// que alguien hace una recarga forzada. El sintoma es siempre el mismo y es
// enganoso: "arreglaron algo pero no aparece". Nadie sospecha del cache.
//
// Esto compara cada tanto el bundle que esta corriendo contra el que publica el
// servidor y avisa cuando hay uno nuevo. No recarga solo: si alguien esta a
// mitad de una orden, perder lo escrito es peor que ver un boton un rato tarde.

const BUNDLE = /\/assets\/(index-[A-Za-z0-9_-]+\.js)/

function bundleActual(): string | null {
  const s = document.querySelector('script[src*="/assets/index-"]') as HTMLScriptElement | null
  return s?.src.match(BUNDLE)?.[1] ?? null
}

async function bundlePublicado(): Promise<string | null> {
  const r = await fetch(`/app/index.html?v=${Date.now()}`, { cache: 'no-store' })
  if (!r.ok) return null
  return (await r.text()).match(BUNDLE)?.[1] ?? null
}

export function vigilarVersion(alHaberNueva: () => void) {
  const mio = bundleActual()
  if (!mio) return

  let avisado = false
  const revisar = async () => {
    if (avisado || document.hidden) return
    try {
      const suyo = await bundlePublicado()
      if (suyo && suyo !== mio) { avisado = true; alHaberNueva() }
    } catch { /* sin red: se reintenta en la proxima vuelta */ }
  }

  setInterval(revisar, 5 * 60 * 1000)
  window.addEventListener('focus', revisar)
  setTimeout(revisar, 15_000)
}
