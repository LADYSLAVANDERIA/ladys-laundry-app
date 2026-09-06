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

## Otros

- Detalle por servicio de las 5.996 OT importadas de EasyLaundry.
- 45 direcciones con la comuna mal ("Valparaíso"); las coordenadas están bien. Geocodificación: 657 de 690 ubicadas.
- Avisos automáticos del Club.
- Lockers.
- Lista de precios que sube el 1 de noviembre.
- Unificación visual del PDF del reporte diario automático (a medias).
- Corrección de las etiquetas de Detergente y Suavizante en la próxima producción ("Hipoelergénico" está mal escrito).
- Reconectar `ladysconcon@gmail.com` o crear reenvío de los correos de BCI (hoy está conectado `xlufix@gmail.com`).
- Decidir el canal de aviso para el traspaso a agente humano (Telegram evaluado como el más confiable; falta aprobación de plantilla de WhatsApp).

## Deuda técnica conocida

- **Resuelto (6-sep):** el repo tenía la v2.0.0 de `supabase/functions/ladys/index.ts` mientras producción corría la v2.1.0. Se bajó la versión real y quedó commiteada. **Antes de desplegar cualquier función, comparar contra lo que corre en Supabase** — el repo no siempre es la verdad.

- **El filtrado del menú por perfil es solo visual**, no hay bloqueo en el servidor. Alcanza para tres personas; hay que reforzarlo cuando el equipo crezca.
- Los montos de Mercado Pago Point en Chile van **como texto y sin decimales**. La documentación de México dice lo contrario y devuelve 400.
- `print_on_terminal` en modo PDV solo acepta `seller_ticket`. `buyer_ticket` exige modo autoservicio.
