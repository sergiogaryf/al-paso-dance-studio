/* ============================================
   AL PASO DANCE STUDIO — App v2
   4 tabs: Inicio · Clases · Comunidad · Yo
   ============================================ */

// ── PLAYLISTS YouTube Music ────────────────────────────────────────────────
const PLAYLISTS = [
  { nombre: 'Bachata',  emoji: '🌹', url: 'https://music.youtube.com/playlist?list=PLe5MK44n1TB9CZfIr9bcA1WqZ0G6uS0QE&si=87GvcOYKs1TzwvWz' },
  { nombre: 'Casino',   emoji: '🎰', url: 'https://music.youtube.com/playlist?list=PLe5MK44n1TB_8_b_mLdOI4PxrIkqqtZOo&si=0pfXxTawhupTJAAp' },
  { nombre: 'Mambo',    emoji: '🎺', url: 'https://music.youtube.com/playlist?list=PLe5MK44n1TB9gMVTwUctrdCAwIfYQGra-&si=ber3iHdPFOAX54Om' },
];

const CURSOS_ACADEMIA = [
  'Casino Básico', 'Casino Intermedio', 'Mambo Open',
  'Bachata Básico', 'Bachata Intermedio',
];

function normCurso(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function canonicalizarCurso(nombre) {
  const norm = normCurso(nombre);
  return CURSOS_ACADEMIA.find(c => normCurso(c) === norm) || nombre;
}

// ── ESTADO GLOBAL ──────────────────────────────────────────────────────────
let currentUser  = null;
let userClases   = [];
let swiperEventos = null;
let ytPlayer     = null;
let ytPlayerReady = false;
let _videosCache = {};
let _loaded      = {};   // flags de carga por tab

// ── YOUTUBE IFrame API ─────────────────────────────────────────────────────
function onYouTubeIframeAPIReady() {
  ytPlayerReady = true;
}

// ── AUTH INIT ──────────────────────────────────────────────────────────────
(async function () {
  try {
    const urlParams  = new URLSearchParams(window.location.search);
    const linkToken  = urlParams.get('token');

    if (linkToken) {
      try {
        const userData = await ApiService.loginConLink(linkToken);
        window.history.replaceState({}, document.title, window.location.pathname);
        if (userData.role === 'admin')    { window.location.href = 'admin.html';    return; }
        if (userData.role === 'profesor') { window.location.href = 'profesor.html'; return; }
        currentUser = { uid: userData.id, ...userData };
        showApp();
        return;
      } catch (e) {
        window.location.href = 'login.html';
        return;
      }
    }

    if (!ApiService.isLoggedIn()) { window.location.href = 'login.html'; return; }

    const userData = await ApiService.getCurrentUser();
    if (!userData) { window.location.href = 'login.html'; return; }
    if (userData.role === 'admin')    { window.location.href = 'admin.html';    return; }
    if (userData.role === 'profesor') { window.location.href = 'profesor.html'; return; }
    currentUser = { uid: userData.id, ...userData };

    try {
      const pagoResp = await ApiService._fetch('/api/alumnos?action=mi-pago');
      if (pagoResp && pagoResp.estado === 'Bloqueado') {
        document.getElementById('appLoading').style.display = 'none';
        const blocked = document.getElementById('appBlocked');
        blocked.classList.remove('hidden');
        const wa = document.getElementById('btnPagarWA');
        if (wa) wa.href = 'https://wa.me/56973327307?text=Hola,%20quiero%20regularizar%20mi%20pago';
        return;
      }
    } catch (_) {}

    showApp();
  } catch (e) {
    console.error('Error cargando usuario:', e);
    window.location.href = 'login.html';
  }
})();

function showApp() {
  document.getElementById('appLoading').style.display = 'none';
  document.getElementById('appContent').classList.remove('hidden');
  document.getElementById('tabBar').classList.remove('hidden');
  initApp();
}

// ── INIT ───────────────────────────────────────────────────────────────────
function initApp() {
  setupTabs();
  setupLogout();
  setupFotoUpload();
  setupEvaluacion();
  setupAccesosBotones();
  setupVideoModal();
  setupEvalModal();
  loadInicio();
  registerSW();
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ── TAB NAVIGATION con GSAP ────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      const current = document.querySelector('.tab-section.active');
      if (current && current.id === tabId) return;

      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      if (current && window.gsap) {
        gsap.to(current, { opacity: 0, y: -6, duration: 0.15, onComplete: () => {
          current.classList.remove('active');
          const next = document.getElementById(tabId);
          next.classList.add('active');
          gsap.fromTo(next, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' });
          loadTab(tabId);
        }});
      } else {
        document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        loadTab(tabId);
      }

      // scroll top
      document.querySelector('.app-content').scrollTop = 0;
    });
  });
}

function loadTab(tabId) {
  switch (tabId) {
    case 'tab-inicio':    loadInicio();    break;
    case 'tab-clases':    loadClases();    break;
    case 'tab-comunidad': loadComunidad(); break;
    case 'tab-yo':        loadYo();        break;
  }
}

// ── LOGOUT ─────────────────────────────────────────────────────────────────
function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => ApiService.logout());
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 1 — INICIO
// ══════════════════════════════════════════════════════════════════════════
async function loadInicio() {
  if (!currentUser) return;

  const nombre = (currentUser.nombre || 'Alumno').split(' ')[0];
  document.getElementById('userName').textContent = nombre;

  const racha     = currentUser.racha || 0;
  const asistidas = currentUser.clasesAsistidas || 0;
  const contrat   = currentUser.clasesContratadas || 0;
  const meses     = calcMeses(currentUser.fechaIngreso);

  // Racha animada con GSAP
  const rachaEl = document.getElementById('inicioRachaNum');
  if (window.gsap && racha > 0) {
    gsap.fromTo({ val: 0 }, { val: racha }, {
      duration: 0.8, ease: 'power2.out',
      onUpdate: function() { rachaEl.textContent = Math.round(this.targets()[0].val); }
    });
  } else {
    rachaEl.textContent = racha;
  }

  // Stats mini
  document.getElementById('inicioPlan').textContent  = currentUser.plan || '-';
  document.getElementById('inicioClases').textContent = asistidas;
  document.getElementById('inicioMeses').textContent  = meses;

  // Animación entrada cards (GSAP stagger)
  if (window.gsap) {
    gsap.fromTo('.tab-section.active .glass-card, .tab-section.active .inicio-hero',
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: 'power2.out', delay: 0.05 }
    );
  }

  // Último video visto
  const lastVideo = getLastVideoVisited();
  if (lastVideo) {
    const card = document.getElementById('cardUltimoVideo');
    card.classList.remove('hidden');
    document.getElementById('ultimoVideoRow').innerHTML = `
      <img class="ultimo-video-thumb" src="${lastVideo.thumbnail || ''}" alt="" onerror="this.style.display='none'">
      <div class="ultimo-video-info">
        <h4>${sanitize(lastVideo.titulo)}</h4>
        <p>${sanitize(lastVideo.curso)} · Clase ${lastVideo.numeroClase}</p>
      </div>
    `;
    card.addEventListener('click', () => openVideoModal(lastVideo), { once: true });
  }

  await loadProximaClase();
  await loadProximoEvento();
}

async function loadProximaClase() {
  const container = document.getElementById('proximaClaseContent');
  try {
    const cursosNombres = currentUser.cursosInscritos || [];
    if (cursosNombres.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No tienes clases inscritas</p>';
      return;
    }
    if (userClases.length === 0) {
      const all = await FirestoreService.getClasesActivas();
      userClases = all.filter(c => cursosNombres.some(n => c.nombre && c.nombre.toLowerCase().includes(n.toLowerCase())));
    }
    if (userClases.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No se encontraron clases</p>';
      return;
    }

    const diasOrden = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
    const hoyIdx    = (new Date().getDay() + 6) % 7;
    const now       = new Date();

    const clasesConDist = userClases.map(c => {
      const idx  = diasOrden.indexOf(c.dia);
      if (idx === -1) return { ...c, dist: 99 };
      let dist   = idx - hoyIdx;
      if (dist < 0) dist += 7;
      if (dist === 0) {
        const [h, m] = (c.hora || '00:00').split(':').map(Number);
        if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) dist = 7;
      }
      return { ...c, dist };
    }).sort((a, b) => a.dist !== b.dist ? a.dist - b.dist : (a.hora || '').localeCompare(b.hora || ''));

    const proxima = clasesConDist[0];
    container.innerHTML = clasesConDist.map(c => `
      <div class="proxima-clase-info${c === proxima ? ' proxima-clase-next' : ''}">
        <div class="proxima-dia${c === proxima ? ' proxima-dia-next' : ''}">${c.dia.slice(0,3)}</div>
        <div class="proxima-detalle">
          <h4>${sanitize(c.nombre)}</h4>
          <p>${c.hora}${c.sede ? ' · ' + sanitize(c.sede) : ''}</p>
        </div>
        ${c === proxima ? '<span class="proxima-badge">Próxima</span>' : ''}
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">Error al cargar</p>';
  }
}

async function loadProximoEvento() {
  try {
    const eventos = await FirestoreService.getEventosActivos();
    if (!eventos || eventos.length === 0) return;
    const hoy = new Date().toISOString().split('T')[0];
    const proximos = eventos.filter(ev => (ev.fecha || '') >= hoy).slice(0, 1);
    if (proximos.length === 0) return;
    const ev  = proximos[0];
    const card = document.getElementById('cardEventoInicio');
    card.classList.remove('hidden');
    document.getElementById('eventoInicioContent').innerHTML = `
      <div class="evento-inicio-fecha">${formatDate(ev.fecha)}</div>
      <div class="evento-inicio-titulo">${sanitize(ev.titulo)}</div>
      ${ev.lugar ? `<div class="evento-inicio-lugar">📍 ${sanitize(ev.lugar)}</div>` : ''}
    `;
  } catch (_) {}
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 2 — CLASES (videos + canciones)
// ══════════════════════════════════════════════════════════════════════════
let _clasesVideosData = [];
let _clasesCursoSel   = null;
let _clasesNumSel     = 'todos';

async function loadClases() {
  if (_loaded['clases']) return;
  _loaded['clases'] = true;

  const pillsEl = document.getElementById('clasesCursoPills');
  const gridEl  = document.getElementById('clasesVideosGrid');
  gridEl.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:1rem auto"></div></div>';

  try {
    _clasesVideosData = await ApiService._fetch('/api/contenido?tipo=videos');
  } catch (e) {
    _loaded['clases'] = false;
    gridEl.innerHTML = '<div class="empty-state"><p>Error al cargar videos</p></div>';
    return;
  }

  // Cursos con videos disponibles
  const cursosConVideos = [...new Set(_clasesVideosData.map(v => canonicalizarCurso(v.curso)))];
  const cursosAlumno   = (currentUser.cursosInscritos || []).map(canonicalizarCurso);

  // Todos los cursos: primero los del alumno, luego el resto
  const seen    = new Set();
  const allPills = [];
  [...cursosAlumno, ...cursosConVideos, ...CURSOS_ACADEMIA].forEach(c => {
    const key = normCurso(c);
    if (!seen.has(key)) { seen.add(key); allPills.push(c); }
  });

  pillsEl.innerHTML = allPills.map(c => {
    const esMio  = cursosAlumno.some(a => normCurso(a) === normCurso(c));
    const tieneV = cursosConVideos.some(v => normCurso(v) === normCurso(c));
    return `<button class="curso-pill${esMio ? ' mi-curso' : ''}" data-curso="${sanitize(c)}"
      ${!tieneV ? 'style="opacity:0.45"' : ''}>
      ${esMio ? '★ ' : ''}${sanitize(c)}${!tieneV ? ' (pronto)' : ''}
    </button>`;
  }).join('');

  document.querySelectorAll('.curso-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.curso-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _clasesCursoSel = btn.dataset.curso;
      _clasesNumSel   = 'todos';
      document.querySelectorAll('.clase-num-btn').forEach(b => b.classList.toggle('active', b.dataset.num === 'todos'));
      renderVideosClase();
    });
  });

  // Filtro número de clase
  document.getElementById('clasesNumFiltro').classList.remove('hidden');
  document.querySelectorAll('.clase-num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.clase-num-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _clasesNumSel = btn.dataset.num;
      renderVideosClase();
    });
  });

  // Auto-seleccionar el primer curso del alumno
  const firstMio = allPills.find(c => cursosAlumno.some(a => normCurso(a) === normCurso(c)));
  const autoSel  = firstMio || allPills[0];
  if (autoSel) {
    const btn = pillsEl.querySelector(`[data-curso="${sanitize(autoSel)}"]`);
    if (btn) { btn.click(); return; }
  }
  gridEl.innerHTML = '<div class="empty-state"><p>Selecciona un curso para ver los videos</p></div>';
}

function renderVideosClase() {
  const gridEl = document.getElementById('clasesVideosGrid');
  if (!_clasesCursoSel) return;

  let videos = _clasesVideosData.filter(v => normCurso(v.curso) === normCurso(_clasesCursoSel));
  if (_clasesNumSel !== 'todos') {
    videos = videos.filter(v => String(v.numeroClase) === _clasesNumSel);
  }
  videos.sort((a, b) => a.numeroClase - b.numeroClase);

  if (videos.length === 0) {
    gridEl.innerHTML = '<div class="empty-state"><p>Aún no hay videos para este curso</p></div>';
    return;
  }

  gridEl.innerHTML = videos.map(v => {
    const thumb = v.thumbnail || '';
    return `
      <div class="video-card-v2" data-video-id="${v.id}">
        <div class="video-thumb-wrap">
          ${thumb
            ? `<img class="video-thumb-img" src="${thumb}" alt="" loading="lazy">`
            : `<div class="video-thumb-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)"><polygon points="5,3 19,12 5,21"/></svg></div>`}
          <div class="video-play-circle">
            <div class="video-play-circle-inner">
              <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
            </div>
          </div>
          <div class="video-clase-tag">Clase ${v.numeroClase}</div>
        </div>
        <div class="video-card-v2-body">
          <div class="video-card-v2-titulo">${sanitize(v.titulo || 'Clase ' + v.numeroClase)}</div>
          <div class="video-card-v2-meta">${sanitize(v.mes || '')}${v.anio ? ' ' + v.anio : ''}</div>
        </div>
      </div>
    `;
  }).join('');

  // GSAP stagger entrada
  if (window.gsap) {
    gsap.fromTo('.video-card-v2', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.06, ease: 'back.out(1.2)' });
  }

  // Click en video
  gridEl.querySelectorAll('.video-card-v2').forEach(card => {
    card.addEventListener('click', () => {
      const vid = _clasesVideosData.find(v => v.id === card.dataset.videoId);
      if (vid) openVideoModal(vid);
    });
  });
}

// ── YOUTUBE MODAL ──────────────────────────────────────────────────────────
function setupVideoModal() {
  document.getElementById('videoModalClose').addEventListener('click', closeVideoModal);
  document.getElementById('videoModalBackdrop').addEventListener('click', closeVideoModal);
}

async function openVideoModal(video) {
  saveLastVideoVisited(video);
  const modal = document.getElementById('videoModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Info del video
  document.getElementById('videoModalInfo').innerHTML = `
    <div class="video-modal-titulo">${sanitize(video.titulo || 'Video de clase')}</div>
    <div class="video-modal-meta">${sanitize(video.curso)} · Clase ${video.numeroClase}${video.mes ? ' · ' + video.mes : ''}</div>
  `;

  // Player YouTube
  const container = document.getElementById('ytPlayerContainer');
  container.innerHTML = '<div id="ytPlayer"></div>';

  if (video.youtubeId) {
    const tryCreatePlayer = () => {
      if (window.YT && window.YT.Player) {
        ytPlayer = new YT.Player('ytPlayer', {
          videoId: video.youtubeId,
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: { onReady: (e) => e.target.playVideo() },
        });
      } else {
        setTimeout(tryCreatePlayer, 300);
      }
    };
    tryCreatePlayer();
  } else {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--blanco-suave);font-size:0.85rem;">Video no disponible</div>';
  }

  // Cargar canciones
  await loadCancionesModal(video.curso, video.numeroClase, video.mes, video.anio);

  // Animación entrada
  if (window.gsap) {
    gsap.fromTo('.video-modal-sheet', { y: '100%' }, { y: '0%', duration: 0.35, ease: 'power3.out' });
  }
}

function closeVideoModal() {
  if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
  const modal = document.getElementById('videoModal');
  if (window.gsap) {
    gsap.to('.video-modal-sheet', { y: '100%', duration: 0.25, ease: 'power2.in', onComplete: () => {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }});
  } else {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

async function loadCancionesModal(curso, numeroClase, mes, anio) {
  const listEl = document.getElementById('cancionesList');
  listEl.innerHTML = '<div class="spinner" style="margin:0.8rem auto;width:18px;height:18px;border-width:2px;"></div>';

  try {
    let url = `/api/contenido?tipo=canciones&curso=${encodeURIComponent(curso)}&clase=${numeroClase}`;
    if (mes)  url += `&mes=${encodeURIComponent(mes)}`;
    if (anio) url += `&anio=${encodeURIComponent(anio)}`;
    const canciones = await ApiService._fetch(url);

    if (!canciones || canciones.length === 0) {
      listEl.innerHTML = '<p class="canciones-empty">Canciones próximamente</p>';
      return;
    }

    listEl.innerHTML = canciones.map(c => `
      <div class="cancion-item">
        <span class="cancion-nota">&#127925;</span>
        <div class="cancion-info">
          <div class="cancion-titulo">${sanitize(c.titulo)}</div>
          <div class="cancion-artista">${sanitize(c.artista)}</div>
        </div>
        <div class="cancion-links">
          ${c.urlSpotify ? `<a href="${c.urlSpotify}" target="_blank" rel="noopener" class="cancion-link cancion-link-spotify" title="Abrir en Spotify">S</a>` : ''}
          ${c.urlYoutube ? `<a href="${c.urlYoutube}" target="_blank" rel="noopener" class="cancion-link cancion-link-youtube" title="Ver en YouTube">▶</a>` : ''}
        </div>
      </div>
    `).join('');
  } catch (_) {
    listEl.innerHTML = '<p class="canciones-empty">No se pudieron cargar las canciones</p>';
  }
}

// ── ÚLTIMO VIDEO VISITADO (localStorage) ──────────────────────────────────
function saveLastVideoVisited(video) {
  try { localStorage.setItem('alpaso_lastVideo', JSON.stringify({ id: video.id, titulo: video.titulo, curso: video.curso, numeroClase: video.numeroClase, thumbnail: video.thumbnail || '' })); } catch (_) {}
}
function getLastVideoVisited() {
  try { return JSON.parse(localStorage.getItem('alpaso_lastVideo')); } catch (_) { return null; }
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 3 — COMUNIDAD (eventos swiper + compañeros + galería)
// ══════════════════════════════════════════════════════════════════════════
async function loadComunidad() {
  if (_loaded['comunidad']) return;
  _loaded['comunidad'] = true;

  await Promise.all([
    loadEventosSwiper(),
    loadCompanerosComunidad(),
    loadGaleriaComunidad(),
  ]);
}

async function loadEventosSwiper() {
  const wrapper = document.getElementById('swiperEventosWrapper');
  try {
    const eventos = await FirestoreService.getEventosActivos();
    if (!eventos || eventos.length === 0) {
      wrapper.innerHTML = '<div class="swiper-slide"><div class="evento-slide"><div class="evento-slide-placeholder">🎉</div><div class="evento-slide-body"><div class="evento-slide-titulo">Sin eventos próximos</div></div></div></div>';
    } else {
      wrapper.innerHTML = eventos.slice(0, 5).map(ev => `
        <div class="swiper-slide">
          <div class="evento-slide">
            ${ev.imagenURL
              ? `<img class="evento-slide-cover" src="${ev.imagenURL}" alt="${sanitize(ev.titulo)}" loading="lazy">`
              : `<div class="evento-slide-placeholder">🎉</div>`}
            <div class="evento-slide-body">
              ${ev.fecha ? `<div class="evento-slide-fecha">${formatDate(ev.fecha)}</div>` : ''}
              <div class="evento-slide-titulo">${sanitize(ev.titulo)}</div>
              ${ev.lugar ? `<div class="evento-slide-lugar">📍 ${sanitize(ev.lugar)}</div>` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (_) {
    wrapper.innerHTML = '<div class="swiper-slide"><div class="evento-slide"><div class="evento-slide-placeholder">🎉</div><div class="evento-slide-body"><div class="evento-slide-titulo">Eventos próximamente</div></div></div></div>';
  }

  if (window.Swiper && !swiperEventos) {
    swiperEventos = new Swiper('.swiper-eventos', {
      loop: false,
      spaceBetween: 12,
      pagination: { el: '.swiper-pagination-eventos', clickable: true },
      grabCursor: true,
    });
  }
}

async function loadCompanerosComunidad() {
  const container = document.getElementById('companerosComunidad');
  const cursosNombres = currentUser.cursosInscritos || [];

  if (cursosNombres.length === 0) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.82rem;">No tienes cursos inscritos</p>';
    return;
  }

  try {
    let allCompaneros = [];
    for (const curso of cursosNombres) {
      try {
        const list = await ApiService._fetch(`/api/companeros?curso=${encodeURIComponent(curso)}`);
        if (Array.isArray(list)) allCompaneros.push(...list);
      } catch (_) {}
    }

    if (allCompaneros.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.82rem;">Aún no hay compañeros inscritos</p>';
      return;
    }

    const hoyMes = new Date().getMonth() + 1;
    const hoyDia = new Date().getDate();

    container.innerHTML = allCompaneros.map(comp => {
      const esCumple = comp.cumpleMes === hoyMes && comp.cumpleDia === hoyDia;
      const nombre   = (comp.nombre || '').split(' ')[0];
      return `
        <div class="companero-card">
          <div class="avatar${esCumple ? ' avatar-cumple' : ''}" style="${comp.fotoUrl ? 'padding:0;overflow:hidden;' : ''}">
            ${comp.fotoUrl
              ? `<img src="${avatarUrl(comp.fotoUrl, 80)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`
              : getInitials(comp.nombre)}
          </div>
          <div class="companero-nombre-short">${sanitize(nombre)}${esCumple ? ' 🎂' : ''}</div>
        </div>
      `;
    }).join('');

    if (window.gsap) {
      gsap.fromTo('.companero-card', { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.04, ease: 'back.out(1.5)' });
    }
  } catch (_) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.82rem;">Error al cargar compañeros</p>';
  }
}

let _galeriaData    = [];
let _galeriaFiltro  = 'todos';

async function loadGaleriaComunidad() {
  const gridEl = document.getElementById('galeriaGridComunidad');

  try {
    _galeriaData = await ApiService._fetch('/api/contenido?tipo=galeria');
  } catch (_) {
    gridEl.innerHTML = '<p class="text-muted" style="font-size:0.82rem;">Error al cargar galería</p>';
    return;
  }

  // Filtros
  document.querySelectorAll('.gfiltro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gfiltro-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _galeriaFiltro = btn.dataset.tipo;
      renderGaleria();
    });
  });

  renderGaleria();
}

function renderGaleria() {
  const gridEl = document.getElementById('galeriaGridComunidad');
  const items  = _galeriaFiltro === 'todos'
    ? _galeriaData
    : _galeriaData.filter(g => g.tipo === _galeriaFiltro);

  if (items.length === 0) {
    gridEl.innerHTML = '<p class="text-muted" style="font-size:0.82rem;grid-column:1/-1;text-align:center;padding:1rem;">Sin contenido aún</p>';
    return;
  }

  gridEl.innerHTML = items.map(g => {
    const thumb = g.thumbnailUrl || g.url;
    return `
      <div class="galeria-item-v2" data-url="${g.url}" data-tipo="${g.tipo}">
        ${thumb
          ? `<img src="${thumb}" alt="${sanitize(g.titulo)}" loading="lazy">`
          : `<div class="galeria-item-placeholder">${g.tipo === 'video' ? '▶' : '📷'}</div>`}
        ${g.tipo === 'video' ? '<div class="galeria-video-badge">▶</div>' : ''}
      </div>
    `;
  }).join('');

  gridEl.querySelectorAll('.galeria-item-v2').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      if (url) window.open(url, '_blank');
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 4 — YO
// ══════════════════════════════════════════════════════════════════════════
async function loadYo() {
  if (!currentUser) return;

  const nombre     = currentUser.nombre || 'Alumno';
  const asistidas  = currentUser.clasesAsistidas    || 0;
  const contrat    = currentUser.clasesContratadas  || 0;
  const racha      = currentUser.racha              || 0;
  const meses      = calcMeses(currentUser.fechaIngreso);
  const restantes  = Math.max(0, contrat - asistidas);
  const cursos     = currentUser.cursosInscritos || [];

  // Avatar
  const avatarEl = document.getElementById('perfilAvatar');
  if (currentUser.fotoUrl) {
    avatarEl.innerHTML = `<img src="${avatarUrl(currentUser.fotoUrl, 160)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
    avatarEl.style.padding = '0';
    avatarEl.style.overflow = 'hidden';
  } else {
    avatarEl.textContent = getInitials(nombre);
  }

  document.getElementById('perfilName').textContent   = nombre;
  document.getElementById('perfilRole').textContent   = currentUser.role || 'alumno';
  document.getElementById('perfilCursoLabel').textContent = cursos.join(', ') || '-';
  document.getElementById('statRacha').textContent    = racha;
  document.getElementById('statAsistidas').textContent = asistidas;
  document.getElementById('statMeses').textContent    = meses;
  document.getElementById('perfilClasesRestantes').textContent = restantes;
  document.getElementById('perfilClasesTotal').textContent     = contrat;

  const pct = contrat > 0 ? Math.round((asistidas / contrat) * 100) : 0;
  document.getElementById('perfilProgress').style.width = pct + '%';

  // Feedback del profesor
  loadFeedbackYo();
}

async function loadFeedbackYo() {
  const listEl = document.getElementById('feedbackLista');
  try {
    const feedbacks = await ApiService._fetch(`/api/feedback?alumnoId=${currentUser.uid || currentUser.id}`);
    if (!feedbacks || feedbacks.length === 0) {
      listEl.innerHTML = '<p class="text-muted" style="font-size:0.82rem;">Sin feedback aún</p>';
      return;
    }
    listEl.innerHTML = feedbacks.slice(0, 3).map(fb => `
      <div class="feedback-item">
        <div class="feedback-mes">${fb.mes || ''} ${fb.anio || ''}</div>
        ${fb.positivo  ? `<div class="feedback-bloque feedback-positivo"><div class="feedback-bloque-titulo">👍 Lo positivo</div><p>${sanitize(fb.positivo)}</p></div>` : ''}
        ${fb.mejoras   ? `<div class="feedback-bloque feedback-mejoras"><div class="feedback-bloque-titulo">📈 Progreso</div><p>${sanitize(fb.mejoras)}</p></div>` : ''}
        ${fb.aMejorar  ? `<div class="feedback-bloque feedback-amejorar"><div class="feedback-bloque-titulo">🏁 A trabajar</div><p>${sanitize(fb.aMejorar)}</p></div>` : ''}
      </div>
    `).join('');
  } catch (_) {
    listEl.innerHTML = '<p class="text-muted" style="font-size:0.82rem;">Sin feedback aún</p>';
  }
}

// ── ACCESOS BOTONES TAB YO ─────────────────────────────────────────────────
function setupAccesosBotones() {
  document.getElementById('btnAbrirCalendario').addEventListener('click', () => {
    toggleCollapse('yoCalendarioWrap', () => {
      calendarioLoaded = false;
      loadCalendario();
    });
  });
  document.getElementById('btnAbrirHorario').addEventListener('click', () => {
    toggleCollapse('yoHorarioWrap', () => loadHorario());
  });
  document.getElementById('btnAbrirEval').addEventListener('click', openEvalModal);
  document.getElementById('btnAbrirPlaylist').addEventListener('click', () => {
    toggleCollapse('yoPlaylistWrap', () => {
      const btnsEl = document.getElementById('playlistBtns');
      if (!btnsEl.children.length) {
        btnsEl.innerHTML = PLAYLISTS.map(p => `
          <a href="${p.url}" target="_blank" rel="noopener" class="btn-playlist">
            <span>${p.emoji}</span> ${p.nombre}
          </a>
        `).join('');
      }
    });
  });
}

function toggleCollapse(id, onOpen) {
  const el = document.getElementById(id);
  if (el.classList.contains('hidden')) {
    el.classList.remove('hidden');
    if (onOpen) onOpen();
    if (window.gsap) gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.25 });
  } else {
    el.classList.add('hidden');
  }
}

// ── CALENDARIO ─────────────────────────────────────────────────────────────
let calendarioLoaded = false;

async function loadCalendario() {
  if (calendarioLoaded) return;
  calendarioLoaded = true;

  const grid = document.getElementById('calGridApp');
  if (!grid) return;

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const tituloEl = document.getElementById('calTitulo');
  if (tituloEl) tituloEl.textContent = 'Calendario ' + MESES[month] + ' ' + year;

  const HORARIO_SEMANAL = {
    0: { color: 'bachata-int', titulo: 'Bachata Intermedio' },
    1: { color: 'casino-bas',  titulo: 'Casino Basico' },
    2: { color: 'casino-int',  titulo: 'Casino Intermedio' },
    3: { color: 'mambo',       titulo: 'Mambo Open' },
    4: { color: 'bachata-bas', titulo: 'Bachata Basico' },
  };

  let cumpleanerosMes = [];
  try {
    const todos = await ApiService._fetch('/api/companeros?tipo=cumpleanos');
    cumpleanerosMes = todos.filter(c => c.mes === (month + 1));
  } catch (_) {}

  const cumplesPorDia = {};
  cumpleanerosMes.forEach(c => {
    if (!cumplesPorDia[c.dia]) cumplesPorDia[c.dia] = [];
    cumplesPorDia[c.dia].push(c);
  });

  const primerDia  = new Date(year, month, 1);
  const offset     = (primerDia.getDay() + 6) % 7;
  const diasEnMes  = new Date(year, month + 1, 0).getDate();
  const hoy        = new Date();
  const esEsteMes  = hoy.getFullYear() === year && hoy.getMonth() === month;

  const clasesPorDia = {};
  for (let d = 1; d <= diasEnMes; d++) {
    const ds = (new Date(year, month, d).getDay() + 6) % 7;
    if (HORARIO_SEMANAL[ds]) clasesPorDia[d] = [HORARIO_SEMANAL[ds]];
  }

  let html = '';
  for (let v = 0; v < offset; v++) html += '<div class="cal-dia-app vacio"></div>';
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const clases  = clasesPorDia[dia] || [];
    const cumples = cumplesPorDia[dia] || [];
    const esHoy   = esEsteMes && hoy.getDate() === dia;
    html += `<div class="cal-dia-app${clases.length ? ' tiene-clase' : ''}${esHoy ? ' hoy' : ''}${cumples.length ? ' tiene-cumple' : ''}">
      <span class="cal-num-app">${dia}</span>
      ${clases.length ? `<div class="cal-puntos-app">${clases.map(c => `<div class="cal-punto-app cal-dot-${c.color}"></div>`).join('')}</div>` : ''}
      ${cumples.length ? '<div class="cal-cumple-emoji">🎂</div>' : ''}
    </div>`;
  }
  grid.innerHTML = html;

  if (cumpleanerosMes.length > 0) {
    const listEl = document.getElementById('cumpleanerosMes');
    if (listEl) {
      listEl.innerHTML = `<div class="cumple-lista-titulo">🎂 Cumpleaños de ${MESES[month]}</div>` +
        cumpleanerosMes.sort((a, b) => a.dia - b.dia).map(c =>
          `<div class="cumple-item"><span class="cumple-dia">${c.dia}</span><span class="cumple-nombre">${sanitize(c.nombre)}</span></div>`
        ).join('');
    }
  }
}

// ── HORARIO ────────────────────────────────────────────────────────────────
async function loadHorario() {
  const container     = document.getElementById('horarioList');
  const cursosNombres = currentUser.cursosInscritos || [];

  if (cursosNombres.length === 0) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.82rem;">No tienes clases inscritas</p>';
    return;
  }

  try {
    if (userClases.length === 0) {
      const all = await FirestoreService.getClasesActivas();
      userClases = all.filter(c => cursosNombres.some(n => c.nombre && c.nombre.toLowerCase().includes(n.toLowerCase())));
    }
    if (userClases.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.82rem;">No se encontraron clases</p>';
      return;
    }

    const diasOrden = ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'];
    const sorted    = [...userClases].sort((a, b) => {
      const dA = diasOrden.indexOf(a.dia), dB = diasOrden.indexOf(b.dia);
      if (dA !== dB) return dA - dB;
      return (a.hora || '').localeCompare(b.hora || '');
    });

    container.innerHTML = sorted.map(c => `
      <div class="boleto-mini">
        <div class="boleto-mini-izq">
          <div class="boleto-mini-dia">${c.dia}</div>
          <div class="boleto-mini-hora">${c.hora}</div>
        </div>
        <div class="boleto-mini-der">
          <div class="boleto-mini-nombre">${sanitize(c.nombre)}</div>
          <div class="boleto-mini-detalle">${c.instructor || 'Sergio Gary'} · ${c.sede || 'Costa de Montemar'}</div>
        </div>
      </div>
    `).join('');
  } catch (_) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.82rem;">Error al cargar horario</p>';
  }
}

// ── MODAL EVALUACIÓN ───────────────────────────────────────────────────────
function setupEvaluacion() {
  ['evalAppDisfrute', 'evalAppComprension', 'evalAppComodidad', 'evalAppConfianza'].forEach(id => {
    const input = document.getElementById(id), display = document.getElementById(id + 'Val');
    if (input && display) input.addEventListener('input', () => { display.textContent = input.value; });
  });

  document.querySelectorAll('.eval-app-clase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.eval-app-clase-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  document.getElementById('evalAppBaileSi').addEventListener('click', () => {
    document.getElementById('evalAppBaileSi').classList.add('selected-si');
    document.getElementById('evalAppBaileNo').classList.remove('selected-no');
  });
  document.getElementById('evalAppBaileNo').addEventListener('click', () => {
    document.getElementById('evalAppBaileNo').classList.add('selected-no');
    document.getElementById('evalAppBaileSi').classList.remove('selected-si');
  });

  document.getElementById('btnEnviarEvalApp').addEventListener('click', enviarEvaluacionAlumno);
}

function setupEvalModal() {
  document.getElementById('evalModalClose').addEventListener('click', closeEvalModal);
  document.getElementById('evalModalBackdrop').addEventListener('click', closeEvalModal);
}

function openEvalModal() {
  document.getElementById('evalModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Pre-llenar cursos
  const select = document.getElementById('evalAppCurso');
  const cursosNombres = currentUser.cursosInscritos || [];
  if (!select.children.length || select.children.length === 1) {
    if (userClases.length > 0) {
      poblarCursos(select, userClases);
    } else if (cursosNombres.length > 0) {
      select.innerHTML = '<option value="">Selecciona tu curso</option>';
      cursosNombres.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        select.appendChild(opt);
      });
      if (cursosNombres.length === 1) select.value = cursosNombres[0];
    }
  }

  if (window.gsap) {
    gsap.fromTo('.eval-modal-sheet', { y: '100%' }, { y: '0%', duration: 0.35, ease: 'power3.out' });
  }
}

function closeEvalModal() {
  const modal = document.getElementById('evalModal');
  if (window.gsap) {
    gsap.to('.eval-modal-sheet', { y: '100%', duration: 0.25, ease: 'power2.in', onComplete: () => {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }});
  } else {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function poblarCursos(select, clases) {
  select.innerHTML = '<option value="">Selecciona tu curso</option>';
  clases.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.nombre;
    opt.textContent = c.nombre + (c.dia ? ' — ' + c.dia : '');
    select.appendChild(opt);
  });
  if (clases.length === 1) select.value = clases[0].nombre;
}

async function enviarEvaluacionAlumno() {
  const errorEl = document.getElementById('evalAppError');
  const exitoEl = document.getElementById('evalAppExito');
  errorEl.classList.add('hidden');
  exitoEl.classList.add('hidden');

  const curso     = document.getElementById('evalAppCurso').value;
  const claseBtn  = document.querySelector('.eval-app-clase-btn.selected');
  const tieneSi   = document.getElementById('evalAppBaileSi').classList.contains('selected-si');
  const tieneNo   = document.getElementById('evalAppBaileNo').classList.contains('selected-no');

  if (!curso)            { mostrarEvalError('Selecciona tu curso.'); return; }
  if (!claseBtn)         { mostrarEvalError('Selecciona el número de clase.'); return; }
  if (!tieneSi && !tieneNo) { mostrarEvalError('Indica si bailaste con alguien nuevo.'); return; }

  const btn = document.getElementById('btnEnviarEvalApp');
  btn.disabled = true; btn.textContent = 'Enviando...';

  try {
    await ApiService._fetch('/api/evaluaciones', { method: 'POST', body: JSON.stringify({
      nombreAlumno:    currentUser.nombre,
      curso,
      numeroClase:     parseInt(claseBtn.dataset.clase),
      disfrute:        parseInt(document.getElementById('evalAppDisfrute').value),
      comprension:     parseInt(document.getElementById('evalAppComprension').value),
      comodidadPareja: parseInt(document.getElementById('evalAppComodidad').value),
      confianza:       parseInt(document.getElementById('evalAppConfianza').value),
      baileNuevo:      tieneSi,
      comentario:      document.getElementById('evalAppComentario').value.trim(),
    })});
    exitoEl.textContent = '¡Evaluación enviada! Gracias 🙌';
    exitoEl.classList.remove('hidden');
    // Reset
    document.querySelectorAll('.eval-app-clase-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('evalAppBaileSi').classList.remove('selected-si');
    document.getElementById('evalAppBaileNo').classList.remove('selected-no');
    ['evalAppDisfrute','evalAppComprension','evalAppComodidad','evalAppConfianza'].forEach(id => {
      document.getElementById(id).value = 5;
      document.getElementById(id + 'Val').textContent = '5';
    });
    document.getElementById('evalAppComentario').value = '';
    setTimeout(closeEvalModal, 2000);
  } catch (err) {
    mostrarEvalError(err.message && err.message.includes('409') ? 'Ya enviaste tu evaluación de hoy.' : (err.message || 'Error al enviar.'));
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar evaluación';
  }
}

function mostrarEvalError(msg) {
  const el = document.getElementById('evalAppError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── FOTO UPLOAD ────────────────────────────────────────────────────────────
function setupFotoUpload() {
  const btn = document.getElementById('fotoUploadBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const base64 = await abrirRecortador(file);
        const cloud  = await subirCloudinary(base64);
        if (cloud) {
          await ApiService.updateUser(currentUser.uid || currentUser.id, { fotoUrl: cloud });
          currentUser.fotoUrl = cloud;
          const avatarEl = document.getElementById('perfilAvatar');
          avatarEl.innerHTML = `<img src="${avatarUrl(cloud, 160)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
          avatarEl.style.padding = '0'; avatarEl.style.overflow = 'hidden';
        }
      } catch (_) {}
    };
    input.click();
  });
}

async function subirCloudinary(base64) {
  const CLOUD_NAME    = 'debpk4syz';
  const UPLOAD_PRESET = 'al-paso-fotos';
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: JSON.stringify({ file: base64, upload_preset: UPLOAD_PRESET }),
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  return data.secure_url || null;
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getInitials(nombre) {
  if (!nombre) return '??';
  const parts = nombre.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nombre.slice(0, 2).toUpperCase();
}

function calcMeses(fechaIngreso) {
  if (!fechaIngreso) return 0;
  const ingreso = new Date(fechaIngreso);
  const hoy     = new Date();
  const meses   = (hoy.getFullYear() - ingreso.getFullYear()) * 12 + (hoy.getMonth() - ingreso.getMonth());
  return Math.max(0, meses);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  } catch (_) { return dateStr; }
}
