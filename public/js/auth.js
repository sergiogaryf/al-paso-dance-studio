/* ============================================
   ESTACION SALSERA - Autenticacion
   Login, logout, guards y manejo de sesion
   ============================================ */

// ---- ELEMENTOS DEL DOM ----
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');

// ---- MENSAJES DE ERROR EN ESPANOL ----
const errorMessages = {
  'auth/invalid-email': 'El correo electronico no es valido.',
  'auth/user-disabled': 'Esta cuenta ha sido deshabilitada. Contacta al administrador.',
  'auth/user-not-found': 'No existe una cuenta con este correo electronico.',
  'auth/wrong-password': 'La contrasena es incorrecta. Intenta de nuevo.',
  'auth/invalid-credential': 'Credenciales incorrectas. Verifica tu correo y contrasena.',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.',
  'auth/network-request-failed': 'Error de conexion. Verifica tu internet e intenta de nuevo.',
  'auth/internal-error': 'Ocurrio un error interno. Intenta de nuevo mas tarde.',
  'auth/missing-password': 'Debes ingresar tu contrasena.',
  'auth/missing-email': 'Debes ingresar tu correo electronico.'
};

/**
 * Traduce un codigo de error de Firebase a un mensaje en espanol
 */
function getErrorMessage(errorCode) {
  return errorMessages[errorCode] || 'Ocurrio un error inesperado. Intenta de nuevo.';
}

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
 * Obtiene el rol del usuario desde Firestore y redirige
 */
async function redirectByRole(user) {
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();

    if (!userDoc.exists) {
      showError('Tu cuenta no tiene un perfil configurado. Contacta al administrador.');
      await auth.signOut();
      setLoading(false);
      return;
    }

    const userData = userDoc.data();
    const role = userData.role || userData.rol;

    if (role === 'admin') {
      window.location.href = 'admin.html';
    } else if (role === 'alumno') {
      window.location.href = 'app.html';
    } else {
      showError('Rol de usuario no reconocido. Contacta al administrador.');
      await auth.signOut();
      setLoading(false);
    }
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    showError('Error al verificar tu perfil. Intenta de nuevo.');
    setLoading(false);
  }
}

/**
 * Inicia sesion con email y contrasena
 */
async function login(email, password) {
  hideError();
  setLoading(true);

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    await redirectByRole(userCredential.user);
  } catch (error) {
    console.error('Error de autenticacion:', error.code, error.message);
    showError(getErrorMessage(error.code));
    setLoading(false);
  }
}

/**
 * Cierra la sesion del usuario
 */
async function logout() {
  try {
    await auth.signOut();
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Error al cerrar sesion:', error);
  }
}

/**
 * Guard de autenticacion.
 * Redirige a login.html si el usuario no esta autenticado.
 * Retorna una Promise con los datos del usuario si esta autenticado.
 */
function checkAuth() {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'login.html';
        reject(new Error('Usuario no autenticado'));
        return;
      }

      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          resolve({
            uid: user.uid,
            email: user.email,
            ...userDoc.data()
          });
        } else {
          await auth.signOut();
          window.location.href = 'login.html';
          reject(new Error('Perfil de usuario no encontrado'));
        }
      } catch (error) {
        console.error('Error en checkAuth:', error);
        reject(error);
      }
    });
  });
}

/**
 * Guard de autenticacion para paginas de admin.
 * Redirige si no es admin.
 */
function checkAdminAuth() {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'login.html';
        reject(new Error('Usuario no autenticado'));
        return;
      }

      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const role = userData.role || userData.rol;
          if (role === 'admin') {
            resolve({ uid: user.uid, email: user.email, ...userData });
          } else {
            window.location.href = 'app.html';
            reject(new Error('Acceso denegado: no es administrador'));
          }
        } else {
          await auth.signOut();
          window.location.href = 'login.html';
          reject(new Error('Perfil de usuario no encontrado'));
        }
      } catch (error) {
        console.error('Error en checkAdminAuth:', error);
        reject(error);
      }
    });
  });
}

// ---- EVENT LISTENERS ----

// Solo ejecutar logica de login si estamos en la pagina de login
if (loginForm) {
  // Verificar si el usuario ya esta autenticado
  auth.onAuthStateChanged((user) => {
    if (user) {
      // Ya esta logueado, redirigir segun su rol
      setLoading(true);
      redirectByRole(user);
    }
  });

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
    input.addEventListener('input', hideError);
  });
}
