// src/components/Layout.jsx
// Barra superior con enlaces según el rol del usuario y botón de salir.
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getUsuario, logout } from '../api';
import ChatWidget from './ChatWidget.jsx';

const enlacesPorRol = {
  vendedor: [
    { to: '/pedidos', texto: 'Pedidos' },
    { to: '/productos', texto: 'Productos' },
    { to: '/resenas', texto: 'Reseñas' },
  ],
  administrador: [{ to: '/admin', texto: 'Administración' }],
  cliente: [],
};

const NOMBRE_ROL = { vendedor: 'Vendedor', administrador: 'Administrador', cliente: 'Cliente' };

export default function Layout({ children }) {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const enlaces = enlacesPorRol[usuario?.rol] || [];
  const inicial = (usuario?.nombre || '?').trim().charAt(0).toUpperCase();

  const salir = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <span className="flex items-center gap-2 font-bold text-slate-900">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm text-white"
            >
              CE
            </span>
            Comercio Electrónico
          </span>
          <nav aria-label="Principal" className="flex flex-1 gap-1 text-sm">
            {enlaces.map((e) => (
              <NavLink
                key={e.to}
                to={e.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {e.texto}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700"
            >
              {inicial}
            </span>
            <span className="text-sm leading-tight">
              <span className="block font-medium text-slate-900">{usuario?.nombre}</span>
              <span className="block text-xs text-slate-600">{NOMBRE_ROL[usuario?.rol] || usuario?.rol}</span>
            </span>
            <button
              onClick={salir}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
      {/* Asistente virtual (Fase 3): disponible para vendedor y administrador. */}
      {usuario && <ChatWidget />}
    </div>
  );
}
