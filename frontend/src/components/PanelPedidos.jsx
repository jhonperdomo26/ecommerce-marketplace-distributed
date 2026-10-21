// src/components/PanelPedidos.jsx
// Basado en el código del Manual Técnico, Sección 4 (Frontend Web Integrado).
// Añadidos: layout con navegación, uso de apiJson, y control para que el vendedor
// cambie el estado del pedido (PATCH /api/pedidos/estado, que ya existía en la API).
import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { apiJson } from '../api';

const ESTADOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];

const colorEstado = {
  pendiente: 'bg-yellow-200 text-yellow-800',
  pagado: 'bg-blue-200 text-blue-800',
  enviado: 'bg-purple-200 text-purple-800',
  entregado: 'bg-green-200 text-green-800',
  cancelado: 'bg-red-200 text-red-800',
};

export default function PanelPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(null); // id del pedido en curso

  const cargar = (pag = pagina) => {
    setLoading(true);
    apiJson(`/api/pedidos/por-tienda?page=${pag}&limit=20`)
      .then((data) => {
        setPedidos(data.datos);
        setTotalPaginas(data.totalPaginas);
        setTotal(data.total);
        setPagina(data.pagina);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiarEstado = async (pedido_id, estado) => {
    setError('');
    setGuardando(pedido_id);
    try {
      await apiJson('/api/pedidos/estado', {
        method: 'PATCH',
        body: JSON.stringify({ pedido_id, estado }),
      });
      setPedidos((prev) =>
        prev.map((p) => (p.id === pedido_id ? { ...p, estado } : p))
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(null);
    }
  };

  if (loading)
    return (
      <Layout>
        <div className="text-center p-10 text-xl">
          Cargando pedidos de la tienda...
        </div>
      </Layout>
    );

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Gestión de Pedidos de la Tienda
      </h1>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-blue-600 text-white text-left font-semibold uppercase text-sm">
              <th className="px-5 py-3">Cliente</th>
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3">Cantidad</th>
              <th className="px-5 py-3">Estado del Pedido</th>
              <th className="px-5 py-3">Cambiar estado</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.length === 0 && (
              <tr>
                <td colSpan="5" className="px-5 py-6 text-center text-gray-500">
                  No hay pedidos en tu tienda.
                </td>
              </tr>
            )}
            {pedidos.map((pedido) => (
              <tr
                key={pedido.id}
                className="border-b border-gray-200 hover:bg-gray-50"
              >
                <td className="px-5 py-4 text-sm text-gray-900">
                  {pedido.cliente_nombre}
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">
                  {pedido.producto_nombre}
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">
                  {pedido.cantidad}
                </td>
                <td className="px-5 py-4 text-sm">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      colorEstado[pedido.estado] || 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {pedido.estado}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm">
                  <select
                    value={pedido.estado}
                    disabled={guardando === pedido.id}
                    onChange={(e) => cambiarEstado(pedido.id, e.target.value)}
                    className="border rounded px-2 py-1"
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

      {total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Página {pagina} de {totalPaginas} · {total} pedidos en total
          </span>
          <div className="space-x-2">
            <button
              onClick={() => cargar(pagina - 1)}
              disabled={pagina <= 1 || loading}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => cargar(pagina + 1)}
              disabled={pagina >= totalPaginas || loading}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
