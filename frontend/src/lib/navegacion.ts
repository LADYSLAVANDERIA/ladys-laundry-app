// Cálculos de la navegación del conductor. Sin dependencias: se probó aparte.

export type Punto = { lat: number; lng: number }

// Polilínea codificada de Google → puntos.
export function decodificar(s: string): Punto[] {
  const out: Punto[] = []
  let i = 0, lat = 0, lng = 0
  while (i < s.length) {
    for (const eje of [0, 1]) {
      let b, shift = 0, r = 0
      do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      const d = r & 1 ? ~(r >> 1) : r >> 1
      if (eje === 0) lat += d; else lng += d
    }
    out.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return out
}

const R = 6371000
const rad = (g: number) => (g * Math.PI) / 180
export function metros(a: Punto, b: Punto) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
export function rumbo(a: Punto, b: Punto) {
  const dLng = rad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

export type Paso = { maniobra: string; texto: string; m: number; seg: number; polyline: string }
// La ruta aplanada: cada punto sabe cuántos metros lleva desde el inicio y a qué paso pertenece.
export type Ruta = {
  pts: Punto[]; acum: number[]; paso: number[]
  finPaso: number[]         // metros acumulados donde termina cada paso
  pasos: Paso[]; total: number; seg: number
}

export function armarRuta(d: { pasos: Paso[]; seg: number }): Ruta {
  const pts: Punto[] = [], acum: number[] = [], paso: number[] = [], finPaso: number[] = []
  d.pasos.forEach((p, k) => {
    const tramo = decodificar(p.polyline || '')
    tramo.forEach((q, j) => {
      if (j === 0 && pts.length) {
        const u = pts[pts.length - 1]
        if (metros(u, q) < 0.5) return
      }
      acum.push(pts.length ? acum[acum.length - 1] + metros(pts[pts.length - 1], q) : 0)
      pts.push(q); paso.push(k)
    })
    finPaso.push(acum.length ? acum[acum.length - 1] : 0)
  })
  return { pts, acum, paso, finPaso, pasos: d.pasos, total: acum[acum.length - 1] || 0, seg: d.seg }
}

// Proyecta la posición sobre la ruta. Busca desde un poco antes de donde iba,
// para que en calles que se cruzan consigo mismas no salte hacia atrás.
export function proyectar(r: Ruta, pos: Punto, desdeIdx = 0) {
  const k = Math.cos(rad(pos.lat)) * R * Math.PI / 180, kl = R * Math.PI / 180
  const xy = (q: Punto) => [(q.lng - pos.lng) * k, (q.lat - pos.lat) * kl]
  let mejor = { lado: Infinity, s: 0, idx: 0, p: pos as Punto }
  const ini = Math.max(0, desdeIdx - 3)
  for (let i = ini; i < r.pts.length - 1; i++) {
    const [ax, ay] = xy(r.pts[i]), [bx, by] = xy(r.pts[i + 1])
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy
    const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0
    const px = ax + t * dx, py = ay + t * dy, lado = Math.hypot(px, py)
    // un poco de preferencia por no retroceder
    const castigo = i < desdeIdx ? 8 : 0
    if (lado + castigo < mejor.lado) {
      mejor = { lado: lado + castigo, s: r.acum[i] + t * (r.acum[i + 1] - r.acum[i]), idx: i,
                p: { lat: pos.lat + py / kl, lng: pos.lng + px / k } }
    }
  }
  if (r.pts.length === 1) mejor = { lado: metros(pos, r.pts[0]), s: 0, idx: 0, p: r.pts[0] }
  const lado = mejor.lado === Infinity ? Infinity : metros(pos, mejor.p)
  const i = Math.min(mejor.idx, r.pts.length - 2)
  const dir = r.pts.length > 1 ? rumbo(r.pts[Math.max(0, i)], r.pts[i + 1]) : 0
  return { lado, s: mejor.s, idx: mejor.idx, p: mejor.p, dir }
}

// En qué paso va y qué maniobra viene. La instrucción de Google de un paso
// describe lo que se hace AL EMPEZARLO, así que mientras recorre el paso k la
// maniobra que viene es la del paso k+1, al final del paso k.
export function siguiente(r: Ruta, s: number) {
  let k = r.finPaso.findIndex(f => s < f - 1)
  if (k < 0) k = r.pasos.length - 1
  const prox = r.pasos[k + 1]
  return {
    paso: k,
    prox: prox || null,
    distProx: Math.max(0, r.finPaso[k] - s),
    resta: Math.max(0, r.total - s),
  }
}

// "a 350 m" / "a 1,2 km"
export function distTxt(m: number) {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`
  if (m >= 100) return `${Math.round(m / 50) * 50} m`
  return `${Math.max(10, Math.round(m / 10) * 10)} m`
}
export function distVoz(m: number) {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} kilómetros`
  return `${Math.round(m / 50) * 50 || 50} metros`
}

// ── Voz ──
let vozEs: SpeechSynthesisVoice | null = null
function elegirVoz() {
  const vs = window.speechSynthesis?.getVoices?.() || []
  vozEs = vs.find(v => /es[-_]CL/i.test(v.lang)) || vs.find(v => /es[-_](419|MX|US|AR)/i.test(v.lang))
       || vs.find(v => /^es/i.test(v.lang)) || null
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  elegirVoz()
  window.speechSynthesis.onvoiceschanged = elegirVoz
}
export function hablar(t: string) {
  try {
    const s = window.speechSynthesis
    if (!s || !t) return
    s.cancel()
    const u = new SpeechSynthesisUtterance(t)
    u.lang = vozEs?.lang || 'es-CL'
    if (vozEs) u.voice = vozEs
    u.rate = 1.02
    s.speak(u)
  } catch { /* sin voz no se cae la navegación */ }
}
// iPhone solo deja hablar si la primera frase sale de un toque del usuario.
export function desbloquearVoz() {
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis?.speak(u)
  } catch { /* nada */ }
}
