// test/chat.motor.test.ts
// Pruebas unitarias del motor de reglas del asistente (Fase 3). No usan base de
// datos: ChatDatos se reemplaza por datos simulados, así se comprueba la lógica
// de selección de intención, la extracción de datos y, sobre todo, que cada
// consulta use la identidad del token y no datos del mensaje.
import {
  responder,
  detectarIntencion,
  normalizar,
  UMBRAL_STOCK_BAJO,
} from '../src/chat/motor';
import { ChatDatos, Contexto } from '../src/chat/tipos';

const cliente: Contexto = { usuario_id: 7, rol: 'cliente', tienda_id: null };
const vendedor: Contexto = { usuario_id: 3, rol: 'vendedor', tienda_id: 2 };
const admin: Contexto = { usuario_id: 1, rol: 'administrador', tienda_id: 1 };

const datosFalsos = (o: Partial<ChatDatos> = {}): ChatDatos => ({
  nombreUsuario: jest.fn().mockResolvedValue('Ana Pérez'),
  pedidosDelCliente: jest.fn().mockResolvedValue([]),
  pedidoDelCliente: jest.fn().mockResolvedValue(null),
  buscarProductos: jest.fn().mockResolvedValue([]),
  conteoPedidosPorEstadoTienda: jest.fn().mockResolvedValue({}),
  productosStockBajo: jest.fn().mockResolvedValue([]),
  resumenResenasTienda: jest
    .fn()
    .mockResolvedValue({ total: 0, promedio: null, recientes: [] }),
  conteosGlobales: jest
    .fn()
    .mockResolvedValue({ tiendas: 0, usuarios: 0, productos: 0, pedidos: 0 }),
  ...o,
});

const pedido = (extra: Record<string, unknown> = {}) => ({
  id: 12,
  cantidad: 2,
  estado: 'enviado',
  fecha_pedido: new Date(2026, 10, 12, 12, 0, 0),
  producto_nombre: 'Camisa Azul',
  tiene_resena: false,
  ...extra,
});

describe('normalizar', () => {
  it('quita tildes, signos y mayúsculas', () => {
    expect(normalizar('¿Cómo DEJO una Reseña?')).toBe('como dejo una resena');
  });
  it('conserva el # y los números del pedido', () => {
    expect(normalizar('Pedido #12!')).toBe('pedido #12');
  });
});

describe('detectarIntencion', () => {
  const casos: [string, 'cliente' | 'vendedor' | 'administrador', string | null][] = [
    ['Hola', 'cliente', 'saludo'],
    ['buenas tardes', 'vendedor', 'saludo'],
    ['¿Cuál es el estado de mi pedido #12?', 'cliente', 'estado_pedido'],
    ['pedido 7', 'cliente', 'estado_pedido'],
    ['¿dónde está mi compra?', 'cliente', 'estado_pedido'],
    ['mis pedidos', 'cliente', 'mis_pedidos'],
    ['quiero ver mi historial', 'cliente', 'mis_pedidos'],
    ['¿cómo compro?', 'cliente', 'como_comprar'],
    ['quiero calificar mi compra', 'cliente', 'como_resenar'],
    ['ya me llegó, quiero dejar una reseña', 'cliente', 'como_resenar'],
    ['quiero cancelar mi pedido', 'cliente', 'cancelar'],
    ['necesito una devolución', 'cliente', 'cancelar'],
    ['quiero pagar con tarjeta', 'cliente', 'pagos'],
    ['¿cuánto tarda el envío?', 'cliente', 'envios'],
    ['¿qué significa pendiente?', 'cliente', 'estados_pedido'],
    ['¿qué significa cancelado?', 'cliente', 'estados_pedido'],
    ['¿cuánto cuesta la camisa?', 'cliente', 'buscar_producto'],
    ['quiero hablar con un asesor', 'cliente', 'humano'],
    ['muchas gracias', 'cliente', 'despedida'],
    ['ayuda', 'vendedor', 'ayuda'],
    ['asdfgh qwerty', 'cliente', null],
    ['pedidos pendientes', 'vendedor', 'pedidos_pendientes'],
    ['stock bajo', 'vendedor', 'stock_bajo'],
    ['¿qué productos se me agotan?', 'vendedor', 'stock_bajo'],
    ['resumen de reseñas', 'vendedor', 'resumen_resenas'],
    ['¿cuál es mi calificación promedio?', 'vendedor', 'resumen_resenas'],
    ['¿cómo cambio el estado de un pedido?', 'vendedor', 'como_estado'],
    ['¿cómo creo un producto?', 'vendedor', 'como_producto'],
    ['precio de camisa', 'vendedor', 'buscar_producto'],
    ['resumen', 'administrador', 'resumen_admin'],
    ['¿cuántos usuarios hay?', 'administrador', 'resumen_admin'],
    ['¿cómo creo una tienda?', 'administrador', 'como_admin'],
  ];
  it.each(casos)('«%s» (%s) -> %s', (texto, rol, esperada) => {
    expect(detectarIntencion(texto, rol)).toBe(esperada);
  });

  it('un cliente no puede activar intenciones de vendedor', () => {
    expect(detectarIntencion('stock bajo', 'cliente')).not.toBe('stock_bajo');
    expect(detectarIntencion('pedidos pendientes', 'cliente')).not.toBe('pedidos_pendientes');
    expect(detectarIntencion('resumen', 'cliente')).not.toBe('resumen_admin');
  });

  it('un vendedor no puede activar las de cliente ni las de administrador', () => {
    expect(detectarIntencion('estado de mi pedido #5', 'vendedor')).not.toBe('estado_pedido');
    expect(detectarIntencion('resumen', 'vendedor')).not.toBe('resumen_admin');
  });
});

describe('responder: saludo y ayuda', () => {
  it('saluda por el primer nombre y ofrece el menú del rol', async () => {
    const res = await responder('hola', cliente, datosFalsos());
    expect(res.intencion).toBe('saludo');
    expect(res.respuesta).toContain('Hola, Ana');
    expect(res.opciones.map((o) => o.texto)).toContain('Mis pedidos');
  });

  it('el menú del vendedor no ofrece acciones de cliente', async () => {
    const res = await responder('ayuda', vendedor, datosFalsos());
    const textos = res.opciones.map((o) => o.texto);
    expect(textos).toContain('Stock bajo');
    expect(textos).not.toContain('Mis pedidos');
  });

  it('sin coincidencias responde no_entendido con el menú', async () => {
    const res = await responder('asdfgh', cliente, datosFalsos());
    expect(res.intencion).toBe('no_entendido');
    expect(res.opciones.length).toBeGreaterThan(0);
  });
});

describe('responder: cliente y pedidos', () => {
  it('consulta el pedido con el id del token, no con datos del mensaje', async () => {
    const datos = datosFalsos({ pedidoDelCliente: jest.fn().mockResolvedValue(pedido()) });
    const res = await responder('estado del pedido #12', cliente, datos);
    expect(datos.pedidoDelCliente).toHaveBeenCalledWith(cliente.usuario_id, 12);
    expect(res.respuesta).toContain('Pedido #12: Camisa Azul (x2)');
    expect(res.respuesta).toContain('Estado: enviado');
    expect(res.respuesta).toContain('12/11/2026');
  });

  it('un pedido que no es suyo responde "no encontré" sin revelar datos', async () => {
    const datos = datosFalsos(); // pedidoDelCliente -> null
    const res = await responder('pedido #99', cliente, datos);
    expect(res.respuesta).toContain('No encontré el pedido #99');
    expect(res.respuesta).not.toContain('Estado:');
  });

  it('sin número y con varios pedidos pregunta cuál, con opciones', async () => {
    const datos = datosFalsos({
      pedidosDelCliente: jest
        .fn()
        .mockResolvedValue([pedido({ id: 3 }), pedido({ id: 2 }), pedido({ id: 1 })]),
    });
    const res = await responder('estado de mi pedido', cliente, datos);
    expect(res.opciones).toHaveLength(3);
    expect(res.opciones[0].valor).toBe('estado del pedido #3');
  });

  it('sin número y con un solo pedido lo muestra directamente', async () => {
    const datos = datosFalsos({
      pedidosDelCliente: jest.fn().mockResolvedValue([pedido({ id: 9 })]),
    });
    const res = await responder('¿dónde está mi pedido?', cliente, datos);
    expect(res.respuesta).toContain('Pedido #9');
  });

  it('sin pedidos lo indica', async () => {
    const res = await responder('estado de mi pedido', cliente, datosFalsos());
    expect(res.respuesta).toContain('Aún no tienes pedidos');
  });

  it('un pedido entregado sin reseña invita a calificar', async () => {
    const datos = datosFalsos({
      pedidoDelCliente: jest.fn().mockResolvedValue(pedido({ estado: 'entregado' })),
    });
    const res = await responder('pedido #12', cliente, datos);
    expect(res.respuesta).toContain('Aún no lo has calificado');
    expect(res.opciones[0].valor).toBe('como dejo una reseña');
  });

  it('«mis pedidos» lista con estado y fecha', async () => {
    const datos = datosFalsos({
      pedidosDelCliente: jest.fn().mockResolvedValue([pedido({ id: 5, estado: 'pagado' })]),
    });
    const res = await responder('mis pedidos', cliente, datos);
    expect(res.respuesta).toContain('• #5 Camisa Azul (x2), pagado, 12/11/2026');
    expect(datos.pedidosDelCliente).toHaveBeenCalledWith(cliente.usuario_id, 5);
  });
});

describe('responder: preguntas frecuentes (FAQ)', () => {
  it.each([
    ['como compro', 'Catálogo'],
    ['como dejo una reseña', 'entregado'],
    ['quiero pagar', 'no cobra en línea'],
    ['cuanto tarda el envio', 'dependen de cada tienda'],
    ['quiero cancelar', 'todavía no permite cancelar'],
    ['que significa enviado', 'pendiente'],
  ])('«%s» menciona «%s»', async (texto, fragmento) => {
    const res = await responder(texto, cliente, datosFalsos());
    expect(res.respuesta).toContain(fragmento);
  });

  it('las FAQ no consultan la base de datos', async () => {
    const datos = datosFalsos();
    await responder('como compro', cliente, datos);
    await responder('quiero pagar', cliente, datos);
    expect(datos.pedidosDelCliente).not.toHaveBeenCalled();
    expect(datos.buscarProductos).not.toHaveBeenCalled();
  });
});

describe('responder: búsqueda de productos', () => {
  it('extrae los términos, pasa plurales a singular y da formato de moneda', async () => {
    const datos = datosFalsos({
      buscarProductos: jest.fn().mockResolvedValue([
        { id: 1, nombre: 'Zapatos Rojos', sku: 'ZAP-1', precio: '699900.00', stock: 4, tienda_nombre: 'Calzado SA' },
        { id: 2, nombre: 'Zapatos Negros', sku: 'ZAP-2', precio: 120000, stock: 0, tienda_nombre: 'Calzado SA' },
      ]),
    });
    const res = await responder('¿Cuánto cuestan los zapatos rojos?', cliente, datos);
    expect(datos.buscarProductos).toHaveBeenCalledWith(['zapato', 'rojo'], 5);
    expect(res.respuesta).toContain('• Zapatos Rojos (ZAP-1): $699.900, 4 disponibles, Calzado SA');
    expect(res.respuesta).toContain('$120.000, agotado');
  });

  it('sin nombre de producto pregunta qué busca, sin consultar', async () => {
    const datos = datosFalsos();
    const res = await responder('quiero buscar un producto', cliente, datos);
    expect(res.respuesta).toContain('¿Qué producto buscas?');
    expect(datos.buscarProductos).not.toHaveBeenCalled();
  });

  it('«catálogo» lista productos sin filtro', async () => {
    const datos = datosFalsos();
    await responder('catalogo', cliente, datos);
    expect(datos.buscarProductos).toHaveBeenCalledWith([], 5);
  });

  it('sin resultados lo dice', async () => {
    const res = await responder('precio de unicornio', cliente, datosFalsos());
    expect(res.respuesta).toContain('No encontré productos');
    expect(res.respuesta).toContain('unicornio');
  });

  it('los comodines y signos del mensaje no llegan a la búsqueda', async () => {
    const datos = datosFalsos();
    await responder("precio de '; DROP TABLE x; -- %", cliente, datos);
    const terminos = (datos.buscarProductos as jest.Mock).mock.calls[0][0] as string[];
    for (const t of terminos) expect(t).toMatch(/^[a-z0-9]+$/);
  });
});

describe('responder: vendedor', () => {
  it('usa la tienda del token para el stock bajo', async () => {
    const datos = datosFalsos({
      productosStockBajo: jest.fn().mockResolvedValue([
        { nombre: 'Gorra', sku: 'G-1', stock: 0 },
        { nombre: 'Cinturón', sku: 'C-1', stock: 3 },
      ]),
    });
    const res = await responder('stock bajo', vendedor, datos);
    expect(datos.productosStockBajo).toHaveBeenCalledWith(2, UMBRAL_STOCK_BAJO, 10);
    expect(res.respuesta).toContain('• Gorra (G-1): agotado');
    expect(res.respuesta).toContain('• Cinturón (C-1): 3 uds');
  });

  it('stock bajo sin productos en riesgo', async () => {
    const res = await responder('stock bajo', vendedor, datosFalsos());
    expect(res.respuesta).toContain('más de 5 unidades');
  });

  it('resume pedidos por estado y avisa los pendientes', async () => {
    const datos = datosFalsos({
      conteoPedidosPorEstadoTienda: jest
        .fn()
        .mockResolvedValue({ pendiente: 4, pagado: 2, entregado: 1 }),
    });
    const res = await responder('pedidos pendientes', vendedor, datos);
    expect(datos.conteoPedidosPorEstadoTienda).toHaveBeenCalledWith(2);
    expect(res.respuesta).toContain('7 en total');
    expect(res.respuesta).toContain('• pendiente: 4');
    expect(res.respuesta).toContain('Tienes 4 por atender');
  });

  it('resume reseñas con promedio en formato local', async () => {
    const datos = datosFalsos({
      resumenResenasTienda: jest.fn().mockResolvedValue({
        total: 3,
        promedio: 4.333,
        recientes: [
          { calificacion: '5.0', producto_nombre: 'Gorra', comentario: 'Excelente' },
          { calificacion: '4.0', producto_nombre: 'Camisa', comentario: null },
        ],
      }),
    });
    const res = await responder('resumen de reseñas', vendedor, datos);
    expect(datos.resumenResenasTienda).toHaveBeenCalledWith(2);
    expect(res.respuesta).toContain('3 reseñas con un promedio de 4,3 de 5');
    expect(res.respuesta).toContain('• 5,0 · Gorra: «Excelente»');
    expect(res.respuesta).toContain('• 4,0 · Camisa');
  });

  it('un vendedor sin tienda asignada no consulta nada', async () => {
    const datos = datosFalsos();
    const res = await responder('stock bajo', { ...vendedor, tienda_id: null }, datos);
    expect(res.intencion).toBe('sin_tienda');
    expect(datos.productosStockBajo).not.toHaveBeenCalled();
  });
});

describe('responder: administrador', () => {
  it('muestra los conteos globales', async () => {
    const datos = datosFalsos({
      conteosGlobales: jest
        .fn()
        .mockResolvedValue({ tiendas: 2, usuarios: 9, productos: 30, pedidos: 120 }),
    });
    const res = await responder('resumen', admin, datos);
    expect(res.respuesta).toContain('• Tiendas: 2');
    expect(res.respuesta).toContain('• Pedidos: 120');
  });
});
