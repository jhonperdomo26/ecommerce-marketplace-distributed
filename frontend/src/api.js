// Helper mínimo para consumir la API central.
// El token se guarda en localStorage bajo la clave 'token'
// (misma convención que usa el componente PanelPedidos del Manual Técnico).

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

// fetch con cabecera Authorization: Bearer <token> ya incluida.
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  return res;
}
