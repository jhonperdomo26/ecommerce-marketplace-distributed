// src/docs/openapi.ts
// Documentación OpenAPI 3.0 de la API (Fase 2). Se sirve como página interactiva en
// /api/docs y como JSON en /api/openapi.json. La prueba test/openapi.test.ts comprueba que
// cada ruta registrada en Express esté documentada aquí, y al revés.

const ref = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` });
const json = (schema: object, descripcion: string) => ({
  description: descripcion,
  content: { 'application/json': { schema } },
});
const err = (descripcion: string) => json(ref('Error'), descripcion);
const lista = (nombre: string) => ({ type: 'array', items: ref(nombre) });
const idPath = (nombre: string, descripcion: string) => ({
  name: nombre,
  in: 'path',
  required: true,
  description: descripcion,
  schema: { type: 'integer', minimum: 1 },
});
const cuerpo = (schema: object) => ({
  required: true,
  content: { 'application/json': { schema } },
});

// Respuestas comunes de las rutas protegidas
const protegida = {
  400: err('Datos inválidos, o token mal formado o expirado'),
  401: err('Usuario desactivado o inexistente, o rol sin permiso para esta ruta'),
  403: err('Falta el token, o el recurso pertenece a otra tienda'),
};

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'API Plataforma de Comercio Electrónico',
    version: '1.0.0',
    description:
      'API REST del marketplace multi-tienda. Roles: **cliente**, **vendedor** (solo su tienda) y ' +
      '**administrador**.\n\n' +
      'Para probar desde esta página: ejecute `POST /api/auth/login` (por ejemplo ' +
      '`vendedor1@tutienda.com` / `Password123` con la semilla de demostración), copie el `token` y ' +
      'péguelo en **Authorize**.\n\n' +
      'El rol, la tienda y el estado activo se leen de la base en cada petición: desactivar a un ' +
      'usuario corta su acceso de inmediato aunque su token no haya vencido.',
  },
  servers: [{ url: '/', description: 'Este mismo servidor (API directa o detrás de nginx)' }],
  tags: [
    { name: 'Autenticación' },
    { name: 'Productos' },
    { name: 'Pedidos' },
    { name: 'Reseñas' },
    { name: 'Administración' },
    { name: 'Asistente virtual' },
    { name: 'Salud' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { mensaje: { type: 'string', example: 'Token inválido o expirado.' } },
        required: ['mensaje'],
      },
      Rol: { type: 'string', enum: ['cliente', 'vendedor', 'administrador'] },
      EstadoPedido: {
        type: 'string',
        enum: ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'],
      },
      UsuarioSesion: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 2 },
          nombre: { type: 'string', example: 'Vendedor Uno' },
          email: { type: 'string', format: 'email', example: 'vendedor1@tutienda.com' },
          rol: ref('Rol'),
          tienda_id: { type: 'integer', nullable: true, example: 1 },
        },
      },
      Sesion: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT HS256, vence en 8 h' },
          usuario: ref('UsuarioSesion'),
        },
      },
      ProductoCatalogo: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string' },
          sku: { type: 'string' },
          precio: { type: 'string', description: 'NUMERIC(10,2) serializado como texto', example: '149900.00' },
          stock: { type: 'integer' },
          tienda_id: { type: 'integer' },
          tienda_nombre: { type: 'string' },
        },
      },
      Producto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string' },
          sku: { type: 'string' },
          precio: { type: 'string', example: '149900.00' },
          stock: { type: 'integer' },
          tienda_id: { type: 'integer' },
          vendedor_id: { type: 'integer' },
        },
      },
      ProductoEntrada: {
        type: 'object',
        required: ['nombre', 'sku', 'precio'],
        properties: {
          nombre: { type: 'string', maxLength: 100, example: 'Teclado mecánico' },
          sku: { type: 'string', maxLength: 20, description: 'Único en todo el sistema', example: 'SKU-TEC-002' },
          precio: { type: 'number', minimum: 0, maximum: 99999999.99, example: 149900 },
          stock: { type: 'integer', minimum: 0, default: 0, example: 10 },
        },
      },
      Pedido: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          cliente_id: { type: 'integer' },
          producto_id: { type: 'integer' },
          cantidad: { type: 'integer' },
          estado: ref('EstadoPedido'),
          fecha_pedido: { type: 'string', format: 'date-time' },
        },
      },
      PedidoTienda: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          cantidad: { type: 'integer' },
          estado: ref('EstadoPedido'),
          fecha_pedido: { type: 'string', format: 'date-time' },
          cliente_nombre: { type: 'string' },
          producto_nombre: { type: 'string' },
        },
      },
      PedidoCliente: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          cantidad: { type: 'integer' },
          estado: ref('EstadoPedido'),
          fecha_pedido: { type: 'string', format: 'date-time' },
          producto_id: { type: 'integer' },
          producto_nombre: { type: 'string' },
          tiene_resena: { type: 'boolean' },
        },
      },
      PedidoRespuesta: {
        type: 'object',
        properties: { mensaje: { type: 'string' }, datos: ref('Pedido') },
      },
      Resena: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          pedido_id: { type: 'integer' },
          calificacion: { type: 'string', example: '4.5' },
          comentario: { type: 'string', nullable: true },
          fecha_registro: { type: 'string', format: 'date-time' },
        },
      },
      ResenaListado: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          calificacion: { type: 'string', example: '4.5' },
          comentario: { type: 'string', nullable: true },
          fecha_registro: { type: 'string', format: 'date-time' },
          producto_nombre: { type: 'string', description: 'Solo en /mis-productos' },
          cliente_nombre: { type: 'string' },
        },
      },
      Tienda: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string' },
          direccion: { type: 'string', nullable: true },
          creado_en: { type: 'string', format: 'date-time' },
        },
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string' },
          email: { type: 'string', format: 'email' },
          rol: ref('Rol'),
          tienda_id: { type: 'integer', nullable: true },
          activo: { type: 'boolean' },
          tienda_nombre: { type: 'string', nullable: true, description: 'Solo en el listado' },
        },
      },
      Resumen: {
        type: 'object',
        description: 'Conteos globales (PostgreSQL los devuelve como texto)',
        properties: {
          tiendas: { type: 'string', example: '2' },
          usuarios: { type: 'string', example: '4' },
          productos: { type: 'string', example: '5' },
          pedidos: { type: 'string', example: '3' },
        },
      },
      RespuestaChat: {
        type: 'object',
        properties: {
          intencion: { type: 'string', example: 'stock_bajo' },
          respuesta: { type: 'string' },
          opciones: {
            type: 'array',
            description: 'Sugerencias para continuar (botones en la interfaz)',
            items: {
              type: 'object',
              properties: { texto: { type: 'string' }, valor: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/': {
      get: {
        tags: ['Salud'],
        summary: 'Sonda de salud',
        security: [],
        responses: {
          200: json(
            { type: 'object', properties: { servicio: { type: 'string' }, estado: { type: 'string', example: 'ok' } } },
            'La API está en marcha'
          ),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión',
        description: 'Límite: `LOGIN_RATE_LIMIT` intentos por IP cada 15 min (10 por defecto).',
        security: [],
        requestBody: cuerpo({
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'vendedor1@tutienda.com' },
            password: { type: 'string', format: 'password', example: 'Password123' },
          },
        }),
        responses: {
          200: json(ref('Sesion'), 'Sesión iniciada'),
          400: err('Faltan email o password'),
          401: err('Credenciales inválidas o usuario desactivado'),
          429: err('Demasiados intentos'),
        },
      },
    },
    '/api/auth/registro': {
      post: {
        tags: ['Autenticación'],
        summary: 'Crear una cuenta de cliente',
        description:
          'Siempre crea un **cliente**: los campos `rol`, `tienda_id` o `activo` se ignoran. ' +
          'Límite: `REGISTRO_RATE_LIMIT` altas por IP por hora (20 por defecto).',
        security: [],
        requestBody: cuerpo({
          type: 'object',
          required: ['nombre', 'email', 'password'],
          properties: {
            nombre: { type: 'string', maxLength: 100, example: 'Ana Pérez' },
            email: { type: 'string', format: 'email', maxLength: 150, example: 'ana@correo.com' },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
              description: 'De 8 a 72 bytes y distinta del correo',
              example: 'ClaveSegura123',
            },
          },
        }),
        responses: {
          201: json(ref('Sesion'), 'Cuenta creada'),
          400: err('Datos inválidos'),
          409: err('Ya existe un usuario con ese email'),
          429: err('Demasiados registros desde esta dirección'),
        },
      },
    },
    '/api/productos': {
      get: {
        tags: ['Productos'],
        summary: 'Catálogo de todas las tiendas',
        description: 'Cualquier usuario autenticado.',
        parameters: [
          {
            name: 'tienda_id',
            in: 'query',
            required: false,
            description: 'Filtra por tienda',
            schema: { type: 'integer', minimum: 1 },
          },
        ],
        responses: { 200: json(lista('ProductoCatalogo'), 'Productos ordenados por nombre'), ...protegida },
      },
      post: {
        tags: ['Productos'],
        summary: 'Crear un producto en la tienda del vendedor',
        description: 'Rol: vendedor.',
        requestBody: cuerpo(ref('ProductoEntrada')),
        responses: {
          201: json(ref('Producto'), 'Producto creado'),
          ...protegida,
          409: err('Ya existe un producto con ese SKU'),
        },
      },
    },
    '/api/productos/mios': {
      get: {
        tags: ['Productos'],
        summary: 'Productos de la tienda del vendedor',
        description: 'Rol: vendedor.',
        responses: { 200: json(lista('Producto'), 'Productos de su tienda'), ...protegida },
      },
    },
    '/api/productos/{id}': {
      put: {
        tags: ['Productos'],
        summary: 'Editar un producto propio',
        description: 'Rol: vendedor. Solo productos de su tienda.',
        parameters: [idPath('id', 'Id del producto')],
        requestBody: cuerpo(ref('ProductoEntrada')),
        responses: {
          200: json(ref('Producto'), 'Producto actualizado'),
          ...protegida,
          404: err('El producto no existe'),
          409: err('Ya existe un producto con ese SKU'),
        },
      },
      delete: {
        tags: ['Productos'],
        summary: 'Eliminar un producto propio',
        description: 'Rol: vendedor. No se puede eliminar un producto con pedidos.',
        parameters: [idPath('id', 'Id del producto')],
        responses: {
          200: json(ref('Error'), 'Producto eliminado ({"mensaje": "Producto eliminado."})'),
          ...protegida,
          404: err('El producto no existe'),
          409: err('El producto tiene pedidos asociados'),
        },
      },
    },
    '/api/pedidos': {
      post: {
        tags: ['Pedidos'],
        summary: 'Comprar un producto',
        description:
          'Rol: cliente. En una transacción bloquea la fila del producto, comprueba y descuenta el ' +
          'stock y crea el pedido en estado `pendiente`.',
        requestBody: cuerpo({
          type: 'object',
          required: ['producto_id', 'cantidad'],
          properties: {
            producto_id: { type: 'integer', minimum: 1, example: 1 },
            cantidad: { type: 'integer', minimum: 1, example: 2 },
          },
        }),
        responses: {
          201: json(ref('PedidoRespuesta'), 'Pedido creado'),
          ...protegida,
          404: err('El producto no existe'),
          409: err('Stock insuficiente'),
        },
      },
    },
    '/api/pedidos/mios': {
      get: {
        tags: ['Pedidos'],
        summary: 'Pedidos del cliente',
        description: 'Rol: cliente.',
        responses: { 200: json(lista('PedidoCliente'), 'Sus pedidos, del más reciente al más antiguo'), ...protegida },
      },
    },
    '/api/pedidos/por-tienda': {
      get: {
        tags: ['Pedidos'],
        summary: 'Pedidos de la tienda del vendedor (paginado)',
        description: 'Rol: vendedor.',
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'estado', in: 'query', required: false, description: 'Solo pedidos en este estado', schema: ref('EstadoPedido') },
          { name: 'q', in: 'query', required: false, description: 'Texto en el nombre del cliente o del producto', schema: { type: 'string', maxLength: 100 } },
        ],
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                datos: lista('PedidoTienda'),
                total: { type: 'integer' },
                pagina: { type: 'integer' },
                totalPaginas: { type: 'integer' },
              },
            },
            'Una página de pedidos'
          ),
          ...protegida,
        },
      },
    },
    '/api/pedidos/estado': {
      patch: {
        tags: ['Pedidos'],
        summary: 'Cambiar el estado de un pedido de la tienda',
        description: 'Rol: vendedor. Solo pedidos de productos de su tienda.',
        requestBody: cuerpo({
          type: 'object',
          required: ['pedido_id', 'estado'],
          properties: {
            pedido_id: { type: 'integer', minimum: 1, example: 1 },
            estado: ref('EstadoPedido'),
          },
        }),
        responses: {
          200: json(ref('PedidoRespuesta'), 'Estado actualizado'),
          ...protegida,
          404: err('El pedido no existe'),
        },
      },
    },
    '/api/resenas': {
      post: {
        tags: ['Reseñas'],
        summary: 'Calificar un pedido entregado',
        description: 'Rol: cliente. Una reseña por pedido, solo si está `entregado`.',
        requestBody: cuerpo({
          type: 'object',
          required: ['pedido_id', 'calificacion'],
          properties: {
            pedido_id: { type: 'integer', minimum: 1, example: 1 },
            calificacion: { type: 'number', minimum: 1, maximum: 5, example: 4.5 },
            comentario: { type: 'string', maxLength: 300, nullable: true, example: 'Llegó a tiempo' },
          },
        }),
        responses: {
          201: json(ref('Resena'), 'Reseña creada'),
          ...protegida,
          404: err('El pedido no existe o no es suyo'),
          409: err('El pedido no está entregado o ya tiene reseña'),
        },
      },
    },
    '/api/resenas/producto/{producto_id}': {
      get: {
        tags: ['Reseñas'],
        summary: 'Reseñas de un producto',
        description: 'Cualquier usuario autenticado.',
        parameters: [idPath('producto_id', 'Id del producto')],
        responses: { 200: json(lista('ResenaListado'), 'Reseñas, de la más reciente'), ...protegida },
      },
    },
    '/api/resenas/mis-productos': {
      get: {
        tags: ['Reseñas'],
        summary: 'Reseñas de los productos de la tienda',
        description: 'Rol: vendedor.',
        responses: { 200: json(lista('ResenaListado'), 'Reseñas de su tienda'), ...protegida },
      },
    },
    '/api/admin/resumen': {
      get: {
        tags: ['Administración'],
        summary: 'Conteos globales del sistema',
        description: 'Rol: administrador.',
        responses: { 200: json(ref('Resumen'), 'Conteos'), ...protegida },
      },
    },
    '/api/admin/tiendas': {
      get: {
        tags: ['Administración'],
        summary: 'Listar tiendas',
        description: 'Rol: administrador.',
        responses: { 200: json(lista('Tienda'), 'Tiendas'), ...protegida },
      },
      post: {
        tags: ['Administración'],
        summary: 'Crear una tienda',
        description: 'Rol: administrador.',
        requestBody: cuerpo({
          type: 'object',
          required: ['nombre'],
          properties: {
            nombre: { type: 'string', maxLength: 100, example: 'Tienda Centro' },
            direccion: { type: 'string', maxLength: 255, nullable: true, example: 'Calle 10 # 5-20' },
          },
        }),
        responses: { 201: json(ref('Tienda'), 'Tienda creada'), ...protegida },
      },
    },
    '/api/admin/usuarios': {
      get: {
        tags: ['Administración'],
        summary: 'Listar usuarios',
        description: 'Rol: administrador.',
        responses: { 200: json(lista('Usuario'), 'Usuarios'), ...protegida },
      },
      post: {
        tags: ['Administración'],
        summary: 'Crear un usuario de cualquier rol',
        description: 'Rol: administrador. `tienda_id` es obligatoria para vendedor y administrador.',
        requestBody: cuerpo({
          type: 'object',
          required: ['nombre', 'email', 'password', 'rol'],
          properties: {
            nombre: { type: 'string', maxLength: 100, example: 'Vendedora Tres' },
            email: { type: 'string', format: 'email', maxLength: 150, example: 'vendedor3@tutienda.com' },
            password: { type: 'string', format: 'password', minLength: 8, example: 'ClaveSegura123' },
            rol: ref('Rol'),
            tienda_id: { type: 'integer', minimum: 1, nullable: true, example: 1 },
          },
        }),
        responses: {
          201: json(ref('Usuario'), 'Usuario creado'),
          ...protegida,
          409: err('Ya existe un usuario con ese email'),
        },
      },
    },
    '/api/admin/usuarios/{id}/activo': {
      patch: {
        tags: ['Administración'],
        summary: 'Activar o desactivar un usuario',
        description: 'Rol: administrador. Un usuario desactivado pierde el acceso de inmediato.',
        parameters: [idPath('id', 'Id del usuario')],
        requestBody: cuerpo({
          type: 'object',
          required: ['activo'],
          properties: { activo: { type: 'boolean', example: false } },
        }),
        responses: {
          200: json(ref('Usuario'), 'Usuario actualizado'),
          ...protegida,
          404: err('Usuario no encontrado'),
          409: err('No puede desactivar su propio usuario'),
        },
      },
    },
    '/api/chat': {
      post: {
        tags: ['Asistente virtual'],
        summary: 'Enviar un mensaje al asistente',
        description:
          'Cualquier usuario autenticado. Motor de reglas: responde según el rol y solo con datos ' +
          'del propio usuario o de su tienda. Límite: `CHAT_RATE_LIMIT` mensajes por IP por minuto.',
        requestBody: cuerpo({
          type: 'object',
          required: ['mensaje'],
          properties: { mensaje: { type: 'string', maxLength: 300, example: 'stock bajo' } },
        }),
        responses: {
          200: json(ref('RespuestaChat'), 'Respuesta del asistente'),
          ...protegida,
          429: err('Demasiados mensajes'),
        },
      },
    },
  },
};
