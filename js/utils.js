// utils.js — helpers
export function normalizeDistrito(d) {
  if (!d) return "";
  const m = String(d).match(/(\d+)/);
  return m ? `D${String(Number(m[1])).padStart(2, "0")}` : String(d).toUpperCase();
}

export function createSlug(nombre, distrito) {
  const stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const base = `${nombre}-${distrito}`.toLowerCase().trim();
  return stripAccents(base).replace(/[^a-z0-9\- ]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      // <-- normalize event name to lowercase so onClick / onclick both work
      node.addEventListener(k.substring(2).toLowerCase(), v);
    }
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).filter(Boolean).forEach(c => {
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  });
  return node;
}

export function byId(id){ return document.getElementById(id); }

export function debounce(fn, ms=250){
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function safeList(list){
  return Array.isArray(list) ? list.filter(Boolean) : [];
}

export function openExternal(url){
  if (!url) return null;
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  return a;
}
