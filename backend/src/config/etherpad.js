// Client minimal pour l'HTTP API d'Etherpad (documentation officielle) :
// https://github.com/ether/etherpad-lite/blob/develop/doc/api/http_api.md
//
// Utilise le fetch natif de Node.js (>= 18) : aucun module supplémentaire à installer.

const BASE_URL = process.env.ETHERPAD_BASE_URL || "http://localhost:9001";
const API_KEY = process.env.ETHERPAD_API_KEY;
const API_VERSION = "1.2.15"; // version de l'HTTP API supportée par l'image etherpad/etherpad utilisée

async function callEtherpad(functionName, params = {}) {
  const query = new URLSearchParams({ apikey: API_KEY, ...params });
  const url = `${BASE_URL}/api/${API_VERSION}/${functionName}?${query.toString()}`;

  const response = await fetch(url);
  const data = await response.json();

  // Etherpad renvoie toujours { code, message, data }.
  // code 0 = succès, 1 = erreur générique, 2 = erreur interne, 3 = argument invalide, 4 = clé API invalide.
  if (data.code !== 0) {
    throw new Error(`Etherpad (${functionName}) : ${data.message}`);
  }
  return data.data;
}

// Crée un pad avec un identifiant choisi par notre application (on réutilise l'UUID du document).
async function createPad(padID) {
  return callEtherpad("createPad", { padID });
}

// Renvoie l'identifiant de lecture seule associé à un pad (toujours le même pour un padID donné).
async function getReadOnlyID(padID) {
  const result = await callEtherpad("getReadOnlyID", { padID });
  return result.readOnlyID;
}

// Supprime un pad (appelé quand un document est supprimé côté application).
async function deletePad(padID) {
  return callEtherpad("deletePad", { padID });
}

module.exports = { createPad, getReadOnlyID, deletePad };
