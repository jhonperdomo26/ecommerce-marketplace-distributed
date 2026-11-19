# Fase 4 — Aseguramiento de calidad (web)

Alcance: backend + frontend web. La app móvil queda fuera de esta entrega. El informe completo
(métricas, gráficos, hallazgos y plan de mitigación) está en el documento «Fase 4 — Informe de
Aseguramiento de Calidad» (versión 1.1 del 18 de noviembre de 2026, en `docs/fase4/`); este archivo es la
guía del repositorio.

## Qué se agregó

| Dimensión | Archivos | Cómo ejecutarlo |
| --------- | -------- | --------------- |
| Rendimiento | `backend/load/ren-suite.js`, `datos-volumen.sql`, `consistencia-stock.sql`, `analizar_resultados.py`, `muestreo_recursos.py` | Ver `backend/load/README.md` (sección Fase 4) |
| Seguridad | `backend/test/seguridad.test.ts`, `seguridad.autenticacion.test.ts`, `seguridad.limites.test.ts` | `cd backend && npm test -- seguridad` |
| Usabilidad | Correcciones en `frontend/src` (ver informe, sección 5) | `cd frontend && npm run build` |
| Gráficos y tablas | `docs/fase4/graficos/` | Los regenera `analizar_resultados.py` |

## Cambios en el código (mitigaciones)

Backend: `src/config.ts` (secreto JWT validado al arrancar), `src/utils/validar.ts` (validadores de
entrada), `src/middleware/auth.ts` (algoritmo fijado y usuario verificado en la BD en cada petición),
`src/app.ts` (límites de tasa configurables, `Cache-Control: no-store`, respuestas 404/400/413 en JSON,
`TRUST_PROXY`), y los controladores `auth`, `pedidos`, `productos`, `resenas` y `admin` (validación de
entradas, política de contraseñas, igualación del tiempo de respuesta del login). Dependencias: `bcrypt`
5 → 6 y `npm audit fix` (0 vulnerabilidades en producción).
Frontend: etiquetas de formulario asociadas, sesión vencida → login, precio formateado, contraseña mínima de 8.

## Variables de entorno nuevas

`JWT_SECRET` (obligatorio y ≥ 32 caracteres en producción), `LOGIN_RATE_LIMIT`, `REGISTRO_RATE_LIMIT`,
`CHAT_RATE_LIMIT`, `TRUST_PROXY`. Ver `backend/.env.example`.

> **Despliegue:** en producción la API **no arranca** sin `JWT_SECRET` propio. **(v1.1)** Cumplido en la
> Fase 5: el despliegue en Azure lo define en `.env` (P-01 cerrado en el informe).
