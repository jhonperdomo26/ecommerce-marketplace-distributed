// Helper mínimo para consumir la API central.
// El token se guarda en localStorage bajo la clave 'token'
// (misma convención que usa el componente PanelPedidos del Manual Técnico).
// El objeto 'usuario' (con su rol) se guarda para el ruteo por rol.

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function setUsuario(usuario) {
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

export function getUsuario() {
  try {
    return JSON.parse(localStorage.getItem('usuario'));
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

// Guarda token + usuario a partir de la respuesta de /login o /registro.
export function guardarSesion({ token, usuario }) {
  setToken(token);
  setUsuario(usuario);
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
  // Sesión vencida o usuario desactivado: el backend responde 400/401/403 con estos mensajes.
  // Sin esto la persona se quedaba en pantalla viendo un error rojo sin saber que debía entrar de nuevo.
  if ([400, 401, 403].includes(res.status) && token) {
    const cuerpo = await res.clone().json().catch(() => ({}));
    if (/^(Token inv|Sesión no válida)/.test(cuerpo.mensaje || '')) {
      logout();
      window.location.assign('/login?sesion=vencida');
    }
  }
  return res;
}

// Igual que apiFetch pero devuelve el JSON y lanza Error con el mensaje del
// backend si la respuesta no es 2xx.
export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.mensaje || `Error ${res.status}`);
  }
  return data;
}
