// src/App.jsx
// Ruteo mínimo: /login para autenticarse y /pedidos para el panel del vendedor.
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import PanelPedidos from './components/PanelPedidos.jsx';
import { getToken } from './api';

function RutaProtegida({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/pedidos"
        element={
          <RutaProtegida>
            <PanelPedidos />
          </RutaProtegida>
        }
      />
      <Route path="*" element={<Navigate to="/pedidos" replace />} />
    </Routes>
  );
}
