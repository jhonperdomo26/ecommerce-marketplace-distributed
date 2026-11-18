// src/chat/motor.ts
// Motor de reglas deterministas del asistente virtual (Fase 3).
//
// Funcionamiento:
//   1. Se normaliza el mensaje (minúsculas, sin tildes ni signos).
//   2. Cada intención puntúa según las palabras clave que contiene el mensaje
//      (palabra suelta = 1 punto por prefijo, frase = 2, clave fuerte = 4).
//   3. Solo compiten las intenciones permitidas para el rol del token.
//   4. Gana la de mayor puntaje; si empatan, la que aparece primero en la lista.
//   5. Sin coincidencias, se responde con un mensaje de ayuda y el menú del rol.
//
// El servidor no guarda estado de conversación: los flujos de varios pasos
// (por ejemplo «¿de cuál pedido?») se resuelven devolviendo `opciones` cuyo
// `valor` ya trae toda la información («estado del pedido #12»).
import {
  ChatDatos,
  Contexto,
  Opcion,
  PedidoCliente,
  RespuestaChat,
  Rol,
} from './tipos';

export const UMBRAL_STOCK_BAJO = 5;
const MAX_ITEMS = 5;

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes (ñ -> n)
    .replace(/[^a-z0-9#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Mensaje {
  norm: string;
  tokens: string[];
  pedidoId: number | null;
}

function analizar(texto: string): Mensaje {
  const norm = normalizar(texto);
  const m = norm.match(
    /(?:#\s*|\b(?:pedido|orden|compra)\s+(?:(?:numero|num|no|n)\s+)?)(\d{1,9})\b/
  );
  return {
    norm,
    tokens: norm.split(' ').filter(Boolean),
    pedidoId: m ? Number(m[1]) : null,
  };
}

const moneda = (n: number | string): string =>
  '$' + Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const nota = (n: number | string): string => Number(n).toFixed(1).replace('.', ',');

const fecha = (f: Date | string): string => {
  const d = new Date(f);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const corto = (s: string, max: number): string =>
  s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;

// ---------------------------------------------------------------------------
// Textos fijos
// ---------------------------------------------------------------------------

const EXPLICACION_ESTADO: Record<string, string> = {
  pendiente:
    'Tu pedido quedó registrado y está a la espera de que la tienda lo procese.',
  pagado: 'La tienda registró el pago y está preparando tu pedido.',
  enviado: 'La tienda ya despachó tu pedido.',
  entregado: 'Tu pedido fue entregado. Ya puedes dejar una reseña.',
  cancelado: 'El pedido fue cancelado.',
};

const ORDEN_ESTADOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];

const MENU: Record<Rol, Opcion[]> = {
  cliente: [
    { texto: 'Estado de mi pedido', valor: 'estado de mi pedido' },
    { texto: 'Mis pedidos', valor: 'mis pedidos' },
    { texto: 'Buscar un producto', valor: 'quiero buscar un producto' },
    { texto: '¿Cómo compro?', valor: 'como compro' },
    { texto: 'Dejar una reseña', valor: 'como dejo una reseña' },
  ],
  vendedor: [
    { texto: 'Pedidos por estado', valor: 'pedidos pendientes' },
    { texto: 'Stock bajo', valor: 'stock bajo' },
    { texto: 'Mis reseñas', valor: 'resumen de reseñas' },
    { texto: 'Cambiar estado de pedido', valor: 'como cambio el estado de un pedido' },
    { texto: 'Crear un producto', valor: 'como creo un producto' },
  ],
  administrador: [
    { texto: 'Resumen del sistema', valor: 'resumen' },
    { texto: 'Crear una tienda', valor: 'como creo una tienda' },
    { texto: 'Crear un usuario', valor: 'como creo un usuario' },
  ],
};

const CAPACIDADES: Record<Rol, string> = {
  cliente:
    '• Consultar el estado de tus pedidos\n' +
    '• Buscar productos y ver su precio y disponibilidad\n' +
    '• Explicarte cómo comprar, pagar, cancelar y dejar una reseña',
  vendedor:
    '• Resumir los pedidos de tu tienda por estado\n' +
    '• Avisarte qué productos tienen poco stock\n' +
    '• Resumir las reseñas de tus productos\n' +
    '• Explicarte cómo cambiar estados y crear productos',
  administrador:
    '• Mostrarte un resumen general del sistema\n' +
    '• Explicarte cómo crear tiendas y usuarios',
};

const r = (
  intencion: string,
  respuesta: string,
  opciones: Opcion[]
): RespuestaChat => ({ intencion, respuesta, opciones });

// ---------------------------------------------------------------------------
// Intenciones
// ---------------------------------------------------------------------------

type Manejador = (
  m: Mensaje,
  ctx: Contexto,
  datos: ChatDatos
) => Promise<RespuestaChat>;

interface Intencion {
  id: string;
  roles: Rol[];
  claves: string[]; // sin espacio: prefijo de palabra (1 pt); con espacio: frase (2 pts)
  fuertes?: string[]; // mismas reglas de coincidencia, 4 pts (intención inequívoca)
  manejar: Manejador;
}

const TODOS: Rol[] = ['cliente', 'vendedor', 'administrador'];

// Palabras que no forman parte del nombre del producto buscado.
const PALABRAS_VACIAS = new Set(
  (
    'precio precios cuesta cuestan cuanto cuantos vale valor valen stock disponible ' +
    'disponibles disponibilidad hay tienen tiene buscar busco buscando quiero quisiera ' +
    'necesito un una unos unas el la los las lo de del al en para por me mi mis que ' +
    'cual cuales es son esta estan quedan unidades unidad producto productos catalogo ' +
    'articulo articulos favor y o con sin sku ver mostrar mostrarme dime dame tienda ' +
    'hola buenas si'
  ).split(' ')
);

// «zapatos» -> «zapato»: el catálogo se busca por subcadena, así el plural coincide.
const singular = (t: string): string =>
  t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t;

export function extraerTerminos(m: Mensaje): string[] {
  return m.tokens
    .filter((t) => t.length > 1 && !PALABRAS_VACIAS.has(t) && !/^#?\d+$/.test(t))
    .map(singular)
    .slice(0, 5);
}

function detallePedido(p: PedidoCliente): RespuestaChat {
  const lineas = [
    `Pedido #${p.id}: ${p.producto_nombre} (x${p.cantidad})`,
    `Estado: ${p.estado}`,
    `Fecha: ${fecha(p.fecha_pedido)}`,
    EXPLICACION_ESTADO[p.estado] ?? '',
  ];
  const opciones: Opcion[] = [{ texto: 'Mis pedidos', valor: 'mis pedidos' }];
  if (p.estado === 'entregado' && !p.tiene_resena) {
    lineas.push('Aún no lo has calificado: puedes hacerlo desde Mis Pedidos.');
    opciones.unshift({ texto: '¿Cómo dejo una reseña?', valor: 'como dejo una reseña' });
  }
  return r('estado_pedido', lineas.filter(Boolean).join('\n'), opciones);
}

const INTENCIONES: Intencion[] = [
  // ---- Comunes -------------------------------------------------------------
  {
    id: 'saludo',
    roles: TODOS,
    claves: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos', 'hey'],
    manejar: async (_m, ctx, datos) => {
      const nombre = await datos.nombreUsuario(ctx.usuario_id);
      const primero = nombre ? nombre.trim().split(' ')[0] : '';
      return r(
        'saludo',
        `Hola${primero ? ', ' + primero : ''}. Soy el asistente virtual de la plataforma. ¿En qué te puedo ayudar?`,
        MENU[ctx.rol]
      );
    },
  },
  {
    id: 'ayuda',
    roles: TODOS,
    claves: ['ayuda', 'ayudame', 'menu', 'opciones', 'que puedes', 'que haces', 'como funciona', 'help'],
    manejar: async (_m, ctx) =>
      r('ayuda', `Esto es lo que puedo hacer por ti:\n${CAPACIDADES[ctx.rol]}`, MENU[ctx.rol]),
  },
  {
    id: 'despedida',
    roles: TODOS,
    claves: ['gracias', 'adios', 'chao', 'chau', 'hasta luego', 'bye', 'nos vemos'],
    manejar: async (_m, ctx) =>
      r('despedida', '¡Con gusto! Si necesitas algo más, aquí estaré.', MENU[ctx.rol].slice(0, 3)),
  },
  {
    id: 'humano',
    roles: TODOS,
    claves: ['asesor', 'humano', 'agente', 'soporte', 'contacto', 'contactar', 'hablar con', 'persona real'],
    manejar: async (_m, ctx) =>
      r(
        'humano',
        'Este chat no puede conectarte con una persona. Si se trata de un pedido, contacta directamente a la tienda que lo vendió; si es un problema con la plataforma, comunícate con el administrador.',
        MENU[ctx.rol].slice(0, 3)
      ),
  },

  // ---- Cliente -------------------------------------------------------------
  {
    id: 'estado_pedido',
    roles: ['cliente'],
    claves: [
      'estado', 'seguimiento', 'rastre', 'donde esta', 'donde va', 'llego', 'llegar',
      'cuando llega', 'mi pedido', 'mi compra', 'mi orden',
    ],
    manejar: async (m, ctx, datos) => {
      if (m.pedidoId) {
        const p = await datos.pedidoDelCliente(ctx.usuario_id, m.pedidoId);
        if (!p) {
          return r(
            'estado_pedido',
            `No encontré el pedido #${m.pedidoId} entre tus pedidos. Revisa el número en la pestaña Mis Pedidos.`,
            [{ texto: 'Mis pedidos', valor: 'mis pedidos' }]
          );
        }
        return detallePedido(p);
      }
      const lista = await datos.pedidosDelCliente(ctx.usuario_id, MAX_ITEMS);
      if (lista.length === 0) {
        return r('estado_pedido', 'Aún no tienes pedidos. Cuando compres algo, podrás seguirlo aquí.', [
          { texto: 'Buscar un producto', valor: 'quiero buscar un producto' },
          { texto: '¿Cómo compro?', valor: 'como compro' },
        ]);
      }
      if (lista.length === 1) return detallePedido(lista[0]);
      return r(
        'estado_pedido',
        'Estos son tus últimos pedidos. ¿De cuál quieres saber el estado?',
        lista.map((p) => ({
          texto: corto(`#${p.id} ${p.producto_nombre}`, 30),
          valor: `estado del pedido #${p.id}`,
        }))
      );
    },
  },
  {
    id: 'mis_pedidos',
    roles: ['cliente'],
    claves: ['mis pedidos', 'mis compras', 'mis ordenes', 'historial', 'ultimos pedidos', 'lista de pedidos'],
    manejar: async (_m, ctx, datos) => {
      const lista = await datos.pedidosDelCliente(ctx.usuario_id, MAX_ITEMS);
      if (lista.length === 0) {
        return r('mis_pedidos', 'Aún no tienes pedidos registrados.', [
          { texto: 'Buscar un producto', valor: 'quiero buscar un producto' },
        ]);
      }
      const filas = lista.map(
        (p) => `• #${p.id} ${p.producto_nombre} (x${p.cantidad}), ${p.estado}, ${fecha(p.fecha_pedido)}`
      );
      return r('mis_pedidos', `Tus últimos pedidos:\n${filas.join('\n')}`, [
        { texto: 'Estado de un pedido', valor: 'estado de mi pedido' },
      ]);
    },
  },
  {
    id: 'como_comprar',
    roles: ['cliente'],
    claves: ['compr', 'como pido', 'hacer un pedido', 'realizar un pedido', 'quiero comprar', 'como compro'],
    manejar: async () =>
      r(
        'como_comprar',
        'Para comprar:\n1. Abre la pestaña Catálogo en la app.\n2. Toca el producto que te interesa.\n3. Elige la cantidad y pulsa Comprar.\nEl stock se descuenta al instante; si no alcanza, la app te lo avisa. Después sigues el pedido en Mis Pedidos.',
        [
          { texto: 'Estado de mi pedido', valor: 'estado de mi pedido' },
          { texto: 'Métodos de pago', valor: 'como pago' },
        ]
      ),
  },
  {
    id: 'como_resenar',
    roles: ['cliente'],
    claves: ['comentario', 'estrellas', 'valorar'],
    fuertes: ['resen', 'calific', 'opin'],
    manejar: async () =>
      r(
        'como_resenar',
        'Solo puedes calificar pedidos en estado «entregado», una vez por pedido. Ve a Mis Pedidos y pulsa Calificar en el pedido; eliges una nota de 1 a 5 y, si quieres, dejas un comentario.',
        [{ texto: 'Mis pedidos', valor: 'mis pedidos' }]
      ),
  },
  {
    id: 'estados_pedido',
    roles: ['cliente', 'vendedor'],
    claves: ['que significa', 'que quiere decir', 'que es pendiente', 'que es pagado', 'que es enviado', 'que es entregado', 'estados'],
    fuertes: ['significa', 'significan'],
    manejar: async (_m, ctx) => {
      const filas = ORDEN_ESTADOS.map((e) => `• ${e}: ${EXPLICACION_ESTADO[e]}`);
      return r('estados_pedido', `Los estados de un pedido son:\n${filas.join('\n')}`, MENU[ctx.rol].slice(0, 3));
    },
  },
  {
    id: 'pagos',
    roles: ['cliente'],
    claves: ['pago', 'pagos', 'pagar', 'tarjeta', 'efectivo', 'transferencia', 'metodo de pago', 'metodos de pago', 'como pago'],
    manejar: async () =>
      r(
        'pagos',
        'Por ahora la app no cobra en línea. La tienda registra el pago y entonces tu pedido pasa al estado «pagado». Ponte de acuerdo con la tienda sobre la forma de pago.',
        [{ texto: 'Estado de mi pedido', valor: 'estado de mi pedido' }]
      ),
  },
  {
    id: 'envios',
    roles: ['cliente'],
    claves: ['envio', 'entrega', 'demora', 'tarda', 'despacho', 'tiempo de entrega'],
    manejar: async () =>
      r(
        'envios',
        'Los tiempos de envío dependen de cada tienda. Tu pedido pasa a «enviado» cuando la tienda lo despacha y a «entregado» cuando llega; puedes ver el estado actual en Mis Pedidos.',
        [{ texto: 'Estado de mi pedido', valor: 'estado de mi pedido' }]
      ),
  },
  {
    id: 'cancelar',
    roles: ['cliente'],
    claves: ['arrepenti', 'retracto'],
    fuertes: ['cancel', 'devol', 'reembols', 'anular'],
    manejar: async () =>
      r(
        'cancelar',
        'La app todavía no permite cancelar ni devolver pedidos por tu cuenta. Comunícate con la tienda que te vendió el producto: ella puede marcar el pedido como «cancelado».',
        [
          { texto: 'Estado de mi pedido', valor: 'estado de mi pedido' },
          { texto: 'Hablar con un asesor', valor: 'quiero hablar con un asesor' },
        ]
      ),
  },

  // ---- Catálogo (todos los roles) -------------------------------------------
  {
    id: 'buscar_producto',
    roles: TODOS,
    claves: [
      'precio', 'cuesta', 'cuanto vale', 'cuanto cuesta', 'valor', 'stock', 'disponible',
      'disponibilidad', 'tienen', 'buscar', 'busco', 'catalogo', 'producto', 'productos',
      'hay', 'quedan', 'unidades',
    ],
    manejar: async (m, _ctx, datos) => {
      const terminos = extraerTerminos(m);
      if (terminos.length === 0 && !m.norm.includes('catalogo')) {
        return r(
          'buscar_producto',
          '¿Qué producto buscas? Escribe su nombre, por ejemplo: «precio de camisa».',
          [{ texto: 'Ver el catálogo', valor: 'catalogo' }]
        );
      }
      const productos = await datos.buscarProductos(terminos, MAX_ITEMS);
      if (productos.length === 0) {
        return r(
          'buscar_producto',
          `No encontré productos que coincidan con «${terminos.join(' ')}». Prueba con otra palabra.`,
          [{ texto: 'Ver el catálogo', valor: 'catalogo' }]
        );
      }
      const filas = productos.map(
        (p) =>
          `• ${p.nombre} (${p.sku}): ${moneda(p.precio)}, ` +
          `${p.stock > 0 ? `${p.stock} disponibles` : 'agotado'}, ${p.tienda_nombre}`
      );
      const encabezado =
        terminos.length > 0 ? `Esto encontré para «${terminos.join(' ')}»:` : 'Algunos productos del catálogo:';
      return r('buscar_producto', `${encabezado}\n${filas.join('\n')}`, [
        { texto: 'Buscar otro producto', valor: 'quiero buscar un producto' },
      ]);
    },
  },

  // ---- Vendedor ------------------------------------------------------------
  {
    id: 'stock_bajo',
    roles: ['vendedor'],
    claves: ['stock bajo', 'poco stock', 'inventario', 'sin stock', 'reponer'],
    fuertes: ['agota'], // agota, agotan, agotado, agotarse...
    manejar: async (_m, ctx, datos) => {
      if (ctx.tienda_id == null) return sinTienda();
      const items = await datos.productosStockBajo(ctx.tienda_id, UMBRAL_STOCK_BAJO, 10);
      if (items.length === 0) {
        return r('stock_bajo', `Todos tus productos tienen más de ${UMBRAL_STOCK_BAJO} unidades.`, MENU.vendedor.slice(0, 3));
      }
      const filas = items.map((p) => `• ${p.nombre} (${p.sku}): ${p.stock === 0 ? 'agotado' : `${p.stock} uds`}`);
      return r(
        'stock_bajo',
        `Productos de tu tienda con ${UMBRAL_STOCK_BAJO} unidades o menos:\n${filas.join('\n')}`,
        [{ texto: 'Pedidos por estado', valor: 'pedidos pendientes' }]
      );
    },
  },
  {
    id: 'pedidos_pendientes',
    roles: ['vendedor'],
    claves: ['pendiente', 'pedidos', 'por despachar', 'por atender', 'nuevos pedidos', 'cuantos pedidos', 'pedidos de mi tienda', 'ventas'],
    manejar: async (_m, ctx, datos) => {
      if (ctx.tienda_id == null) return sinTienda();
      const conteo = await datos.conteoPedidosPorEstadoTienda(ctx.tienda_id);
      const total = Object.values(conteo).reduce((a, b) => a + b, 0);
      if (total === 0) return r('pedidos_pendientes', 'Tu tienda aún no tiene pedidos.', MENU.vendedor.slice(0, 3));
      const filas = ORDEN_ESTADOS.filter((e) => conteo[e]).map((e) => `• ${e}: ${conteo[e]}`);
      const atender = conteo.pendiente
        ? `\nTienes ${conteo.pendiente} por atender en la sección Pedidos.`
        : '';
      return r('pedidos_pendientes', `Pedidos de tu tienda (${total} en total):\n${filas.join('\n')}${atender}`, [
        { texto: 'Cambiar estado de pedido', valor: 'como cambio el estado de un pedido' },
        { texto: 'Stock bajo', valor: 'stock bajo' },
      ]);
    },
  },
  {
    id: 'resumen_resenas',
    roles: ['vendedor'],
    claves: ['comentario', 'estrellas', 'mis resenas', 'resumen de resenas'],
    fuertes: ['resen', 'calific', 'promedio', 'opin'],
    manejar: async (_m, ctx, datos) => {
      if (ctx.tienda_id == null) return sinTienda();
      const res = await datos.resumenResenasTienda(ctx.tienda_id);
      if (res.total === 0) return r('resumen_resenas', 'Tus productos aún no tienen reseñas.', MENU.vendedor.slice(0, 3));
      const recientes = res.recientes.map(
        (x) =>
          `• ${nota(x.calificacion)} · ${x.producto_nombre}` +
          (x.comentario ? `: «${corto(x.comentario, 80)}»` : '')
      );
      return r(
        'resumen_resenas',
        `Tienes ${res.total} reseña${res.total === 1 ? '' : 's'} con un promedio de ${nota(res.promedio ?? 0)} de 5.\nLas más recientes:\n${recientes.join('\n')}`,
        [{ texto: 'Stock bajo', valor: 'stock bajo' }]
      );
    },
  },
  {
    id: 'como_estado',
    roles: ['vendedor'],
    claves: ['cambiar estado', 'cambio el estado', 'como cambio', 'actualizar estado', 'despachar', 'marcar como'],
    manejar: async () =>
      r(
        'como_estado',
        'Entra a Pedidos, busca el pedido y usa la columna «Cambiar estado» para elegir pendiente, pagado, enviado, entregado o cancelado. Solo puedes modificar pedidos de productos de tu tienda.',
        [{ texto: 'Qué significa cada estado', valor: 'que significa cada estado' }]
      ),
  },
  {
    id: 'como_producto',
    roles: ['vendedor'],
    claves: ['crear producto', 'agregar producto', 'nuevo producto', 'subir producto', 'publicar producto', 'editar producto', 'como creo', 'como agrego'],
    manejar: async () =>
      r(
        'como_producto',
        'Entra a Productos, completa el formulario (nombre, SKU, precio y stock) y pulsa «Agregar producto». Para editar o eliminar uno, usa los botones de la columna Acciones.',
        [{ texto: 'Stock bajo', valor: 'stock bajo' }]
      ),
  },

  // ---- Administrador -------------------------------------------------------
  {
    id: 'resumen_admin',
    roles: ['administrador'],
    claves: ['resumen', 'estadisticas', 'cuantos usuarios', 'cuantas tiendas', 'total', 'conteo', 'metricas', 'panel'],
    manejar: async (_m, _ctx, datos) => {
      const c = await datos.conteosGlobales();
      return r(
        'resumen_admin',
        `Resumen del sistema:\n• Tiendas: ${c.tiendas}\n• Usuarios: ${c.usuarios}\n• Productos: ${c.productos}\n• Pedidos: ${c.pedidos}`,
        MENU.administrador.slice(1)
      );
    },
  },
  {
    id: 'como_admin',
    roles: ['administrador'],
    claves: ['crear tienda', 'nueva tienda', 'crear usuario', 'nuevo usuario', 'alta', 'activar usuario', 'desactivar', 'administrar', 'como creo'],
    manejar: async () =>
      r(
        'como_admin',
        'En Administración encuentras dos formularios: «Crear tienda» (nombre y dirección) y «Crear usuario» (vendedor o administrador, con su tienda). También puedes activar o desactivar usuarios desde la tabla de usuarios.',
        [{ texto: 'Resumen del sistema', valor: 'resumen' }]
      ),
  },
];

function sinTienda(): RespuestaChat {
  return r(
    'sin_tienda',
    'Tu usuario no tiene una tienda asignada, así que no puedo consultar esos datos. Pide al administrador que te asigne una.',
    []
  );
}

// ---------------------------------------------------------------------------
// Selección de la intención y respuesta
// ---------------------------------------------------------------------------

function coincide(clave: string, m: Mensaje): boolean {
  return clave.includes(' ')
    ? m.norm.includes(clave)
    : m.tokens.some((t) => t.startsWith(clave));
}

function puntuar(i: Intencion, m: Mensaje): number {
  let puntos = 0;
  for (const c of i.claves) if (coincide(c, m)) puntos += c.includes(' ') ? 2 : 1;
  for (const c of i.fuertes ?? []) if (coincide(c, m)) puntos += 4;
  // Un número de pedido explícito indica que el cliente pregunta por ese pedido.
  if (i.id === 'estado_pedido' && m.pedidoId) puntos += 2;
  return puntos;
}

export function detectarIntencion(texto: string, rol: Rol): string | null {
  const m = analizar(texto);
  return elegir(m, rol)?.id ?? null;
}

function elegir(m: Mensaje, rol: Rol): Intencion | null {
  let mejor: Intencion | null = null;
  let mejorPuntos = 0;
  for (const i of INTENCIONES) {
    if (!i.roles.includes(rol)) continue;
    const p = puntuar(i, m);
    if (p > mejorPuntos) {
      mejor = i;
      mejorPuntos = p;
    }
  }
  return mejor;
}

export async function responder(
  texto: string,
  ctx: Contexto,
  datos: ChatDatos
): Promise<RespuestaChat> {
  const m = analizar(texto);
  const intencion = elegir(m, ctx.rol);
  if (!intencion) {
    return r(
      'no_entendido',
      `No estoy seguro de haber entendido. Esto es lo que puedo hacer:\n${CAPACIDADES[ctx.rol]}`,
      MENU[ctx.rol]
    );
  }
  return intencion.manejar(m, ctx, datos);
}
