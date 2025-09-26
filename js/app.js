// app.js — carga JSON, render de cards, filtros, modal detalle
import { normalizeDistrito, el, byId, debounce, safeList } from "./utils.js";
import { getParams, setParam } from "./router.js";

const state = {
  candidatos: [],
  indexBySlug: new Map(),
  distritos: new Set(),
  filtroDistrito: "",
  search: "",
  comunaMap: {},        // mapa comuna -> distrito
  selectedComuna: ""    // comuna seleccionada por el usuario
};

const elements = {
  grid: byId("grid"),
  estado: byId("estado"),
  selectDistrito: byId("filtro-distrito"),
  selectComuna: byId("filtro-comuna"),
  btnLimpiarComuna: byId("btn-limpiar"),
  buscador: byId("buscador"),
  contador: byId("contador"),
  modal: byId("modal-detalle"),
  modalCerrar: byId("modal-cerrar"),
  detalleFoto: byId("detalle-foto"),
  modalTitulo: byId("modal-titulo"),
  detalleSub: byId("detalle-subtitulo"),
  secMotiv: byId("detalle-motivacion"),
  txtMotiv: byId("detalle-motivacion-text"),
  secEjes: byId("detalle-ejes"),
  listEjes: byId("detalle-ejes-list"),
  secLogros: byId("detalle-logros"),
  listLogros: byId("detalle-logros-list"),
  secCP: byId("detalle-compromisos-partido"),
  listCP: byId("detalle-compromisos-partido-list"),
  secCE: byId("detalle-compromisos-electo"),
  listCE: byId("detalle-compromisos-electo-list"),
  secContacto: byId("detalle-contacto"),
  listContacto: byId("detalle-contacto-list"),
  secEnlaces: byId("detalle-enlaces"),
  listEnlaces: byId("detalle-enlaces-list"),
};

/* ---------- Mapa comuna -> distrito ---------- */
state.comunaMap = {
  "Maipú": "D08",
  "Estación Central": "D08",
  "Cerrillos": "D08",
  "Cerro Navia": "D09",
  "Conchalí": "D09",
  "Huechuraba": "D09",
  "Independencia": "D09",
  "Lo Prado": "D09",
  "Quinta Normal": "D09",
  "Recoleta": "D09",
  "Renca": "D09",
  "La Granja": "D10",
  "Macul": "D10",
  "Ñuñoa": "D10",
  "Providencia": "D10",
  "San Joaquín": "D10",
  "Santiago": "D10",
  "Las Condes": "D11",
  "Lo Barnechea": "D11",
  "Peñalolén": "D11",
  "La Reina": "D11",
  "Vitacura": "D11",
  "La Florida": "D12",
  "La Pintana": "D12",
  "Pirque": "D12",
  "Puente Alto": "D12",
  "San José de Maipo": "D12",
  "El Bosque": "D13",
  "La Cisterna": "D13",
  "Lo Espejo": "D13",
  "Pedro Aguirre Cerda": "D13",
  "San Miguel": "D13",
  "San Ramón": "D13",
  "Alhué": "D14",
  "Buin": "D14",
  "Calera de Tango": "D14",
  "Curacaví": "D14",
  "El Monte": "D14",
  "Isla de Maipo": "D14",
  "María Pinto": "D14",
  "Melipilla": "D14",
  "Paine": "D14",
  "Peñaflor": "D14",
  "San Bernardo": "D14",
  "San Pedro": "D14",
  "Talagante": "D14"
};

/* ---------- Helpers ---------- */
function normalizeStr(s){
  if (!s && s !== "") return "";
  return String(s).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/* ---------- Carga de datos ---------- */
async function loadData() {
  try {
    const res = await fetch("candidatos2.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const data = await res.json();
    state.candidatosData = data;
    state.candidatos = Array.isArray(data.candidatos) ? data.candidatos : [];
    state.indexBySlug = new Map(state.candidatos.map(c => [c.slug, c]));
    state.distritos = new Set(state.candidatos.map(c => normalizeDistrito(c.distrito)));

    populateDistritos();
    populateComunas();
    applyParamsAndRender();
  } catch (err) {
    showEstado(`No se pudo cargar candidatos.json (${err.message}).`);
  }
}

/* ---------- Populate distritos ---------- */
function populateDistritos(){
  const opts = [...state.distritos].sort();
  for(const d of opts){
    const o = el("option", { value: d }, d.replace(/-/g, " "));
    elements.selectDistrito.appendChild(o);
  }
}

/* ---------- Populate comunas ---------- */
function populateComunas(){
  const mapa = state.comunaMap || {};
  if (!elements.selectComuna) return;
  elements.selectComuna.querySelectorAll('option:not([value=""])').forEach(o => o.remove());
  const comunas = Object.keys(mapa).sort((a,b) => a.localeCompare(b, 'es'));
  for (const c of comunas) {
    const o = el("option", { value: c }, c);
    elements.selectComuna.appendChild(o);
  }
}

/* ---------- Leer params e inicializar filtros ---------- */
function applyParamsAndRender(){
  const p = getParams();
  const qDist = p.get("distrito");
  const qSlug = p.get("candidato");
  const qComuna = p.get("comuna");

  if (qDist) {
    state.filtroDistrito = normalizeDistrito(qDist);
    elements.selectDistrito.value = state.filtroDistrito;
  }
  if (qComuna) {
    state.selectedComuna = qComuna;
    if (elements.selectComuna) elements.selectComuna.value = qComuna;
    // sincronizar distrito desde comuna
    const comunaKey = Object.keys(state.comunaMap).find(k => normalizeStr(k) === normalizeStr(qComuna));
    if (comunaKey) {
      state.filtroDistrito = state.comunaMap[comunaKey];
      if (elements.selectDistrito) elements.selectDistrito.value = state.filtroDistrito;
    }
  }

  render();

  if (qSlug && state.indexBySlug.has(qSlug)){
    openDetalle(state.indexBySlug.get(qSlug));
  }
}

/* ---------- Filtrado ---------- */
function filterData(){
  const search = state.search.trim().toLowerCase();
  const distrito = state.filtroDistrito; // siempre filtramos por distrito
  return state.candidatos.filter(c => {
    const okDist = !distrito || normalizeDistrito(c.distrito) === distrito;
    const okSearch = !search || String(c.nombre || "").toLowerCase().includes(search);
    return okDist && okSearch;
  });
}

/* ---------- Render principal ---------- */
function render(){
  const data = filterData();
  elements.grid.innerHTML = "";
  elements.estado.hidden = true;
  elements.contador.textContent = `${data.length} resultado${data.length===1?"":"s"}`;

  let info = document.getElementById('filtro-info');
  if (!info) {
    info = document.createElement('div');
    info.id = 'filtro-info';
    info.style.margin = '0 0 var(--space-lg) 0';
    info.style.display = 'flex';
    info.style.alignItems = 'center';
    info.style.gap = '8px';
    info.style.fontWeight = '600';
    info.style.color = 'var(--muted)';
    const texto = document.createElement('span');
    texto.id = 'filtro-info-text';
    const btn = document.createElement('button');
    btn.id = 'filtro-info-clear';
    btn.type = 'button';
    btn.title = 'Quitar filtro';
    btn.style.background = 'transparent';
    btn.style.border = '0';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '700';
    btn.style.padding = '4px 8px';
    btn.innerHTML = '✕';
    btn.addEventListener('click', () => {
      if (elements.selectComuna) elements.selectComuna.value = "";
      state.selectedComuna = "";
      state.filtroDistrito = "";
      if (elements.selectDistrito) elements.selectDistrito.value = "";
      setParam("distrito", null);
      setParam("comuna", null);
      render();
    });
    const icon = document.createElement('span');
    icon.id = 'filtro-info-icon';
    icon.textContent = '📍';
    icon.style.opacity = '0.9';
    info.appendChild(icon);
    info.appendChild(texto);
    info.appendChild(btn);
    if (elements.grid && elements.grid.parentNode) {
      elements.grid.parentNode.insertBefore(info, elements.grid);
    } else {
      document.body.insertBefore(info, document.body.firstChild);
    }
  }

  const texto = document.getElementById('filtro-info-text');

  if (state.selectedComuna) {
    const distritoDisplay = state.filtroDistrito ? `Distrito ${state.filtroDistrito}` : '';
    texto.textContent = `Candidatos — ${distritoDisplay ? distritoDisplay + ' ' : ''}(${state.selectedComuna})`.trim();
    info.style.display = 'flex';
  } else if (state.filtroDistrito) {
    texto.textContent = `Candidatos — Distrito ${state.filtroDistrito}`;
    info.style.display = 'flex';
  } else {
    texto.textContent = '';
    info.style.display = 'none';
  }

  if (data.length === 0){
    showEstado("No hay resultados para los filtros actuales.");
    return;
  }

  for(const c of data){
    const foto = c.fotoUrl || "";
    const ejes = safeList(c.ejes).slice(0,3);
    const card = el("article", { class: "card" }, [
      el("img", { class: "card-img", src: foto, alt: c.nombre, loading: "lazy" }),
      el("div", { class: "card-body" }, [
        el("div", { class: "badge" }, normalizeDistrito(c.distrito)),
        el("h3", { class: "card-title" }, c.nombre),
        el("p", { class: "muted" }, c.profesion || ""),
        ejes.length ? el("p", { class: "ejes" }, "• " + ejes.join(" · ")) : null,
        el("div", { class: "card-actions" }, [
          el("button", {
            class: "btn",
            onClick: () => openDetalle(c)
          }, "Ver más")
        ])
      ])
    ]);
    elements.grid.appendChild(card);
  }
}

/* ---------- Estado simple ---------- */
function showEstado(msg){
  elements.estado.hidden = false;
  elements.estado.textContent = msg;
}

/* ---------- Detalle modal ---------- */
function openDetalle(c) {
  elements.detalleFoto.src = c.fotoUrl || "";
  elements.detalleFoto.alt = c.nombre;
  elements.modalTitulo.textContent = c.nombre;
  const sub = [normalizeDistrito(c.distrito), c.profesion, c.numeroEnVoto ? `N° voto: ${c.numeroEnVoto}` : null].filter(Boolean).join(" • ");
  elements.detalleSub.textContent = sub;

  setSection(elements.secMotiv, elements.txtMotiv, c.motivacion);
  setListSection(elements.secEjes, elements.listEjes, safeList(c.ejes));
  setListSection(elements.secLogros, elements.listLogros, safeList(c.logros));
  setListSection(elements.secCP, elements.listCP, safeList(c.compromisosPartido));
  setListSection(elements.secCE, elements.listCE, safeList(c.compromisosElecto));

  const contacto = [];
  if (c.email) contacto.push(`Email: ${c.email}`);
  if (c.telefono) contacto.push(`Teléfono: ${c.telefono}`);
  setListSection(elements.secContacto, elements.listContacto, contacto);

  const enlaces = [];
  const redes = c.redes || {};
  const icons = state.candidatosData ? state.candidatosData.icons : {
    x: "fa-brands fa-x-twitter",
    facebook: "fa-brands fa-facebook",
    instagram: "fa-brands fa-instagram",
    tiktok: "fa-brands fa-tiktok",
    youtube: "fa-brands fa-youtube",
    linkedin: "fa-brands fa-linkedin",
    kwai: "fa-solid fa-video",
    otros: "fa-solid fa-link"
  };

  const addLinks = (label, arr, platformKey) => {
    if (Array.isArray(arr) && arr.length) {
      const links = arr.map(u => {
        let normalizedUrl = u;
        let iconClass = icons[platformKey] || icons.otros;
        let displayLabel = label;

        if (platformKey === 'otros') {
          if (u.toLowerCase().includes('tik tok') || u.toLowerCase().includes('tiktok')) {
            normalizedUrl = `https://www.tiktok.com/${u.split(' ')[0]}`;
            iconClass = icons.tiktok;
            displayLabel = 'TikTok';
          } else if (u.includes('Kwai')) {
            normalizedUrl = `https://www.kwai.com/${u.split(' ')[0]}`;
            iconClass = icons.kwai;
            displayLabel = 'Kwai';
          } else if (u.includes('Facebook')) {
            normalizedUrl = `https://www.facebook.com/${u.split(' ')[0]}`;
            iconClass = icons.facebook;
            displayLabel = 'Facebook';
          } else if (u.toLowerCase().includes('instagram')) {
            normalizedUrl = `https://www.instagram.com/${u.split(' ')[0].replace(/^@/, '')}`;
            iconClass = icons.instagram;
            displayLabel = 'Instagram';
          }
        }

        return `<a href="${normalizedUrl}" target="_blank" rel="noopener"><i class="${iconClass}"></i> ${displayLabel}</a>`;
      }).join(" · ");
      enlaces.push(`${label}: ${links}`);
    }
  };

  if (c.web) enlaces.push(`<a href="${c.web}" target="_blank" rel="noopener"><i class="${icons.otros}"></i> Sitio web</a>`);
  addLinks("X/Twitter", redes.x, "x");
  addLinks("Facebook", redes.facebook, "facebook");
  addLinks("Instagram", redes.instagram, "instagram");
  addLinks("TikTok", redes.tiktok, "tiktok");
  addLinks("YouTube", redes.youtube, "youtube");
  addLinks("LinkedIn", redes.linkedin, "linkedin");
  addLinks("Otros", redes.otros, "otros");

  if (enlaces.length) {
    elements.listEnlaces.innerHTML = enlaces.map(li => `<li>${li}</li>`).join("");
    elements.secEnlaces.hidden = false;
  } else {
    elements.secEnlaces.hidden = true;
    elements.listEnlaces.innerHTML = "";
  }

  if (typeof elements.modal.showModal === "function") {
    elements.modal.showModal();
  } else {
    elements.modal.setAttribute("open", "");
  }
  setParam("candidato", c.slug);
}

/* ---------- Utilidades de secciones ---------- */
function setSection(sectionEl, textEl, value){
  if (value && String(value).trim()){
    textEl.textContent = value;
    sectionEl.hidden = false;
  }else{
    textEl.textContent = "";
    sectionEl.hidden = true;
  }
}

function setListSection(sectionEl, listEl, items){
  if (items && items.length){
    listEl.innerHTML = items.map(x => `<li>${escapeHtml(String(x))}</li>`).join("");
    sectionEl.hidden = false;
  }else{
    listEl.innerHTML = "";
    sectionEl.hidden = true;
  }
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ---------- Manejar cambio de comuna ---------- */
function handleComunaChange(){
  if (!elements.selectComuna) return;
  const comuna = elements.selectComuna.value || "";
  state.selectedComuna = comuna;

  if (!comuna) {
    state.filtroDistrito = "";
    if (elements.selectDistrito) elements.selectDistrito.value = "";
    setParam("distrito", null);
    setParam("comuna", null);
    render();
    return;
  }

  const comunaKey = Object.keys(state.comunaMap).find(k => normalizeStr(k) === normalizeStr(comuna));
  if (comunaKey) {
    const distrito = String(state.comunaMap[comunaKey]);
    state.filtroDistrito = distrito;
    if (elements.selectDistrito) elements.selectDistrito.value = distrito;
    setParam("distrito", distrito);
    setParam("comuna", comuna);
  }

  render();
}

/* ---------- Eventos y bindings ---------- */
function bindEvents(){
  elements.selectDistrito.addEventListener("change", () => {
    state.filtroDistrito = elements.selectDistrito.value;
    state.selectedComuna = "";
    if (elements.selectComuna) elements.selectComuna.value = "";
    setParam("distrito", state.filtroDistrito || null);
    setParam("comuna", null);
    render();
  });

  if (elements.selectComuna) {
    elements.selectComuna.addEventListener("change", handleComunaChange);
  }

  if (elements.btnLimpiarComuna) {
    elements.btnLimpiarComuna.addEventListener("click", () => {
      if (elements.selectComuna) elements.selectComuna.value = "";
      state.selectedComuna = "";
      state.filtroDistrito = "";
      if (elements.selectDistrito) elements.selectDistrito.value = "";
      setParam("distrito", null);
      setParam("comuna", null);
      render();
    });
  }

  elements.buscador.addEventListener("input", debounce(() => {
    state.search = elements.buscador.value;
    render();
  }, 180));

  elements.modalCerrar.addEventListener("click", () => {
    elements.modal.close();
    setParam("candidato", null);
  });
}

/* ---------- Inicio ---------- */
function init(){
  bindEvents();
  loadData();
}

init();

