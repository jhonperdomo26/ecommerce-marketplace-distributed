// src/components/PanelPedidos.jsx
// Código literal del Manual Técnico, Sección 4 (Frontend Web Integrado).
import React, { useState, useEffect } from 'react';

export default function PanelPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/pedidos/por-tienda', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setPedidos(data);
        setLoading(false);
      })
      .catch((err) => console.error('Error cargando pedidos', err));
  }, []);

  if (loading)
    return (
      <div className="text-center p-10 text-xl">
        Cargando pedidos de la tienda...
      </div>
    );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Gestión de Pedidos de la Tienda
      </h1>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-blue-600 text-white text-left font-semibold uppercase text-sm">
              <th className="px-5 py-3">Cliente</th>
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3">Estado del Pedido</th>
            </tr>
          </thead>
          <tbody>
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
                <td className="px-5 py-4 text-sm">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-200 text-green-800">
                    {pedido.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
