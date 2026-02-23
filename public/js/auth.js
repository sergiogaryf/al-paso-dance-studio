/* ============================================
   AL PASO DANCE STUDIO - Autenticacion
   Login por PIN, email+password y guards
   ============================================ */

// ---- ELEMENTOS DEL DOM ----
const loginForm    = document.getElementById('loginForm');
const emailInput   = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn     = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');

// ---- HELPERS GENERICOS ----
function showError(msg) {
  if (!errorMessage) return;
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
}
function hideError() {
  if (!errorMessage) return;
  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}
function setLoading(on) {
  if (!loginBtn) return;
  loginBtn.classList.toggle('loading', on);
  loginBtn.disabled = on;
}
function irAVista(id) {
  document.querySelectorAll('.login-vista').forEach(v => v.classList.remove('active'));
  const v = document.getElementById(id);
  if (v) v.classList.add('active');
}
function redirigirSegunRol(role) {
  if (role === 'admin' || role === 'profesor') window.location.href = 'admin.html';
  else window.location.href = 'app.html';
}

async function checkProfesorAuth() {
  const user = await checkAuth();
  if (!['admin', 'profesor'].includes(user.role || user.rol)) {
    window.location.href = 'app.html';
    throw new Error('No es profesor');
  }
  return user;
}

// ---- GUARDS ----
async function checkAuth() {
  if (!ApiService.isLoggedIn()) {
    window.location.href = 'login.html';
    throw new Error('No autenticado');
  }
  try {
    return await ApiService.getCurrentUser();
  } catch (e) {
    window.location.href = 'login.html';
    throw e;
  }
}

async function checkAdminAuth() {
  const user = await checkAuth();
  if ((user.role || user.rol) !== 'admin') {
    window.location.href = 'app.html';
    throw new Error('No es admin');
  }
  return user;
}

function logout() { ApiService.logout(); }

// ================================================================
// LOGIN PAGE — solo ejecutar si estamos en login.html
// ================================================================
if (document.getElementById('vistaSelector')) {

  // Si ya esta autenticado, redirigir directo
  if (ApiService.isLoggedIn()) {
    ApiService.getCurrentUser()
      .then(u => redirigirSegunRol(u.role || 'alumno'))
      .catch(() => {});
  }

  // ---- SELECTOR DE ROL ----
  document.getElementById('btnRolAlumno')?.addEventListener('click', () => {
    limpiarPIN();
    irAVista('vistaPIN');
    setTimeout(() => document.querySelector('.pin-box')?.focus(), 300);
  });

  document.getElementById('btnRolProfesor')?.addEventListener('click', () => {
    const t = document.getElementById('loginFormTitle');
    if (t) t.textContent = 'Acceso Profesor';
    irAVista('vistaLoginForm');
  });

  document.getElementById('btnRolInvitado')?.addEventListener('click', () => {
    window.location.href = 'index.html?modo=invitado';
  });

  document.getElementById('btnVolverSelector')?.addEventListener('click', () => {
    hideError();
    loginForm?.reset();
    irAVista('vistaSelector');
  });

  // ================================================================
  // FLUJO PIN
  // ================================================================
  const pinBoxes = document.querySelectorAll('.pin-box');
  const pinError = document.getElementById('pinError');
  const pinLoader = document.getElementById('pinLoader');
  const pinNombres = document.getElementById('pinNombres');
  const pinNombresBtns = document.getElementById('pinNombresBtns');

  function showPinError(msg) {
    pinError.textContent = msg;
    pinError.classList.remove('hidden');
    pinBoxes.forEach(b => b.classList.add('pin-error'));
    setTimeout(() => pinBoxes.forEach(b => b.classList.remove('pin-error')), 600);
  }
  function hidePinError() {
    pinError.classList.add('hidden');
  }
  function setPinLoader(on) {
    pinLoader.classList.toggle('hidden', !on);
    pinBoxes.forEach(b => b.disabled = on);
  }
  function limpiarPIN() {
    pinBoxes.forEach(b => { b.value = ''; b.classList.remove('filled', 'pin-error'); });
    hidePinError();
    pinNombres?.classList.add('hidden');
    setPinLoader(false);
  }
  function getPIN() {
    return Array.from(pinBoxes).map(b => b.value).join('');
  }

  // Navegacion entre cajas PIN
  pinBoxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      const v = box.value.replace(/\D/g, '');
      box.value = v ? v[v.length - 1] : '';
      box.classList.toggle('filled', !!box.value);
      hidePinError();
      if (box.value && i < pinBoxes.length - 1) {
        pinBoxes[i + 1].focus();
      }
      if (getPIN().length === 4) {
        setTimeout(() => submitPIN(getPIN()), 120);
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        pinBoxes[i - 1].focus();
        pinBoxes[i - 1].value = '';
        pinBoxes[i - 1].classList.remove('filled');
      }
    });

    // En mobile: seleccionar todo al hacer focus para reemplazar facil
    box.addEventListener('focus', () => box.select());
  });

  document.getElementById('btnVolverDesdePin')?.addEventListener('click', () => {
    limpiarPIN();
    irAVista('vistaSelector');
  });

  async function submitPIN(pin, nombre = null) {
    hidePinError();
    setPinLoader(true);
    pinNombres?.classList.add('hidden');

    try {
      const result = await ApiService.loginConPIN(pin, nombre);

      // Colision: multiples alumnos con mismo PIN
      if (result.opciones) {
        setPinLoader(false);
        pinNombresBtns.innerHTML = result.opciones.map(op =>
          `<button class="pin-nombre-btn" data-nombre="${op.nombre}">${op.nombre}</button>`
        ).join('');
        pinNombres.classList.remove('hidden');

        pinNombresBtns.querySelectorAll('.pin-nombre-btn').forEach(btn => {
          btn.addEventListener('click', () => submitPIN(pin, btn.dataset.nombre));
        });
        return;
      }

      // Login exitoso
      redirigirSegunRol(result.role || 'alumno');

    } catch (err) {
      setPinLoader(false);
      showPinError(err.message || 'PIN incorrecto');
      // Limpiar cajas para reintentar
      pinBoxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
      pinBoxes[0]?.focus();
    }
  }

  // ================================================================
  // FLUJO EMAIL + PASSWORD (Profesor / Admin)
  // ================================================================
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email) { showError('Ingresa tu correo.'); emailInput.focus(); return; }
      if (!password) { showError('Ingresa tu contrasena.'); passwordInput.focus(); return; }

      hideError();
      setLoading(true);
      try {
        const user = await ApiService.login(email, password);
        redirigirSegunRol(user.role || 'alumno');
      } catch (err) {
        showError(err.message || 'Error inesperado. Intenta de nuevo.');
        setLoading(false);
      }
    });

    [emailInput, passwordInput].forEach(el => el?.addEventListener('input', hideError));
  }
}
