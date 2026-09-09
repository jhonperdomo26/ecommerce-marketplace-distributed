// src/pages/Resenas.jsx
// Reseñas de los productos de la tienda del vendedor -> GET /api/resenas/mis-productos.
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { apiJson } from '../api';

function Estrellas({ valor }) {
  const llenas = Math.round(Number(valor));
  return (
    <span className="text-yellow-500">
      {'★'.repeat(llenas)}
      <span className="text-gray-300">{'★'.repeat(5 - llenas)}</span>{' '}
      <span className="text-gray-600 text-xs">({valor})</span>
    </span>
  );
}

export default function Resenas() {
  const [resenas, setResenas] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    apiJson('/api/resenas/mis-productos')
      .then(setResenas)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Reseñas de mis productos
      </h1>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {cargando ? (
        <p className="text-gray-500">Cargando...</p>
      ) : resenas.length === 0 ? (
        <p className="text-gray-500">Todavía no hay reseñas.</p>
      ) : (
        <div className="space-y-3">
          {resenas.map((r) => (
            <div key={r.id} className="bg-white shadow rounded-lg p-4">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-gray-800">
                  {r.producto_nombre}
                </span>
                <Estrellas valor={r.calificacion} />
              </div>
              <p className="text-sm text-gray-700">
                {r.comentario || <em className="text-gray-400">Sin comentario</em>}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {r.cliente_nombre} ·{' '}
                {new Date(r.fecha_registro).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
