// router.js — gestiona parámetros ?distrito= y ?candidato=
export function getParams(){
  return new URLSearchParams(location.search);
}

export function setParam(key, value){
  const p = getParams();
  if (!value) p.delete(key); else p.set(key, value);
  const newUrl = `${location.pathname}?${p.toString()}`;
  history.replaceState({}, "", newUrl);
}
