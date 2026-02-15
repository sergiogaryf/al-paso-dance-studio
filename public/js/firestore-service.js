/**
 * FirestoreService - Capa de acceso a datos para Estación Salsera Dance Studio
 * Utiliza la instancia global `db` de firebase-config.js
 */

const FirestoreService = {

  // =========================================================================
  // USERS
  // =========================================================================

  /**
   * Obtiene un usuario por su UID.
   */
  async getUser(uid) {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (!doc.exists) {
        throw new Error(`Usuario con UID "${uid}" no encontrado.`);
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error(`Error al obtener usuario: ${error.message}`);
    }
  },

  /**
   * Obtiene todos los usuarios (solo administradores).
   */
  async getAllUsers() {
    try {
      const snapshot = await db.collection('users').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener todos los usuarios: ${error.message}`);
    }
  },

  /**
   * Obtiene todos los usuarios con rol 'alumno'.
   */
  async getAlumnos() {
    try {
      const snapshot = await db.collection('users')
        .where('role', '==', 'alumno')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener alumnos: ${error.message}`);
    }
  },

  /**
   * Crea un nuevo documento de usuario.
   */
  async createUser(uid, data) {
    try {
      const userData = {
        nombre: data.nombre || '',
        email: data.email || '',
        role: data.role || 'alumno',
        sede: data.sede || '',
        nivel: data.nivel || '',
        telefono: data.telefono || '',
        clasesContratadas: data.clasesContratadas || 0,
        clasesAsistidas: data.clasesAsistidas || 0,
        activo: data.activo !== undefined ? data.activo : true,
        cursosInscritos: data.cursosInscritos || [],
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(uid).set(userData);
      return { id: uid, ...userData };
    } catch (error) {
      throw new Error(`Error al crear usuario: ${error.message}`);
    }
  },

  /**
   * Actualiza parcialmente un documento de usuario.
   */
  async updateUser(uid, data) {
    try {
      const updateData = {
        ...data,
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(uid).update(updateData);
      return { id: uid, ...updateData };
    } catch (error) {
      throw new Error(`Error al actualizar usuario: ${error.message}`);
    }
  },

  /**
   * Elimina un documento de usuario.
   */
  async deleteUser(uid) {
    try {
      await db.collection('users').doc(uid).delete();
      return { id: uid, eliminado: true };
    } catch (error) {
      throw new Error(`Error al eliminar usuario: ${error.message}`);
    }
  },

  /**
   * Obtiene los alumnos inscritos en una clase específica.
   */
  async getAlumnosByClase(claseId) {
    try {
      const snapshot = await db.collection('users')
        .where('cursosInscritos', 'array-contains', claseId)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener alumnos por clase: ${error.message}`);
    }
  },

  // =========================================================================
  // CLASES
  // =========================================================================

  /**
   * Obtiene todas las clases.
   */
  async getClases() {
    try {
      const snapshot = await db.collection('clases').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener clases: ${error.message}`);
    }
  },

  /**
   * Obtiene solo las clases activas.
   */
  async getClasesActivas() {
    try {
      const snapshot = await db.collection('clases')
        .where('activo', '==', true)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener clases activas: ${error.message}`);
    }
  },

  /**
   * Obtiene una clase por su ID.
   */
  async getClase(id) {
    try {
      const doc = await db.collection('clases').doc(id).get();
      if (!doc.exists) {
        throw new Error(`Clase con ID "${id}" no encontrada.`);
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error(`Error al obtener clase: ${error.message}`);
    }
  },

  /**
   * Crea una nueva clase.
   */
  async createClase(data) {
    try {
      const claseData = {
        nombre: data.nombre || '',
        disciplina: data.disciplina || '',
        nivel: data.nivel || '',
        sede: data.sede || '',
        dia: data.dia || '',
        hora: data.hora || '',
        duracion: data.duracion || 60,
        instructor: data.instructor || '',
        cupoMaximo: data.cupoMaximo || 20,
        activo: data.activo !== undefined ? data.activo : true,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      const docRef = await db.collection('clases').add(claseData);
      return { id: docRef.id, ...claseData };
    } catch (error) {
      throw new Error(`Error al crear clase: ${error.message}`);
    }
  },

  /**
   * Actualiza parcialmente una clase.
   */
  async updateClase(id, data) {
    try {
      const updateData = {
        ...data,
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('clases').doc(id).update(updateData);
      return { id, ...updateData };
    } catch (error) {
      throw new Error(`Error al actualizar clase: ${error.message}`);
    }
  },

  /**
   * Elimina una clase.
   */
  async deleteClase(id) {
    try {
      await db.collection('clases').doc(id).delete();
      return { id, eliminado: true };
    } catch (error) {
      throw new Error(`Error al eliminar clase: ${error.message}`);
    }
  },

  // =========================================================================
  // EVENTOS
  // =========================================================================

  /**
   * Obtiene todos los eventos.
   */
  async getEventos() {
    try {
      const snapshot = await db.collection('eventos').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener eventos: ${error.message}`);
    }
  },

  /**
   * Obtiene los eventos activos, ordenados por fecha.
   */
  async getEventosActivos() {
    try {
      const snapshot = await db.collection('eventos')
        .where('activo', '==', true)
        .orderBy('fecha', 'asc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener eventos activos: ${error.message}`);
    }
  },

  /**
   * Obtiene un evento por su ID.
   */
  async getEvento(id) {
    try {
      const doc = await db.collection('eventos').doc(id).get();
      if (!doc.exists) {
        throw new Error(`Evento con ID "${id}" no encontrado.`);
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error(`Error al obtener evento: ${error.message}`);
    }
  },

  /**
   * Crea un nuevo evento.
   */
  async createEvento(data) {
    try {
      const eventoData = {
        titulo: data.titulo || '',
        descripcion: data.descripcion || '',
        fecha: data.fecha || null,
        lugar: data.lugar || '',
        imagenURL: data.imagenURL || '',
        activo: data.activo !== undefined ? data.activo : true,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      const docRef = await db.collection('eventos').add(eventoData);
      return { id: docRef.id, ...eventoData };
    } catch (error) {
      throw new Error(`Error al crear evento: ${error.message}`);
    }
  },

  /**
   * Actualiza parcialmente un evento.
   */
  async updateEvento(id, data) {
    try {
      const updateData = {
        ...data,
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('eventos').doc(id).update(updateData);
      return { id, ...updateData };
    } catch (error) {
      throw new Error(`Error al actualizar evento: ${error.message}`);
    }
  },

  /**
   * Elimina un evento.
   */
  async deleteEvento(id) {
    try {
      await db.collection('eventos').doc(id).delete();
      return { id, eliminado: true };
    } catch (error) {
      throw new Error(`Error al eliminar evento: ${error.message}`);
    }
  },

  // =========================================================================
  // BANNERS
  // =========================================================================

  /**
   * Obtiene todos los banners.
   */
  async getBanners() {
    try {
      const snapshot = await db.collection('banners').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener banners: ${error.message}`);
    }
  },

  /**
   * Obtiene los banners activos, ordenados por orden.
   */
  async getBannersActivos() {
    try {
      const snapshot = await db.collection('banners')
        .where('activo', '==', true)
        .orderBy('orden', 'asc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener banners activos: ${error.message}`);
    }
  },

  /**
   * Obtiene un banner por su ID.
   */
  async getBanner(id) {
    try {
      const doc = await db.collection('banners').doc(id).get();
      if (!doc.exists) {
        throw new Error(`Banner con ID "${id}" no encontrado.`);
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error(`Error al obtener banner: ${error.message}`);
    }
  },

  /**
   * Crea un nuevo banner.
   */
  async createBanner(data) {
    try {
      const bannerData = {
        titulo: data.titulo || '',
        imagenURL: data.imagenURL || '',
        enlace: data.enlace || '',
        orden: data.orden || 0,
        activo: data.activo !== undefined ? data.activo : true,
        fechaInicio: data.fechaInicio || null,
        fechaFin: data.fechaFin || null,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      const docRef = await db.collection('banners').add(bannerData);
      return { id: docRef.id, ...bannerData };
    } catch (error) {
      throw new Error(`Error al crear banner: ${error.message}`);
    }
  },

  /**
   * Actualiza parcialmente un banner.
   */
  async updateBanner(id, data) {
    try {
      const updateData = {
        ...data,
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('banners').doc(id).update(updateData);
      return { id, ...updateData };
    } catch (error) {
      throw new Error(`Error al actualizar banner: ${error.message}`);
    }
  },

  /**
   * Elimina un banner.
   */
  async deleteBanner(id) {
    try {
      await db.collection('banners').doc(id).delete();
      return { id, eliminado: true };
    } catch (error) {
      throw new Error(`Error al eliminar banner: ${error.message}`);
    }
  },

  // =========================================================================
  // ASISTENCIA
  // =========================================================================

  /**
   * Registra la asistencia de un alumno a una clase en una fecha.
   */
  async registrarAsistencia(alumnoId, claseId, fecha, presente) {
    try {
      const asistenciaData = {
        alumnoId: alumnoId,
        claseId: claseId,
        fecha: fecha,
        presente: presente,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      const docRef = await db.collection('asistencia').add(asistenciaData);
      return { id: docRef.id, ...asistenciaData };
    } catch (error) {
      throw new Error(`Error al registrar asistencia: ${error.message}`);
    }
  },

  /**
   * Obtiene todos los registros de asistencia de un alumno.
   */
  async getAsistenciaByAlumno(alumnoId) {
    try {
      const snapshot = await db.collection('asistencia')
        .where('alumnoId', '==', alumnoId)
        .orderBy('fecha', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener asistencia del alumno: ${error.message}`);
    }
  },

  /**
   * Obtiene los registros de asistencia de una clase en una fecha específica.
   */
  async getAsistenciaByClase(claseId, fecha) {
    try {
      const snapshot = await db.collection('asistencia')
        .where('claseId', '==', claseId)
        .where('fecha', '==', fecha)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener asistencia de la clase: ${error.message}`);
    }
  },

  /**
   * Obtiene todos los registros de asistencia del día de hoy.
   */
  async getAsistenciaHoy() {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      const snapshot = await db.collection('asistencia')
        .where('fecha', '>=', hoy)
        .where('fecha', '<', manana)
        .orderBy('fecha', 'asc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Error al obtener asistencia de hoy: ${error.message}`);
    }
  }
};
