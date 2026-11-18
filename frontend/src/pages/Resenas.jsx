// src/pages/Resenas.jsx
// Reseñas de los productos de la tienda del vendedor -> GET /api/resenas/mis-productos.
// Usabilidad: promedio y total a la vista, estrellas con texto para lector de pantalla,
// estados de carga y error anunciados (U-13) y contraste suficiente (U-12).
import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { apiJson } from '../api';
import { Cargando, Encabezado, MensajeError, Tarjeta, Vacio } from '../components/ui.jsx';

function Estrellas({ valor }) {
  const numero = Number(valor);
  const llenas = Math.round(numero);
  const texto = numero.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`${texto} de 5 estrellas`}>
      <span aria-hidden="true" className="text-amber-500">
        {'★'.repeat(llenas)}
        <span className="text-slate-300">{'★'.repeat(5 - llenas)}</span>
      </span>
      <span aria-hidden="true" className="text-xs font-medium text-slate-700">
        {texto}
      </span>
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

  const promedio = useMemo(
    () => (resenas.length ? resenas.reduce((s, r) => s + Number(r.calificacion), 0) / resenas.length : null),
    [resenas]
  );

  return (
    <Layout>
      <Encabezado
        titulo="Reseñas de mis productos"
        descripcion="Los clientes califican un pedido cuando lo marcas como entregado."
      >
        {promedio !== null && (
          <Tarjeta className="px-4 py-2">
            <span className="text-sm text-slate-600">Promedio </span>
            <Estrellas valor={promedio} />
            <span className="ml-2 text-sm text-slate-600">
              · {resenas.length} {resenas.length === 1 ? 'reseña' : 'reseñas'}
            </span>
          </Tarjeta>
        )}
      </Encabezado>

      <MensajeError>{error}</MensajeError>

      {cargando ? (
        <Tarjeta>
          <Cargando texto="Cargando reseñas…" />
        </Tarjeta>
      ) : resenas.length === 0 ? (
        <Tarjeta>
          <Vacio titulo="Todavía no hay reseñas.">Aparecerán aquí cuando un cliente califique un pedido entregado.</Vacio>
        </Tarjeta>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {resenas.map((r) => (
            <li key={r.id}>
              <Tarjeta className="h-full p-5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-slate-900">{r.producto_nombre}</h2>
                  <Estrellas valor={r.calificacion} />
                </div>
                <p className="text-sm text-slate-800">
                  {r.comentario || <em className="text-slate-600">Sin comentario</em>}
                </p>
                <p className="mt-3 text-xs text-slate-600">
                  {r.cliente_nombre} ·{' '}
                  {new Date(r.fecha_registro).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                </p>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
