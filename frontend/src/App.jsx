// src/App.jsx
// Ruteo con guardas por rol.
//   /login, /registro        -> públicas
//   /pedidos, /productos,
//   /resenas                 -> vendedor
//   /admin                   -> administrador
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Registro from './pages/Registro.jsx';
import PanelPedidos from './components/PanelPedidos.jsx';
import Productos from './pages/Productos.jsx';
import Resenas from './pages/Resenas.jsx';
import Admin from './pages/Admin.jsx';
import { getToken, getUsuario } from './api';

function RutaProtegida({ roles, children }) {
  const token = getToken();
  const usuario = getUsuario();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario?.rol)) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function InicioSegunRol() {
  const usuario = getUsuario();
  if (!getToken()) return <Navigate to="/login" replace />;
  if (usuario?.rol === 'administrador') return <Navigate to="/admin" replace />;
  if (usuario?.rol === 'vendedor') return <Navigate to="/pedidos" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      <Route
        path="/pedidos"
        element={
          <RutaProtegida roles={['vendedor']}>
            <PanelPedidos />
          </RutaProtegida>
        }
      />
      <Route
        path="/productos"
        element={
          <RutaProtegida roles={['vendedor']}>
            <Productos />
          </RutaProtegida>
        }
      />
      <Route
        path="/resenas"
        element={
          <RutaProtegida roles={['vendedor']}>
            <Resenas />
          </RutaProtegida>
        }
      />
      <Route
        path="/admin"
        element={
          <RutaProtegida roles={['administrador']}>
            <Admin />
          </RutaProtegida>
        }
      />

      <Route path="*" element={<InicioSegunRol />} />
    </Routes>
  );
}
