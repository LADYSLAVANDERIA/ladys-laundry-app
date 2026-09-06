# Pendientes — Ladys

> Última actualización: 6-sep-2026

## Bloqueantes para el corte del 14 de septiembre

- **Crear los usuarios reales del equipo.** Alexandra Godoy (JEFE_LOCAL), Johanly, el conductor. Hoy todos entrarían con `admin@ladys.cl` y la trazabilidad diría "Administrador". Las contraseñas las escribe Lufi.
- **Probar un pago real con tarjeta.** Abrir un pedido, apretar "Cobrar en la máquina", pasar una tarjeta por $1.000 y confirmar que el pedido se abona solo. Es lo único del circuito de pagos que no se pudo verificar sin hardware.
- **Llave de Google Maps.** Falta habilitar Geocoding API y Routes API en el proyecto "Ladys App" y crear la clave. La pantalla ya está en Configuración → Google Maps. Poner cuota diaria: las alertas de presupuesto avisan *después* de gastar.
- **Semana del 7 al 13: operación en paralelo** con EasyLaundry y cotejo diario.

## Banco BCI — detenido, esperando al banco

El sandbox de BCI no sirve para probar: devuelve respuestas enlatadas (el mismo ID de suscripción con cualquier dato, incluso con el cuerpo vacío) y el endpoint de simulación responde **500 con el ejemplo oficial del propio portal**.

Lo que hay que hacer, en este orden:

1. Reclamar a soporte de BCI con el `tracking-id: 1bffbe5866044166afd6fa85a56d35a4` — su ejemplo oficial devuelve 500.
2. Preguntar al ejecutivo: **¿el producto aplica a cuentas en pesos?** A febrero de 2025 solo estaba disponible para cuentas en dólares. Si la respuesta es no, todo esto se descarta.
3. Preguntar el costo: hay cobro de implementación y cobro por notificación.
4. Con la clave productiva: pegarla en Configuración → Banco BCI, cambiar ambiente a "Productivo" y apretar "Suscribir la cuenta".

**Regenerar las dos claves del portal de BCI** (primaria y secundaria): quedaron visibles en capturas de pantalla.

Nuestro lado ya está listo y probado: el endpoint lee los nombres de campo reales de BCI, cruza con el comprobante, ignora anulaciones y cargos, y aguanta reintentos.

## Máquinas Mercado Pago

| Máquina | Sucursal | Modo | Boleta |
|---|---|---|---|
| `NEWLAND_N950__N950NCD100061676` | Ladys Lavandería | **PDV** — recibe cobros desde la app | Sí |
| `NEWLAND_N950__N950NCCB05345853` | Ropa | STANDALONE — respaldo | **No, solo comprobante** |

- **Marcar físicamente las dos máquinas** con el número de serie para que nadie se confunda.
- **Dejar por escrito junto a la caja**: si se cobra en la de respaldo, esa venta queda sin boleta y hay que emitirla aparte.

## SofIA con datos reales — construido, falta conectarlo

El endpoint `ladys-sofia` ya está desplegado y probado. Devuelve la frase armada para copiar al cliente.
Autenticación: header `x-api-key: ladys_webhook_2026`. Base: `https://vhjsizkbmabznupkfzji.supabase.co/functions/v1/ladys-sofia`

| Pregunta del cliente | Llamada |
|---|---|
| ¿Está listo mi pedido? ¿Cuándo llega? ¿Cuántos kilos me quedan? | `GET /cliente?telefono={{telefono}}` |
| ¿Cómo va el pedido 15990? | `GET /pedido/15990` |
| ¿Qué días y horarios pasan? ¿Hay cupo? | `GET /ruta?fecha=2026-09-08` |

**Lo que falta, y es solo esto: editar el prompt de SofIA en GHL** para que sepa cuándo llamar a cada una.
Se toca al final, después del corte del 14 — no antes, para no mover el bot mientras la operación cambia de sistema.

Recordar la trampa de siempre: **cada PUT al agente en GHL deja `isPrimary` en `false`** y SofIA deja de responder en silencio. Hay que volver a marcarlo primario en la interfaz después de cada cambio.

**Sobre el agente de voz en el mesón:** evaluado y descartado por ahora. El cuello de botella de la atención presencial no son las palabras sino las manos — pesar, revisar, embolsar, buscar la bolsa. La voz solo paga junto con lockers, porque ahí sí desaparece una persona del proceso. Además el ruido de las máquinas rompe el reconocimiento de voz; cualquier prueba tiene que ser en el local con todo andando.

## Correlativo de OT

Desde el 6-sep el número de orden de la app **continúa el de EasyLaundry**: la última OT de EasyLaundry fue la 6430 y la app parte en 6431. Así el número que ve el cliente y el equipo no cambia con el corte del 14.

Para lograrlo, las 5.999 órdenes históricas se corrieron de 10001–15999 a **110001–115999**, dejando libre todo el tramo 6431–109999 (más de cien mil órdenes, no vuelve a chocar). Las 12 tablas hijas quedaron con `ON UPDATE CASCADE`, así que arrastraron solas; verificado: cero huérfanos.

**Ojo si alguien busca una orden histórica**: su número interno ahora empieza en 110001, pero su OT real de EasyLaundry sigue guardada en `ot_easylaundry`.

## Facturación electrónica a empresas

**Decidido el 6-sep:** boletas siguen en la máquina de Mercado Pago; las facturas salen por **BaseAPI**, que automatiza por API REST el Portal MiPyme del SII (el sistema oficial gratuito). No hay que migrar de facturador ni pasar el proceso CAL.

**Una factura mensual consolidada por empresa**, emitida al cierre del mes, salvo **Ultratug que va por pedido** porque cada uno lleva orden de compra. Con eso el volumen real es de **6 a 8 documentos al mes** (verificado contra 2026 completo), y la capa gratuita de BaseAPI son 20 emisiones mensuales. Sale en cero, con margen para el doble.

**Construido y probado:**
- `clientes`: `comuna_facturacion`, `dir_facturacion`, `email_dte`, `modo_facturacion` (MENSUAL / POR_PEDIDO). Ultratug ya quedó en POR_PEDIDO.
- Tablas `dtes` y `dte_ordenes`. El índice único sobre `dte_ordenes.orden_id` es lo que **impide facturar un pedido dos veces**.
- Función `ladys-facturacion`: `/empresas` (qué le falta a cada una), `/borradores?periodo=YYYY-MM`, `/emitidos`, `/validar-rut` (módulo 11).

**Falta:**
- Cuenta en BaseAPI y su API key. **Ojo: BaseAPI opera sobre el Portal MiPyme usando las credenciales SII del contribuyente** — es una decisión de confianza distinta a un facturador certificado.
- La pantalla en la app (hoy solo existe el endpoint).
- Completar RUT, giro, dirección y comuna de las 30 empresas. Ninguna los tiene. El endpoint `dte.receptor` de BaseAPI los autocompleta por RUT.
- **Confirmar con el contador** que facturar consolidado al cierre del mes calza con las reglas del SII sobre cuándo corresponde emitir.
- La comuna va en campo propio (`CmnaRecep`): dentro del texto de la dirección el SII rechaza.

**Trampa cazada:** nuestros precios son con IVA incluido y el DTE los quiere netos. La función ya divide por 1,19. Sin eso, una factura de $274.000 se habría emitido por $326.000.

## Otros

- **Resuelto (6-sep):** el detalle por servicio de las OT históricas quedó importado. 5.988 de 5.996 órdenes con detalle, 9.112 líneas, kilos recalculados. Quedan 10 sin detalle (no existen en el reporte de EasyLaundry).
- 45 direcciones con la comuna mal ("Valparaíso"); las coordenadas están bien. Geocodificación: 657 de 690 ubicadas.
- Avisos automáticos del Club.
- Borrar el cliente duplicado 380 ("CLIENTE", 0 pedidos), que comparte teléfono con la ficha real de Lufi (1872).
- Lockers.
- Lista de precios que sube el 1 de noviembre.
- Unificación visual del PDF del reporte diario automático (a medias).
- Corrección de las etiquetas de Detergente y Suavizante en la próxima producción ("Hipoelergénico" está mal escrito).
- Reconectar `ladysconcon@gmail.com` o crear reenvío de los correos de BCI (hoy está conectado `xlufix@gmail.com`).
- Decidir el canal de aviso para el traspaso a agente humano (Telegram evaluado como el más confiable; falta aprobación de plantilla de WhatsApp).

## Horarios reales (confirmados por Lufi el 6-sep-2026)

| | Local | Ruta a domicilio |
|---|---|---|
| Lunes a viernes | 10:00–13:30 y 14:30–18:30 | 13:30–14:30 (**4 cupos**) y 19:00–21:00 (**8 cupos**) |
| Sábado | 10:00–13:40 | 14:00–15:00, **solo entregas** (8 cupos) |
| Domingo | cerrado | sin ruta |

**Express:** lo evalúa y decide el jefe de local, caso a caso. No se agenda por calendario.

Ya cargado en la base: rutas, `horario_local`, `horario_ruta`, `regla_express` y el horario del local. Verificado contra el endpoint de SofIA.

**SofIA ya estaba correcta** (verificado el 6-sep leyendo su prompt real): tiene los horarios de arriba, la prohibición de retiros el sábado y la derivación del express a agente humano. Lo desactualizado eran la base de datos y los documentos, no el bot. Única diferencia: SofIA dice que el sábado el local cierra 13:30 y Lufi indicó 13:40.

**Falta actualizar donde el cliente lo ve:**
- El sitio web y Google Business.
- Los documentos del proyecto `rrss-automatizacion.md` y `estrategia-contenido-instagram.md`, que traen la regla vieja de 16:00–18:00 y prohíben mencionar la ruta 19–21 — hoy es justo al revés.

**Cómo tocar a SofIA cuando haga falta:** el PIT guardado en la skill `ghl-credenciales` devuelve 401. El camino que funciona es el workflow `actualizar-sofia.yml` del repo `ladys-reporte` (correrlo primero con `dry_run=true`, que deja el prompt en `debug/sofia_instructions.txt`). El script ya reafirma `isPrimary` y verifica después.

## Chequeo del 6-sep — hallazgos y arreglos

**Corregido:**
- 5.767 órdenes importadas estaban marcadas pagadas con el abonado en cero, y 22 con el abonado al doble. Se dejó `monto_abonado = monto_total` en las cerradas. Ahora el panel de cobranza dice la verdad.
- La función `ladys-detalle` duplicaba a `ladys-importar-detalle` y podía insertar el detalle histórico dos veces. Quedó respondiendo 410, no borrada, para que cualquier llamada vieja falle fuerte y no en silencio.

**Sano:**
- Cero huérfanos en las 12 tablas hijas tras el cambio de correlativo. Cero saldos negativos, cero órdenes sin cliente.
- Los feriados están cargados hasta diciembre, incluidas las Fiestas Patrias del 18 y 19.
- 25 funciones activas, token de Mercado Pago cargado, 77 servicios, 6 formas de pago, 4 usuarios.

**Por revisar con Lufi:**
- **1.838.555 por cobrar en 18 órdenes**, la más antigua del 22 de julio.
- 444 clientes activos sin teléfono: SofIA no los puede identificar cuando escriben.
- 33 direcciones sin coordenadas: quedan fuera del recorrido optimizado.
- 1.096 órdenes donde el detalle no suma el total cobrado. Es esperable (el detalle viene a precio de lista), pero varias muestran "cobrado 13.500" con montos de lista distintos, lo que parece un valor por defecto de la importación vieja.

## Deuda técnica conocida

- **Falta quitar el relleno de ceros en la API principal.** En `supabase/functions/ladys/index.ts`, la línea `const otTxt = (id) => "#" + String(id).padStart(5, "0")` hace que los mensajes al cliente digan `#06431` en vez de `#6431`. El resto del sistema ya se corrigió. Cambiar a `"#" + String(id)` y desplegar.

- **El reporte "Detalle de órdenes por fecha" de EasyLaundry va un mes atrasado.** Cada click en Consultar pierde el local seleccionado por el postback de ASP.NET, así que la tabla muestra el resultado de la consulta anterior. Para traer el mes N hay que pedir el rango N a N+1 y quedarse con lo que llegue. Verificado: pedir solo mayo 2025 devuelve cero filas; pedir mayo–junio devuelve las 693 de mayo. **Nunca confiar en el mes que dice `por_mes`: hay que mirar la fecha de las propias filas.**
- Por lo mismo, el archivo trae meses repetidos. Hay que **deduplicar por fila exacta** antes de sumar, o los montos salen al doble.

- **Resuelto (6-sep):** el repo tenía la v2.0.0 de `supabase/functions/ladys/index.ts` mientras producción corría la v2.1.0. Se bajó la versión real y quedó commiteada. **Antes de desplegar cualquier función, comparar contra lo que corre en Supabase** — el repo no siempre es la verdad.

- **El filtrado del menú por perfil es solo visual**, no hay bloqueo en el servidor. Alcanza para tres personas; hay que reforzarlo cuando el equipo crezca.
- Los montos de Mercado Pago Point en Chile van **como texto y sin decimales**. La documentación de México dice lo contrario y devuelve 400.
- `print_on_terminal` en modo PDV solo acepta `seller_ticket`. `buyer_ticket` exige modo autoservicio.
