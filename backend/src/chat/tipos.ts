// src/chat/tipos.ts
// Tipos del asistente virtual (Fase 3). El motor de reglas (motor.ts) no conoce
// Express ni PostgreSQL: recibe un `Contexto` (quién pregunta, sacado del JWT)
// y un objeto `ChatDatos` (acceso a datos). Así se puede probar sin base de
// datos y, más adelante, extraer a un servicio propio (ver docs/Fase3_Chatbot.md).

export type Rol = 'cliente' | 'vendedor' | 'administrador';

// Identidad de quien pregunta. SIEMPRE sale del token, nunca del cuerpo de la
// petición: es lo que mantiene el aislamiento entre clientes y entre tiendas.
export interface Contexto {
  usuario_id: number;
  rol: Rol;
  tienda_id: number | null;
}

// Respuesta rápida que la interfaz muestra como botón. `valor` es el texto que
// se envía de vuelta al chat al pulsarla (el servidor no guarda estado).
export interface Opcion {
  texto: string;
  valor: string;
}

export interface RespuestaChat {
  respuesta: string;
  intencion: string;
  opciones: Opcion[];
}

export interface PedidoCliente {
  id: number;
  cantidad: number;
  estado: string;
  fecha_pedido: Date | string;
  producto_nombre: string;
  tiene_resena: boolean;
}

export interface ProductoBusqueda {
  id: number;
  nombre: string;
  sku: string;
  precio: number | string;
  stock: number;
  tienda_nombre: string;
}

export interface ProductoStock {
  nombre: string;
  sku: string;
  stock: number;
}

export interface ResumenResenas {
  total: number;
  promedio: number | null;
  recientes: {
    calificacion: number | string;
    producto_nombre: string;
    comentario: string | null;
  }[];
}

export interface ConteosGlobales {
  tiendas: number;
  usuarios: number;
  productos: number;
  pedidos: number;
}

// Contrato de acceso a datos del asistente. La implementación real (datos.ts)
// consulta PostgreSQL; en las pruebas unitarias se reemplaza por datos simulados.
export interface ChatDatos {
  nombreUsuario(usuarioId: number): Promise<string | null>;
  pedidosDelCliente(clienteId: number, limite: number): Promise<PedidoCliente[]>;
  pedidoDelCliente(
    clienteId: number,
    pedidoId: number
  ): Promise<PedidoCliente | null>;
  buscarProductos(terminos: string[], limite: number): Promise<ProductoBusqueda[]>;
  conteoPedidosPorEstadoTienda(tiendaId: number): Promise<Record<string, number>>;
  productosStockBajo(
    tiendaId: number,
    umbral: number,
    limite: number
  ): Promise<ProductoStock[]>;
  resumenResenasTienda(tiendaId: number): Promise<ResumenResenas>;
  conteosGlobales(): Promise<ConteosGlobales>;
}
