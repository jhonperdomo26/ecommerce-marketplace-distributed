# Matriz de calidad unificada — Práctica de Validación y Pruebas

| Dimensión | Caso / prueba | Herramienta | Resultado encontrado | Severidad | Estado |
|---|---|---|---|---|---|
| Rendimiento | `POST /api/pedidos` bajo concurrencia creciente (50→900 VUs) | k6 (Docker) | A 300 VUs: 0 % error, p95 = 775 ms. A 900 VUs: **4 % de fallas por timeout, p95 = 5.61 s** — el pool de `pg` sin `max` configurado (por defecto 10) se agota antes que la BD o el `FOR UPDATE`. | Alto | **Corregido** — `DB_POOL_MAX` configurable (default 30). Reverificado a 900 VUs: 0 % error, p95 = 2.67 s, **+69 % throughput**. |
| Usabilidad | Heurística Nielsen — formulario de login | Inspección experta (navegador) | Campos precargados con credenciales reales como *valor* (no placeholder): confunde y genera entradas corruptas. | Crítico | **Corregido** — campos inician vacíos; credenciales de prueba solo como texto de ayuda. |
| Usabilidad | Heurística Nielsen — listado de pedidos del vendedor | Inspección experta (navegador) | Sin paginación: con datos reales (69 429 pedidos tras las pruebas de carga) renderiza miles de filas sin control alguno. | Crítico | **Corregido** — `?page=&limit=` en el backend + controles "Anterior/Siguiente" en el frontend. |
| Usabilidad | Heurística Nielsen — formato de precios | Inspección experta (navegador) | `$699900.00` sin separador de miles ni formato local. | Bajo | No corregido (fuera del alcance priorizado). |
| Usabilidad | Escala SUS (evaluador real tras usar el panel) | Cuestionario SUS (10 ítems) | **70 / 100 — "Bueno"** (por encima del promedio de referencia ≈68). | Informativo | N/A |
| Seguridad | Fuga de información en respuestas 500 | Prueba dirigida (curl) | Objeto de error crudo de PostgreSQL expuesto (código SQL, archivo y línea del motor) en los 20 `catch` de los 5 controllers. | Alto | **Corregido** — manejador único `enviarErrorInterno` (log en servidor, mensaje genérico al cliente). |
| Seguridad | CORS sin restricción de origen | OWASP ZAP (Cross-Domain Misconfiguration) + curl | `Access-Control-Allow-Origin: *` para cualquier origen. | Medio | **Corregido** — origen restringido vía `CORS_ORIGIN` (default `http://localhost:5173`). |
| Seguridad | Sin límite de intentos de login | Prueba dirigida (curl, 11 intentos) | 10 intentos fallidos consecutivos sin bloqueo (riesgo de fuerza bruta). | Medio | **Corregido** — `express-rate-limit`: 10 intentos / 15 min por IP (HTTP 429). |
| Seguridad | Cabeceras de seguridad ausentes | OWASP ZAP baseline (6 WARN-NEW) | Sin `X-Content-Type-Options`, CSP, `Permissions-Policy`; `X-Powered-By: Express` expone la tecnología. | Bajo | **Corregido** — middleware `helmet()`. |

**Resumen del escaneo OWASP ZAP** (baseline, `http://localhost:3000`): 61 reglas en PASS, 0 FAIL, 6 WARN-NEW → tras clasificar: 0 High, 2 Medium (CORS, cacheable content), 3 Low (headers), 1 Informational.

## Plan correctivo aplicado

1. **Rendimiento:** `backend/src/db.ts` — `max: Number(process.env.DB_POOL_MAX) || 30` en el `Pool` de `pg`.
2. **Seguridad (prioridad alta):** `backend/src/utils/errores.ts` (nuevo) + reemplazo en los 5 controllers; `backend/src/app.ts` — `helmet()`, CORS restringido, `express-rate-limit` en `/api/auth/login`.
3. **Usabilidad:** `frontend/src/pages/Login.jsx` — campos vacíos por defecto; `backend/src/controllers/pedidos.controller.ts` + `frontend/src/components/PanelPedidos.jsx` — paginación de `GET /api/pedidos/por-tienda`.

Los tres fixes se verificaron en caliente (curl / k6 / navegador) y la suite Jest + Supertest (30 pruebas del Punto 5.3) se ajustó y sigue en verde.
