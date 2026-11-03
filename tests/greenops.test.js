const assert = require("node:assert");
const { calculer } = require("../app/greenops.js");
const r = calculer({ laptop: 10, desktop: 0, screen: 0, server: 0 });
assert.strictEqual(r.co2, 1500);
assert.strictEqual(r.poids, 25);
assert.strictEqual(r.arbres, 60);
console.log("Tests OK");
