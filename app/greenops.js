// Calcul GreenOps de DELAP : impact évité par appareil recyclé (ordres de grandeur pédagogiques).
const FACTEURS = {
  laptop:  { co2: 150, poids: 2.5 },
  desktop: { co2: 250, poids: 9 },
  screen:  { co2: 200, poids: 5 },
  server:  { co2: 1000, poids: 25 },
};
const CO2_PAR_ARBRE_PAR_AN = 25; // kg CO2 absorbés par un arbre en un an (approximation)

function calculer(quantites) {
  let co2 = 0, poids = 0;
  for (const [type, nb] of Object.entries(quantites)) {
    const f = FACTEURS[type];
    if (!f) continue;
    co2 += f.co2 * nb;
    poids += f.poids * nb;
  }
  return { co2, poids, arbres: Math.round(co2 / CO2_PAR_ARBRE_PAR_AN) };
}

if (typeof module !== "undefined") module.exports = { calculer, FACTEURS };
