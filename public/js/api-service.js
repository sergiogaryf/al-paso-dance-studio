/**
 * ApiService - Capa de acceso a datos via API serverless
 * Reemplaza a FirestoreService manteniendo la misma interfaz
 */

// ---- MODO DESARROLLO LOCAL (solo localhost) ----
const _LOCAL_DEV = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const _LOCAL_TOKEN = 'local-dev-alpaso-2026';
const _LOCAL_USER  = {
  id: 'local-dev',
  nombre: 'Sergio Gary',
  email: 'sergiogaryf@gmail.com',
  role: 'admin',
  activo: true,
  cursosInscritos: [],
  clasesContratadas: 10,
  clasesAsistidas: 0,
};

const ApiService = {
  _token: null,

  _getToken() {
    if (!this._token) {
      this._token = localStorage.getItem('auth_token');
    }
    return this._token;
  },

  _setToken(token) {
    this._token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  },

  async _fetch(url, options = {}) {
    const token = this._getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      if (this._getToken()) {
        // Sesion expirada: borrar token y redirigir a login
        this._setToken(null);
        window.location.href = 'login.html';
        throw new Error('No autorizado');
      } else {
        // En flujo de login (sin token): propagar el error para que la UI lo muestre
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No autorizado');
      }
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error HTTP ${res.status}`);
    }
    return res.json();
  },

  // =========================================================================
  // AUTH
  // =========================================================================

  async login(email, password) {
    if (_LOCAL_DEV && email === 'sergiogaryf@gmail.com' && password === '1234') {
      this._setToken(_LOCAL_TOKEN);
      return _LOCAL_USER;
    }
    const data = await this._fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this._setToken(data.token);
    return data.user;
  },

  // Acceso por link directo (?token=LINKTOKEN en URL)
  async loginConLink(linkToken) {
    const data = await this._fetch(`/api/login?token=${encodeURIComponent(linkToken)}`);
    this._setToken(data.token);
    return data.user;
  },

  // Acceso por PIN de 4 digitos. Si hay colision retorna { opciones: [...] }
  async loginConPIN(pin, nombre = null) {
    const body = { pin };
    if (nombre) body.nombre = nombre;
    const data = await this._fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (data.opciones) return data;
    this._setToken(data.token);
    return data.user;
  },

  logout() {
    this._setToken(null);
    window.location.href = 'login.html';
  },

  isLoggedIn() {
    return !!this._getToken();
  },

  // =========================================================================
  // USERS
  // =========================================================================

  async getUser(id) {
    if (!id) {
      return this._fetch('/api/me');
    }
    return this._fetch(`/api/alumnos?id=${encodeURIComponent(id)}`);
  },

  async getCurrentUser() {
    if (_LOCAL_DEV && this._getToken() === _LOCAL_TOKEN) {
      return _LOCAL_USER;
    }
    return this._fetch('/api/me');
  },

  async getAllUsers() {
    return this._fetch('/api/alumnos');
  },

  async getAlumnos() {
    return this._fetch('/api/alumnos?role=alumno');
  },

  async createUser(id, data) {
    return this._fetch('/api/alumnos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUser(id, data) {
    // Si solo se actualiza fotoUrl (perfil propio), usar /api/me para evitar requerir admin
    const esSoloFoto = Object.keys(data).length === 1 && data.fotoUrl !== undefined;
    if (esSoloFoto) {
      return this._fetch('/api/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    }
    return this._fetch('/api/alumnos', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  },

  async deleteUser(id) {
    return this._fetch(`/api/alumnos?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async getAlumnosByClase(claseId) {
    return this._fetch(`/api/companeros?claseId=${encodeURIComponent(claseId)}`);
  },

  // =========================================================================
  // CLASES
  // =========================================================================

  async getClases() {
    return this._fetch('/api/clases?all=true');
  },

  async getClasesActivas() {
    return this._fetch('/api/clases');
  },

  async getClase(id) {
    const clases = await this._fetch('/api/clases?all=true');
    const clase = clases.find(c => c.id === id);
    if (!clase) throw new Error(`Clase con ID "${id}" no encontrada.`);
    return clase;
  },

  async createClase(data) {
    return this._fetch('/api/clases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateClase(id, data) {
    return this._fetch('/api/clases', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  },

  async deleteClase(id) {
    return this._fetch(`/api/clases?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // =========================================================================
  // EVENTOS
  // =========================================================================

  async getEventos() {
    return this._fetch('/api/eventos?all=true');
  },

  async getEventosActivos() {
    return this._fetch('/api/eventos');
  },

  async getEvento(id) {
    const eventos = await this._fetch('/api/eventos?all=true');
    const evento = eventos.find(e => e.id === id);
    if (!evento) throw new Error(`Evento con ID "${id}" no encontrado.`);
    return evento;
  },

  async createEvento(data) {
    return this._fetch('/api/eventos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateEvento(id, data) {
    return this._fetch('/api/eventos', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  },

  async deleteEvento(id) {
    return this._fetch(`/api/eventos?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // =========================================================================
  // BANNERS
  // =========================================================================

  async getBanners() {
    return this._fetch('/api/banners?all=true');
  },

  async getBannersActivos() {
    return this._fetch('/api/banners');
  },

  async getBanner(id) {
    const banners = await this._fetch('/api/banners?all=true');
    const banner = banners.find(b => b.id === id);
    if (!banner) throw new Error(`Banner con ID "${id}" no encontrado.`);
    return banner;
  },

  async createBanner(data) {
    return this._fetch('/api/banners', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateBanner(id, data) {
    return this._fetch('/api/banners', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  },

  async deleteBanner(id) {
    return this._fetch(`/api/banners?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

// Alias para compatibilidad con codigo existente que usa FirestoreService
const FirestoreService = ApiService;

/**
 * Transforma una URL de Cloudinary para servir un avatar cuadrado optimizado.
 * Si la URL no es de Cloudinary (p.ej. base64 del fallback), la devuelve intacta.
 *
 * @param {string} url   - URL original de Cloudinary
 * @param {number} size  - Lado del cuadrado en px (default 200)
 */
function avatarUrl(url, size) {
  if (!url) return url;
  size = size || 200;
  if (!url.includes('res.cloudinary.com')) return url;
  // Inserta la transformación justo después de /upload/
  return url.replace(
    '/upload/',
    '/upload/c_fill,w_' + size + ',h_' + size + ',g_face,q_auto,f_auto/'
  );
}

/**
 * Comprime una imagen con Canvas y la sube directamente a Cloudinary
 * (sin widget). Funciona con cualquier tamaño de archivo.
 *
 * @param {File}   file       - Archivo de imagen seleccionado
 * @param {string} cloudName  - Nombre del cloud de Cloudinary
 * @param {string} preset     - Nombre del upload preset (unsigned)
 * @param {string} folder     - Carpeta destino en Cloudinary
 * @returns {Promise<string>} - URL segura de la imagen subida
 */
async function subirFotoCloudinary(file, cloudName, preset, folder) {
  // 1. Comprimir imagen en el navegador antes de subir
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // 2. Subir a Cloudinary via API REST (sin widget)
  const fd = new FormData();
  fd.append('file', dataUrl);
  fd.append('upload_preset', preset);
  if (folder) fd.append('folder', folder);

  const res = await fetch(
    'https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload',
    { method: 'POST', body: fd }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err.error && err.error.message) || 'Error al subir foto');
  }
  const data = await res.json();
  return data.secure_url;
}
