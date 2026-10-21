# Evaluación heurística (Nielsen) — Panel web de vendedor

Evaluador experto: asistente (navegación real con el navegador integrado de
Claude Code sobre `http://localhost:5173`, sesión `vendedor1@tutienda.com`).
Flujo evaluado: Login → Pedidos (`/pedidos`) → Productos (`/productos`) →
Reseñas (`/resenas`).

## Hallazgo 1 — Login precargado con credenciales reales (CRÍTICO)

**Heurística violada:** #5 Prevención de errores / #6 Reconocer mejor que
recordar.

El formulario de login (`frontend/src/pages/Login.jsx`) inicializaba los
campos `email` y `password` con `useState('vendedor1@tutienda.com')` y
`useState('Password123')`: no es un *placeholder*, es el **valor real** del
input. Al reproducir el flujo con un clic + escritura normal (sin seleccionar
primero todo el texto), el texto escrito se insertó en medio del valor
existente y produjo un correo corrupto
(`vendedor1@tutiendavendedor1@tutienda.com.com`), que el backend rechazó.
Un usuario nuevo que no se percate de que el campo ya tiene texto real
reproduce el mismo error. Además, expone credenciales operativas reales en
el código fuente del cliente.

**Evidencia:** reproducido en vivo contra `http://localhost:5173/login`
(ver transcripción de la sesión); confirmado leyendo
`frontend/src/pages/Login.jsx` líneas 17-18 (antes del fix).

**Corrección aplicada:** los campos inician vacíos (`useState('')`); el
texto de ayuda con las credenciales de prueba se mantiene como *texto
visible* debajo del formulario, nunca como valor precargado del input.

## Hallazgo 2 — Lista de pedidos sin paginación (CRÍTICO)

**Heurística violada:** #8 Estética y diseño minimalista / #7 Flexibilidad y
eficiencia de uso.

`GET /api/pedidos/por-tienda` devolvía **todos** los pedidos de la tienda sin
límite ni paginación, y `PanelPedidos.jsx` los renderizaba todos en una sola
tabla. Tras las pruebas de rendimiento del Módulo 1 (que crearon ~27 000
pedidos reales sobre la tienda del vendedor de prueba), la pantalla
`/pedidos` pasó a renderizar miles de filas: el árbol de accesibilidad de la
página superó los 50 KB solo en la porción visible, sin ningún control de
búsqueda, filtro o paginación para que el vendedor ubique un pedido concreto.
Esto degrada tanto la usabilidad (imposible ubicar un pedido entre miles) como
el rendimiento del navegador (DOM de miles de filas).

**Evidencia:** captura del árbol de accesibilidad de `/pedidos` tras las
pruebas de carga (cientos de `combobox` de cambio de estado sin paginación
visible).

**Corrección aplicada:** `listarPorTienda` acepta `?page=&limit=` (por
defecto 20 por página) y devuelve `{ datos, total, pagina, totalPaginas }`;
`PanelPedidos.jsx` agrega controles "Anterior / Siguiente" y el contador
"Página X de Y · N pedidos en total".

## Hallazgo 3 (menor, no corregido) — Formato de precios sin separador de miles

**Heurística violada:** #2 Coincidencia entre el sistema y el mundo real.

En `/productos` los precios se muestran como `$699900.00` en vez de un
formato localizado (`$699.900`). No se corrigió por ser de severidad baja y
no formar parte de los hallazgos priorizados de esta práctica.

## Resultado de la escala SUS

Ver [`cuestionario_sus.md`](cuestionario_sus.md): **70 / 100** ("Bueno").
