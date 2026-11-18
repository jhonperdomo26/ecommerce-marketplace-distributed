// src/servicios/notificaciones.ts
// Integración con un servicio externo (Fase 2): avisos por correo electrónico al cliente
// cuando crea un pedido y cuando la tienda cambia su estado.
//
// - Protocolo SMTP con Nodemailer. En el despliegue de pruebas el servidor es Mailpit
//   (docker-compose.prod.yml), que guarda los correos y los muestra en http://localhost:8025;
//   en producción basta con apuntar SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS a un proveedor real.
// - Desacoplado de la operación de negocio: el aviso se envía DESPUÉS de confirmar la
//   transacción y sin que la respuesta lo espere. Si el servidor de correo está caído, el
//   pedido igual queda creado y el error solo se registra en el log.
// - Sin SMTP_HOST el servicio queda apagado (no hace nada), como en las pruebas unitarias.
import nodemailer, { Transporter } from 'nodemailer';
import { repo } from '../db';
import { Pedido } from '../entidades';
import { columnas } from '../utils/consultas';

const DESCRIPCION_ESTADO: Record<string, string> = {
  pendiente: 'está pendiente de pago',
  pagado: 'fue pagado',
  enviado: 'va en camino',
  entregado: 'fue entregado',
  cancelado: 'fue cancelado',
};

let transporte: Transporter | null | undefined;

function obtenerTransporte(): Transporter | null {
  if (transporte !== undefined) return transporte;
  const host = process.env.SMTP_HOST;
  transporte = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 1025,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    : null;
  return transporte;
}

// Solo para pruebas: inyectar un transporte (p. ej. jsonTransport) o volver a leer el entorno.
export function configurarTransporte(t: Transporter | null | undefined): void {
  transporte = t;
}

// Envíos en curso, para que las pruebas puedan esperarlos.
const pendientes = new Set<Promise<void>>();
export async function esperarNotificaciones(): Promise<void> {
  await Promise.all([...pendientes]);
}

interface DatosAviso {
  id: number;
  cantidad: number;
  estado: string;
  cliente_nombre: string;
  cliente_email: string;
  producto_nombre: string;
  tienda_nombre: string;
}

async function datosDelPedido(pedidoId: number): Promise<DatosAviso | undefined> {
  const qb = (await repo(Pedido))
    .createQueryBuilder('ped')
    .innerJoin('ped.cliente', 'cli')
    .innerJoin('ped.producto', 'prod')
    .innerJoin('prod.tienda', 't');
  return columnas(qb, {
    id: 'ped.id',
    cantidad: 'ped.cantidad',
    estado: 'ped.estado',
    cliente_nombre: 'cli.nombre',
    cliente_email: 'cli.email',
    producto_nombre: 'prod.nombre',
    tienda_nombre: 't.nombre',
  })
    .where('ped.id = :pedidoId', { pedidoId })
    .getRawOne<DatosAviso>();
}

function programar(tarea: () => Promise<void>): void {
  if (!obtenerTransporte()) return; // servicio apagado
  const p = tarea()
    .catch((error) => {
      console.error('No se pudo enviar la notificación por correo:', error?.message ?? error);
    })
    .finally(() => pendientes.delete(p));
  pendientes.add(p);
}

async function enviar(para: string, asunto: string, texto: string): Promise<void> {
  const t = obtenerTransporte();
  if (!t) return;
  await t.sendMail({
    from: process.env.SMTP_FROM || 'Comercio Electrónico <no-responder@comercio.local>',
    to: para,
    subject: asunto,
    text: texto,
  });
}

export function notificarPedidoCreado(pedidoId: number): void {
  programar(async () => {
    const d = await datosDelPedido(pedidoId);
    if (!d) return;
    await enviar(
      d.cliente_email,
      `Recibimos tu pedido #${d.id}`,
      `Hola, ${d.cliente_nombre}:\n\n` +
        `Recibimos tu pedido #${d.id}: ${d.cantidad} × ${d.producto_nombre} de ${d.tienda_nombre}.\n` +
        `Estado actual: ${d.estado}. Te avisaremos cuando la tienda lo actualice.\n\n` +
        `Gracias por tu compra.`
    );
  });
}

export function notificarCambioEstado(pedidoId: number): void {
  programar(async () => {
    const d = await datosDelPedido(pedidoId);
    if (!d) return;
    const descripcion = DESCRIPCION_ESTADO[d.estado] ?? `cambió a «${d.estado}»`;
    const extra = d.estado === 'entregado' ? '\nYa puedes calificar tu compra desde la app.\n' : '';
    await enviar(
      d.cliente_email,
      `Tu pedido #${d.id} ${descripcion}`,
      `Hola, ${d.cliente_nombre}:\n\n` +
        `Tu pedido #${d.id} (${d.cantidad} × ${d.producto_nombre} de ${d.tienda_nombre}) ${descripcion}.\n` +
        extra +
        `\nGracias por comprar con nosotros.`
    );
  });
}
