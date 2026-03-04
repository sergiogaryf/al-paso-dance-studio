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
  return url.replace(
    '/upload/',
    '/upload/c_fill,w_' + size + ',h_' + size + ',g_face,q_auto,f_auto/'
  );
}

/**
 * Abre un recortador táctil (Cropper.js) sobre la foto seleccionada.
 * El usuario arrastra la imagen para encuadrar, luego confirma.
 * Retorna una Promise<string> con la imagen recortada en base64 JPEG.
 */
function abrirRecortador(file) {
  return new Promise(function(resolve, reject) {

    // ── Cargar CSS de Cropper.js una sola vez ──────────────────────────────
    if (!document.getElementById('_cropperCss')) {
      var link = document.createElement('link');
      link.id  = '_cropperCss';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css';
      document.head.appendChild(link);
    }

    // ── Modal fullscreen ───────────────────────────────────────────────────
    var overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:9999;background:#000;',
      'display:flex;flex-direction:column;'
    ].join('');

    var hint = document.createElement('p');
    hint.textContent = 'Arrastra para encuadrar · Pellizca para hacer zoom';
    hint.style.cssText = [
      'margin:0;padding:0.6rem 1rem;text-align:center;',
      'font-size:0.78rem;color:#aaa;background:#0a0010;flex-shrink:0;'
    ].join('');

    var cropWrap = document.createElement('div');
    cropWrap.style.cssText = 'flex:1;overflow:hidden;position:relative;';

    var img = document.createElement('img');
    img.style.cssText = 'display:block;max-width:100%;';
    cropWrap.appendChild(img);

    var actions = document.createElement('div');
    actions.style.cssText = [
      'display:flex;gap:0.8rem;padding:1rem 1rem calc(1rem + env(safe-area-inset-bottom));',
      'background:#140A18;flex-shrink:0;'
    ].join('');

    var btnCancelar = document.createElement('button');
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.style.cssText = [
      'flex:1;padding:0.85rem;background:transparent;',
      'border:1px solid #430440;color:#fff;border-radius:10px;font-size:1rem;'
    ].join('');

    var btnUsar = document.createElement('button');
    btnUsar.textContent = 'Usar esta foto';
    btnUsar.style.cssText = [
      'flex:2;padding:0.85rem;background:#430440;border:none;',
      'color:#D4AF37;border-radius:10px;font-size:1rem;font-weight:700;'
    ].join('');

    actions.appendChild(btnCancelar);
    actions.appendChild(btnUsar);
    overlay.appendChild(hint);
    overlay.appendChild(cropWrap);
    overlay.appendChild(actions);
    document.body.appendChild(overlay);

    // ── Leer archivo y arrancar Cropper ────────────────────────────────────
    var reader = new FileReader();
    reader.onload = function(e) {
      img.src = e.target.result;

      function iniciarCropper() {
        var cropper = new Cropper(img, {
          aspectRatio:        1,
          viewMode:           0,
          dragMode:           'move',
          autoCropArea:       0.85,
          guides:             false,
          center:             true,
          highlight:          true,
          cropBoxMovable:     false,
          cropBoxResizable:   false,
          toggleDragModeOnDblclick: false,
        });

        btnCancelar.addEventListener('click', function() {
          cropper.destroy();
          document.body.removeChild(overlay);
          reject(new Error('cancelado'));
        });

        btnUsar.addEventListener('click', function() {
          btnUsar.textContent = '⏳';
          btnUsar.disabled = true;
          var canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
          var base64 = canvas.toDataURL('image/jpeg', 0.85);
          cropper.destroy();
          document.body.removeChild(overlay);
          resolve(base64);
        });
      }

      if (window.Cropper) {
        iniciarCropper();
      } else {
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js';
        script.onload = iniciarCropper;
        script.onerror = function() {
          // Fallback: si CDN falla, comprimir y usar sin recortar
          document.body.removeChild(overlay);
          var canvas = document.createElement('canvas');
          canvas.width = canvas.height = 400;
          var ctx = canvas.getContext('2d');
          var tmp = new Image();
          tmp.onload = function() {
            var min = Math.min(tmp.width, tmp.height);
            ctx.drawImage(tmp, (tmp.width-min)/2, (tmp.height-min)/2, min, min, 0, 0, 400, 400);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          tmp.onerror = function() { reject(new Error('Error al procesar imagen')); };
          tmp.src = img.src;
        };
        document.head.appendChild(script);
      }
    };
    reader.onerror = function() {
      document.body.removeChild(overlay);
      reject(new Error('Error al leer la imagen'));
    };
    reader.readAsDataURL(file);
  });
}

