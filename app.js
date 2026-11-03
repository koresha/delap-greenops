document.getElementById("version").textContent = "v" + DELAP_CONFIG.version;
document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const q = {};
  for (const [k, v] of data.entries()) q[k] = Number(v) || 0;
  const r = calculer(q);
  document.getElementById("co2").textContent = r.co2.toLocaleString("fr-FR");
  document.getElementById("waste").textContent = r.poids.toLocaleString("fr-FR");
  document.getElementById("trees").textContent = r.arbres.toLocaleString("fr-FR");
  document.getElementById("results").hidden = false;
});
