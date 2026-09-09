// src/components/Layout.jsx
// Barra superior con enlaces según el rol del usuario y botón de salir.
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getUsuario, logout } from '../api';

const enlacesPorRol = {
  vendedor: [
    { to: '/pedidos', texto: 'Pedidos' },
    { to: '/productos', texto: 'Productos' },
    { to: '/resenas', texto: 'Reseñas' },
  ],
  administrador: [{ to: '/admin', texto: 'Administración' }],
  cliente: [],
};

export default function Layout({ children }) {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const enlaces = enlacesPorRol[usuario?.rol] || [];

  const salir = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
          <span className="font-bold">Comercio Electrónico</span>
          <nav className="flex gap-4 text-sm flex-1">
            {enlaces.map((e) => (
              <NavLink
                key={e.to}
                to={e.to}
                className={({ isActive }) =>
                  `hover:underline ${isActive ? 'font-semibold underline' : ''}`
                }
              >
                {e.texto}
              </NavLink>
            ))}
          </nav>
          <span className="text-sm opacity-90">
            {usuario?.nombre} ({usuario?.rol})
          </span>
          <button
            onClick={salir}
            className="text-sm bg-blue-800 hover:bg-blue-900 px-3 py-1 rounded"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
