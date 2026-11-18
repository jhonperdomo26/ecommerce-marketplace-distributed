// src/components/PanelPedidos.jsx
// Basado en el código del Manual Técnico, Sección 4 (Frontend Web Integrado).
// Pedidos de la tienda del vendedor: filtros por estado y texto (U-10), confirmación antes de
// marcar un pedido como entregado o cancelado (U-07) y aviso tras cada cambio (U-08).
import React, { useEffect, useState } from 'react';
import Layout from './Layout';
import { apiJson } from '../api';
import {
  Boton,
  Cargando,
  claseControl,
  Encabezado,
  formatoFecha,
  Insignia,
  MensajeError,
  Tarjeta,
  useInterfaz,
  Vacio,
} from './ui.jsx';

const ESTADOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];
// Estados que el cliente ve como definitivos: se pide confirmación.
const ESTADOS_CRITICOS = ['entregado', 'cancelado'];
const POR_PAGINA = 20;

export default function PanelPedidos() {
  const { avisar, confirmar } = useInterfaz();
  const [pedidos, setPedidos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(null); // id del pedido en curso
  const [filtroEstado, setFiltroEstado] = useState('');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState(''); // texto aplicado (con retardo)

  // Espera a que la persona deje de escribir antes de consultar.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);

  const cargar = (pag) => {
    setCargando(true);
    setError('');
    const params = new URLSearchParams({ page: pag, limit: POR_PAGINA });
    if (filtroEstado) params.set('estado', filtroEstado);
    if (busqueda) params.set('q', busqueda);
    apiJson(`/api/pedidos/por-tienda?${params}`)
      .then((data) => {
        setPedidos(data.datos);
        setTotalPaginas(data.totalPaginas);
        setTotal(data.total);
        setPagina(data.pagina);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, busqueda]);

  const cambiarEstado = async (pedido, estado) => {
    if (estado === pedido.estado) return;
    if (ESTADOS_CRITICOS.includes(estado)) {
      const ok = await confirmar({
        titulo: `¿Marcar el pedido #${pedido.id} como ${estado}?`,
        mensaje: `${pedido.cliente_nombre} · ${pedido.cantidad} × ${pedido.producto_nombre}. El cliente recibirá un correo con el nuevo estado.`,
        textoConfirmar: `Sí, marcar como ${estado}`,
        peligro: estado === 'cancelado',
      });
      if (!ok) return;
    }
    setError('');
    setGuardando(pedido.id);
    try {
      await apiJson('/api/pedidos/estado', {
        method: 'PATCH',
        body: JSON.stringify({ pedido_id: pedido.id, estado }),
      });
      setPedidos((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, estado } : p)));
      avisar(`Pedido #${pedido.id} marcado como ${estado}. Se avisó al cliente por correo.`);
    } catch (e) {
      avisar(e.message, 'error');
    } finally {
      setGuardando(null);
    }
  };

  const hayFiltros = filtroEstado || busqueda;

  return (
    <Layout>
      <Encabezado
        titulo="Pedidos de la tienda"
        descripcion="Cambia el estado de cada pedido a medida que lo atiendes. El cliente recibe un aviso por correo."
      />

      <Tarjeta className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="pedidos-buscar" className="mb-1 block text-sm font-medium text-slate-700">
              Buscar
            </label>
            <input
              id="pedidos-buscar"
              type="search"
              placeholder="Nombre del cliente o del producto"
              value={texto}
              maxLength={100}
              onChange={(e) => setTexto(e.target.value)}
              className={claseControl}
            />
          </div>
          <div>
            <label htmlFor="pedidos-estado" className="mb-1 block text-sm font-medium text-slate-700">
              Estado
            </label>
            <select
              id="pedidos-estado"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className={`${claseControl} capitalize`}
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          {hayFiltros && (
            <Boton
              variante="secundario"
              onClick={() => {
                setTexto('');
                setFiltroEstado('');
              }}
            >
              Quitar filtros
            </Boton>
          )}
        </div>
      </Tarjeta>

      <MensajeError>{error}</MensajeError>

      <Tarjeta className="overflow-hidden">
        {cargando && pedidos.length === 0 ? (
          <Cargando texto="Cargando pedidos de la tienda…" />
        ) : pedidos.length === 0 ? (
          <Vacio titulo={hayFiltros ? 'Ningún pedido coincide con los filtros.' : 'Tu tienda aún no tiene pedidos.'}>
            {hayFiltros ? 'Prueba con otro estado o quita los filtros.' : 'Los pedidos aparecen aquí cuando un cliente compra.'}
          </Vacio>
        ) : (
          <div className={`overflow-x-auto ${cargando ? 'opacity-60' : ''}`} aria-busy={cargando}>
            <table className="min-w-full text-sm">
              <caption className="sr-only">Pedidos de la tienda</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Pedido</th>
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Cliente</th>
                  <th scope="col" className="px-4 py-3">Producto</th>
                  <th scope="col" className="px-4 py-3 text-right">Cant.</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3">Cambiar estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidos.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">#{pedido.id}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatoFecha(pedido.fecha_pedido)}</td>
                    <td className="px-4 py-3 text-slate-900">{pedido.cliente_nombre}</td>
                    <td className="px-4 py-3 text-slate-700">{pedido.producto_nombre}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{pedido.cantidad}</td>
                    <td className="px-4 py-3">
                      <Insignia estado={pedido.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={pedido.estado}
                        aria-label={`Cambiar estado del pedido ${pedido.id}`}
                        disabled={guardando === pedido.id}
                        onChange={(e) => cambiarEstado(pedido, e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm capitalize focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span>
            Página {pagina} de {totalPaginas} · {total} {total === 1 ? 'pedido' : 'pedidos'}
            {hayFiltros ? ' con estos filtros' : ' en total'}
          </span>
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => cargar(pagina - 1)} disabled={pagina <= 1 || cargando}>
              Anterior
            </Boton>
            <Boton variante="secundario" onClick={() => cargar(pagina + 1)} disabled={pagina >= totalPaginas || cargando}>
              Siguiente
            </Boton>
          </div>
        </div>
      )}
    </Layout>
  );
}
