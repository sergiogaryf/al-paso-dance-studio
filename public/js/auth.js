/* ============================================
   ESTACION SALSERA - Autenticacion (JWT)
   Login, logout, guards y manejo de sesion
   ============================================ */

// ---- ELEMENTOS DEL DOM ----
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');

// ---- ESTADO ----
let rolSeleccionado = null; // 'alumno' o 'profesor'

/**
 * Muestra un mensaje de error en la interfaz
 */
function showError(message) {
  if (!errorMessage) return;
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

/**
 * Oculta el mensaje de error
 */
function hideError() {
  if (!errorMessage) return;
  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}

/**
 * Activa el estado de carga en el boton de login
 */
function setLoading(isLoading) {
  if (!loginBtn) return;
  if (isLoading) {
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
  } else {
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
  }
}

/**
 * Navega entre vistas del login
 */
function irAVista(vistaId) {
  document.querySelectorAll('.login-vista').forEach(v => v.classList.remove('active'));
  const vista = document.getElementById(vistaId);
  if (vista) vista.classList.add('active');
}

/**
 * Inicia sesion con email y contrasena via API
 */
async function login(email, password) {
  hideError();
  setLoading(true);

  try {
    const user = await ApiService.login(email, password);
    const role = user.role || 'alumno';

    if (role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'app.html';
    }
  } catch (error) {
    console.error('Error de autenticacion:', error);
    showError(error.message || 'Ocurrio un error inesperado. Intenta de nuevo.');
    setLoading(false);
  }
}

/**
 * Cierra la sesion del usuario
 */
function logout() {
  ApiService.logout();
}

/**
 * Guard de autenticacion.
 * Redirige a login.html si el usuario no esta autenticado.
 * Retorna una Promise con los datos del usuario.
 */
async function checkAuth() {
  if (!ApiService.isLoggedIn()) {
    window.location.href = 'login.html';
    throw new Error('Usuario no autenticado');
  }

  try {
    const user = await ApiService.getCurrentUser();
    return user;
  } catch (error) {
    console.error('Error en checkAuth:', error);
    window.location.href = 'login.html';
    throw error;
  }
}

/**
 * Guard de autenticacion para paginas de admin.
 * Redirige si no es admin.
 */
async function checkAdminAuth() {
  const user = await checkAuth();
  const role = user.role || user.rol;
  if (role !== 'admin') {
    window.location.href = 'app.html';
    throw new Error('Acceso denegado: no es administrador');
  }
  return user;
}

// ---- EVENT LISTENERS ----

// Solo ejecutar logica de login si estamos en la pagina de login
if (loginForm) {
  // Verificar si el usuario ya esta autenticado
  if (ApiService.isLoggedIn()) {
    setLoading(true);
    ApiService.getCurrentUser()
      .then(user => {
        const role = user.role || 'alumno';
        if (role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'app.html';
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }

  // ---- SELECTOR DE ROL ----
  const btnAlumno = document.getElementById('btnRolAlumno');
  const btnProfesor = document.getElementById('btnRolProfesor');
  const btnInvitado = document.getElementById('btnRolInvitado');
  const btnVolver = document.getElementById('btnVolverSelector');
  const loginFormTitle = document.getElementById('loginFormTitle');

  if (btnAlumno) {
    btnAlumno.addEventListener('click', () => {
      rolSeleccionado = 'alumno';
      if (loginFormTitle) loginFormTitle.textContent = 'Acceso Alumno';
      irAVista('vistaLoginForm');
    });
  }

  if (btnProfesor) {
    btnProfesor.addEventListener('click', () => {
      rolSeleccionado = 'profesor';
      if (loginFormTitle) loginFormTitle.textContent = 'Acceso Profesor';
      irAVista('vistaLoginForm');
    });
  }

  if (btnInvitado) {
    btnInvitado.addEventListener('click', () => {
      window.location.href = 'index.html?modo=invitado';
    });
  }

  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
      hideError();
      loginForm.reset();
      irAVista('vistaSelector');
    });
  }

  // Manejar envio del formulario
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) {
      showError('Debes ingresar tu correo electronico.');
      emailInput.focus();
      return;
    }

    if (!password) {
      showError('Debes ingresar tu contrasena.');
      passwordInput.focus();
      return;
    }

    login(email, password);
  });

  // Limpiar error al escribir
  [emailInput, passwordInput].forEach(input => {
    if (input) input.addEventListener('input', hideError);
  });
}
