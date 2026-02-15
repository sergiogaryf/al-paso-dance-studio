/* ============================================
   ESTACION SALSERA - Configuración Firebase
   Reemplazar con tus credenciales de Firebase
   ============================================ */

// Firebase SDK via CDN (importado en cada HTML que lo necesite)
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exportar servicios
const auth = firebase.auth();
const db = firebase.firestore();

// Configurar persistencia offline de Firestore
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistencia offline no disponible: múltiples tabs abiertos');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistencia offline no soportada en este navegador');
  }
});
