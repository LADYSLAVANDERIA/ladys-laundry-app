// OT en hoja CARTA con el logo de Ladys, presentada como cotización (06-oct).
// Se imprime desde el detalle de la orden ("OT carta / PDF"): el navegador la
// manda a la impresora o la guarda como PDF tamaño carta.
// Empresa / factura: valor unitario neto, NETO + IVA 19% = TOTAL (mismo cálculo
// que el ticket y que ladys-facttura). Particular: precios con IVA incluido.
// Las OBSERVACIONES no salen: son notas internas (bitácora: el cliente las leía
// enteras). Sí salen las condiciones del servicio, OC y remolcador.
import { fmt, esOtEmpresa, desgloseEmpresa } from '../utils'

const ROSA = '#E8177A'
const dma = (f?: string | null) => {
  if (!f) return '—'
  const [a, m, d] = String(f).slice(0, 10).split('-')
  return `${d}-${m}-${a}`
}
const hoyDma = () => dma(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }))

export default function OtCarta({ o, local, config, className = '' }: { o: any; local: any; config: any; className?: string }) {
  if (!o) return null
  const empresa = esOtEmpresa(o)
  const d = desgloseEmpresa(o)
  const plazo = Number(o.plazo_pago || 0)
  const ingreso = o.fecha_recogida || String(o.creado_en || '').slice(0, 10)
  const dirCliente = empresa && o.cliente_dir_fiscal
    ? [o.cliente_dir_fiscal, o.cliente_comuna_fiscal].filter(Boolean).join(', ')
    : (o.direccion_entrega || o.direccion_retiro || '')
  const transf = String(config?.datos_transferencia || '').trim()
  const logo = `${import.meta.env.BASE_URL}logo-ladys-completo.png`

  const th: any = { textAlign: 'left', padding: '7px 8px', fontSize: 10, fontWeight: 600, color: '#fff', background: ROSA }
  const td: any = { padding: '7px 8px', fontSize: 11, borderBottom: '1px solid #eee', verticalAlign: 'top' }
  const num: any = { textAlign: 'right', whiteSpace: 'nowrap' }
  const fila = (a: string, b: string, fuerte = false, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0',
                  fontWeight: fuerte ? 700 : 400, fontSize: fuerte ? 13 : 11, color: color || '#222' }}>
      <span>{a}</span><span>{b}</span>
    </div>)

  return (
    <div className={`print-only ot-carta ${className}`}
         style={{ width: '100%', color: '#222', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    borderBottom: `3px solid ${ROSA}`, paddingBottom: 12 }}>
        <div>
          <img src={logo} alt="Ladys Lavandería" style={{ height: 62 }} />
          <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.45, color: '#444' }}>
            <div style={{ fontWeight: 700, color: '#222' }}>{local.razon_social || 'Ladys Lavandería Concón SpA'}</div>
            {local.id_fiscal && <div>RUT {local.id_fiscal}</div>}
            <div>{local.dir_salida || 'Av. Concón Reñaca 102, Locales 5 y 6, Concón'}</div>
            <div>{local.telefono || '+56 9 7541 0232'} · {local.email || 'contacto@ladyslavanderia.cl'}</div>
            <div>ladyslavanderia.cl</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#888' }}>ORDEN DE TRABAJO</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: ROSA, lineHeight: 1.1 }}>N° {o.id}</div>
          <table style={{ marginLeft: 'auto', marginTop: 8, fontSize: 10.5, borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ color: '#888', paddingRight: 10 }}>Emisión</td><td style={{ fontWeight: 600 }}>{hoyDma()}</td></tr>
              <tr><td style={{ color: '#888', paddingRight: 10 }}>Ingreso</td><td style={{ fontWeight: 600 }}>{dma(ingreso)}</td></tr>
              <tr><td style={{ color: '#888', paddingRight: 10 }}>Entrega</td><td style={{ fontWeight: 600 }}>{dma(o.fecha_entrega)}</td></tr>
              {o.tipo_servicio === 'EXPRESS' && <tr><td colSpan={2} style={{ fontWeight: 700, color: ROSA }}>SERVICIO EXPRESS</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
        <div style={{ flex: 1, background: '#faf5f8', borderRadius: 6, padding: '10px 12px', lineHeight: 1.5 }}>
          <div style={{ fontSize: 9.5, letterSpacing: 1.5, color: ROSA, fontWeight: 700, marginBottom: 2 }}>CLIENTE</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{empresa ? (o.cliente_razon_social || o.cliente_nombre) : o.cliente_nombre}</div>
          {empresa && o.cliente_rut && <div>RUT {o.cliente_rut}</div>}
          {empresa && o.cliente_giro && <div>Giro: {o.cliente_giro}</div>}
          {dirCliente && <div>{dirCliente}</div>}
        </div>
        <div style={{ flex: 1, background: '#faf5f8', borderRadius: 6, padding: '10px 12px', lineHeight: 1.5 }}>
          <div style={{ fontSize: 9.5, letterSpacing: 1.5, color: ROSA, fontWeight: 700, marginBottom: 2 }}>CONTACTO Y REFERENCIAS</div>
          {o.cliente_contacto && <div>{o.cliente_contacto}</div>}
          <div>{o.cliente_telefono || '—'}</div>
          {(o.cliente_email_fact || o.cliente_email) && <div>{o.cliente_email_fact || o.cliente_email}</div>}
          {o.orden_compra && <div><b>OC N° {o.orden_compra}</b></div>}
          {o.remolcador && <div>Remolcador: <b>{o.remolcador}</b></div>}
          <div>Documento: {o.tipo_doc === 'FACTURA' ? 'Factura' : 'Boleta'}</div>
        </div>
      </div>

      {/* Detalle */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '9%', ...num }}>Cant.</th>
            <th style={{ ...th, width: '6%' }}>Un.</th>
            <th style={th}>Descripción</th>
            <th style={{ ...th, width: '17%', ...num }}>{empresa ? 'Valor unit. neto' : 'Valor unit.'}</th>
            <th style={{ ...th, width: '17%', ...num }}>{empresa ? 'Total neto' : 'Total'}</th>
          </tr>
        </thead>
        <tbody>
          {d.lineas.map((l: any, n: number) => (
            <tr key={n} style={{ background: n % 2 ? '#fcfcfc' : '#fff' }}>
              <td style={{ ...td, ...num }}>{l.cantidadTxt}</td>
              <td style={td}>{l.unidad}</td>
              <td style={td}>{l.nombre}</td>
              <td style={{ ...td, ...num }}>{fmt(empresa ? l.unitNeto : l.unitBruto)}</td>
              <td style={{ ...td, ...num, fontWeight: 600 }}>{fmt(empresa ? l.netoLinea : l.brutoLinea)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales + condiciones */}
      <div style={{ display: 'flex', gap: 24, marginTop: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, fontSize: 10, lineHeight: 1.5, color: '#444' }}>
          <div style={{ fontSize: 9.5, letterSpacing: 1.5, color: ROSA, fontWeight: 700 }}>CONDICIONES DE PAGO</div>
          <div>{plazo > 0 ? `Crédito ${plazo} días corridos desde la emisión de la factura.` : 'Pago contado.'}</div>
          {transf && (
            <>
              <div style={{ marginTop: 6, fontWeight: 600, color: '#222' }}>Transferencia a:</div>
              {transf.split('\n').map((t, i) => <div key={i}>{t}</div>)}
              <div style={{ marginTop: 2 }}>Enviar comprobante a WhatsApp {local.telefono || '+56 9 7541 0232'}.</div>
            </>
          )}
          {o.condiciones && (
            <>
              <div style={{ fontSize: 9.5, letterSpacing: 1.5, color: ROSA, fontWeight: 700, marginTop: 8 }}>CONDICIONES DEL SERVICIO</div>
              {String(o.condiciones).split('\n').map((t: string, i: number) => <div key={i}>{t}</div>)}
            </>
          )}
        </div>
        <div style={{ width: 250, border: '1px solid #eee', borderRadius: 6, padding: '8px 12px' }}>
          {empresa ? (
            <>
              {/* Subtotal solo si algo lo modifica; si no, repite el neto */}
              {(d.descuentoNeto > 0 || d.despachoNeto > 0 || d.ajusteNeto !== 0) && fila('Subtotal neto', fmt(d.subtotalNeto))}
              {d.descuentoNeto > 0 && fila(d.descuentoTxt, `-${fmt(d.descuentoNeto)}`)}
              {d.despachoNeto > 0 && fila('Despacho', fmt(d.despachoNeto))}
              {d.ajusteNeto !== 0 && fila('Ajuste', fmt(d.ajusteNeto))}
              <div style={{ borderTop: '1px solid #ddd', marginTop: 3 }} />
              {fila('Neto', fmt(d.neto), false)}
              {fila('IVA 19%', fmt(d.iva))}
            </>
          ) : (
            <>
              {fila('Subtotal', fmt(o.subtotal))}
              {Number(o.descuento_monto) > 0 && fila(d.descuentoTxt, `-${fmt(o.descuento_monto)}`)}
              {Number(o.monto_delivery) > 0 && fila('Despacho', fmt(o.monto_delivery))}
            </>
          )}
          <div style={{ background: ROSA, color: '#fff', borderRadius: 4, margin: '6px -6px 4px', padding: '6px 8px',
                        display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14 }}>
            <span>TOTAL</span><span>{fmt(o.monto_total)}</span>
          </div>
          {!empresa && <div style={{ fontSize: 9, color: '#888', textAlign: 'right' }}>Valores con IVA incluido</div>}
          {Number(o.monto_abonado) > 0 && fila('Abonado', fmt(o.monto_abonado))}
          {fila(Number(o.saldo_pendiente) > 0 ? 'Saldo pendiente' : 'Pagada', Number(o.saldo_pendiente) > 0 ? fmt(o.saldo_pendiente) : '✓', true,
                Number(o.saldo_pendiente) > 0 ? '#c00' : '#16a34a')}
        </div>
      </div>

      <div style={{ marginTop: 26, borderTop: '1px solid #eee', paddingTop: 8, textAlign: 'center', fontSize: 9.5, color: '#888' }}>
        Gracias por preferir Ladys Lavandería · {local.horario || ''}
      </div>
    </div>
  )
}
