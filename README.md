# 👕 Ladys Laundry App

> Sistema de gestión integral para lavanderías — basado en la experiencia real de Ladys Lavandería.

[![Stack](https://img.shields.io/badge/Stack-React%20%2B%20Node.js%20%2B%20PostgreSQL-blue)]()
[![Version](https://img.shields.io/badge/Version-1.0.0-green)]()
[![License](https://img.shields.io/badge/License-Privado-red)]()

## 🚀 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS + Lucide Icons |
| Estado Global | Zustand |
| Gráficos | Recharts |
| HTTP Client | Axios |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| Autenticación | JWT + Roles (Admin/Asistente) |
| Notificaciones | WhatsApp API |

## 📁 Estructura del Proyecto

```
ladys-laundry-app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js              # Pool PostgreSQL
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── clientesController.js
│   │   │   ├── ordenesController.js
│   │   │   └── dashboardController.js
│   │   ├── middleware/
│   │   │   └── auth.js            # JWT + roles
│   │   ├── routes/
│   │   │   └── index.js           # Todos los endpoints
│   │   └── index.js               # Entry point Express
│   ├── database/
│   │   └── schema.sql             # Schema PostgreSQL completo
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── Layout.tsx         # Sidebar + nav principal
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── Clientes.tsx
    │   │   ├── NuevoCliente.tsx
    │   │   ├── Ordenes.tsx
    │   │   ├── NuevaOrden.tsx
    │   │   ├── OrdenDetalle.tsx
    │   │   ├── Agenda.tsx
    │   │   ├── Servicios.tsx
    │   │   ├── Caja.tsx
    │   │   ├── Compras.tsx
    │   │   ├── Usuarios.tsx
    │   │   ├── Rutas.tsx
    │   │   ├── ReporteControl.tsx
    │   │   └── ConfigLocal.tsx
    │   ├── services/
    │   │   └── api.ts             # Todos los API calls
    │   ├── store/
    │   │   └── authStore.ts       # Estado de autenticación
    │   └── App.tsx                # Router principal
    ├── tailwind.config.js
    └── package.json
```

## 📋 Módulos del Sistema

### 🏠 Administración Local
- Parámetros generales (nombre, logo, horarios, cuenta bancaria)
- Días inhábiles (calendario interactivo)
- Rutas de delivery (por día, hora, tipo)
- Usuarios y roles (Admin / Asistente / Conductor)
- Registro de compras y gastos

### 👥 Clientes
- Clientes particulares con historial y prepago
- Clientes empresa con facturación y precios especiales
- Reporte de clientes por período
- Cumpleaños del mes

### 📋 Órdenes de Trabajo (OT)
- Generación de OT con búsqueda de cliente
- Estados: `PRE_ORDEN` → `EN_PROCESO` → `LISTA` → `ENTREGADA` → `PAGADA`
- Agenda de programación por ruta y fecha
- OT para entrega en local vs delivery
- Notificación WhatsApp al cliente
- Registro de bultos y etiquetas por prenda

### 💵 Caja y Facturación
- Apertura/cierre de caja con efectivo inicial
- Múltiples formas de pago (Efectivo, Transferencia, POS)
- Boletas y facturas
- Reporte de control diario por local
- Consolidado de facturación

### 🎟️ Prepagos
- Planes con duración y servicios incluidos
- Saldo y consumo por cliente

### 📊 Dashboard
- KPIs: Clientes, Recogidas, Entregas, Agendados hoy
- Gráfico de ventas diarias del período
- Comparativo mes actual vs mes anterior
- Ranking de servicios más usados

## 🛠️ Instalación Rápida

### Requisitos
- Node.js 18+
- PostgreSQL 14+
- npm o yarn

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tus credenciales de BD
createdb ladys_laundry
psql -U postgres -d ladys_laundry -f database/schema.sql
npm run dev
# API corriendo en http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
# Crear .env con VITE_API_URL=http://localhost:4000/api
npm run dev
# App corriendo en http://localhost:5173
```

## 🌟 Mejoras Planificadas

- [ ] App móvil para conductores (React Native + GPS)
- [ ] Portal de rastreo de OT para clientes
- [ ] Integración Webpay / MercadoPago
- [ ] Notificaciones push
- [ ] Módulo de inventario de insumos
- [ ] Sistema de fidelización con puntos
- [ ] Reportes avanzados con exportación PDF/Excel

## 📄 Licencia

Privado — Ladys Lavandería © 2026
