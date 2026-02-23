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
      this._setToken(null);
      window.location.href = 'login.html';
      throw new Error('No autorizado');
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
