# Entregables del trabajo final — Ingeniería de Software II

Índice de lo que se entrega en cada fase. Alcance de esta entrega: **versión web** (vendedor y
administrador); la app móvil está en el repositorio pero queda fuera.

| Fase | Entregable que pide la actividad | Archivos | Estado |
| ---- | -------------------------------- | -------- | ------ |
| 1. Análisis y diseño arquitectónico | Documento de especificación de arquitectura y diagramas de componentes distribuidos (C4) | [`fase1/Especificacion_Arquitectura.pdf`](fase1/Especificacion_Arquitectura.pdf) (también `.docx`) | Entregado |
| 2. Construcción del núcleo | Repositorio con el MVP funcional, documentación de API (Swagger/OpenAPI) y scripts de base de datos | [`fase2/README.md`](fase2/README.md) (mapa del código), [`fase2/openapi.json`](fase2/openapi.json), `database/` | Entregado (ver nota) |
| 3. Automatización conversacional | Módulo de chat integrado en la interfaz con su lógica conectada al backend | [`Fase3_Chatbot.md`](Fase3_Chatbot.md), `backend/src/chat/`, `frontend/src/components/ChatWidget.jsx` | Entregado |
| 4. Aseguramiento de calidad | Informe de pruebas con métricas, gráficos de rendimiento y plan de mitigación | [`fase4/Informe_Aseguramiento_Calidad.pdf`](fase4/Informe_Aseguramiento_Calidad.pdf) (también `.docx`), [`fase4/graficos/`](fase4/graficos/), [`Fase4_Calidad.md`](Fase4_Calidad.md) | Entregado |
| 5. Despliegue y validación final | Software desplegado y operativo, manual técnico, manual de usuario y presentación | [`fase5/Manual_Tecnico.pdf`](fase5/Manual_Tecnico.pdf) (también `.docx`), [`fase5/Manual_Usuario_Web.pdf`](fase5/Manual_Usuario_Web.pdf), [`fase5/Presentacion_Defensa.pdf`](fase5/Presentacion_Defensa.pdf), [`fase5/capturas/`](fase5/capturas/), [`Fase5_Despliegue.md`](Fase5_Despliegue.md) (local), [`fase5/Despliegue_Nube.md`](fase5/Despliegue_Nube.md) (nube), `docker-compose.prod.yml`, `docker-compose.nube.yml` | Local listo; falta desplegar en la nube y la corrida final de pruebas |

**Nota sobre las fases 1 y 2.** La especificación de la Fase 1 propone una arquitectura de cinco
servicios con API Gateway y RabbitMQ, y una ruta de migración paso a paso desde el monolito. Lo
implementado es la base de esa ruta: una API modular en un solo servicio, contenerizada con Docker, con
el envío de notificaciones ya desacoplado de la operación de negocio. La extracción de servicios y la
cola de mensajes no están implementadas.

## Documentos de la actividad anterior

Estos archivos vienen del repositorio de partida y se conservan como antecedente; no son entregables de
este trabajo: `Manual_Tecnico_Ecommerce.docx`, `Informe_Practica_Validacion_Pruebas.docx`,
`INFORME_PRUEBAS_5.1_*.docx`, `INFORME_PRUEBAS_5.2_*.docx`, `Informe_Pruebas_5.3.docx`,
`Informe_Pruebas_Paso5_Completo.docx` y la carpeta `practica_validacion/`.
El plan de pruebas que ejecuta la Fase 4 es `Plan_de_Pruebas_Evaluacion_de_Calidad.docx` (con
`Protocolo_de_Campo_Usabilidad.docx` y `Planilla_SUS.xlsx` para las pruebas con usuarios pendientes).

## Versiones editables

Los documentos se redactaron como documentos compartidos de Claude; los PDF y DOCX de esta carpeta son
copias exportadas el 16 de noviembre de 2026. Si se editan los originales, hay que volver a exportarlos.
