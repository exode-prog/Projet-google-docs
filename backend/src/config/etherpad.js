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

// Crée (ou récupère) un groupe Etherpad correspondant à notre document.
// C'est ce groupe qui permet ensuite de créer des sessions restreintes :
// un pad "simple" (createPad) reste accessible publiquement par quiconque
// connaît son URL, alors qu'un pad de groupe n'est accessible qu'avec une
// session valide, créée uniquement par notre backend après vérification
// des droits (table permission).
async function createGroupIfNotExistsFor(documentId) {
  const result = await callEtherpad("createGroupIfNotExistsFor", { groupMapper: documentId });
  return result.groupID;
}

// Crée le pad à l'intérieur de ce groupe. L'identifiant réel du pad devient
// "<groupID>$<padName>" — c'est cette valeur composée qu'on stocke dans
// document.etherpad_id. La réponse de l'API renvoie un objet { padID, deletionToken },
// pas directement la chaîne : il faut bien extraire le champ padID.
async function createGroupPad(groupID, padName) {
  const result = await callEtherpad("createGroupPad", { groupID, padName });
  return result.padID;
}

// Mappe un utilisateur de notre application à un auteur Etherpad. Idempotent :
// appeler plusieurs fois avec le même authorMapper renvoie toujours le même auteur.
async function createAuthorIfNotExistsFor(userId, name) {
  const result = await callEtherpad("createAuthorIfNotExistsFor", { authorMapper: userId, name });
  return result.authorID;
}

// Crée une session temporaire liant un auteur à un groupe, expirant à validUntil
// (timestamp Unix en secondes). C'est l'identifiant de cette session, posé comme
// cookie côté navigateur, qui autorise réellement l'accès au pad.
async function createSession(groupID, authorID, validUntilSeconds) {
  const result = await callEtherpad("createSession", { groupID, authorID, validUntil: validUntilSeconds });
  return result.sessionID;
}

module.exports = {
  createPad,
  getReadOnlyID,
  deletePad,
  createGroupIfNotExistsFor,
  createGroupPad,
  createAuthorIfNotExistsFor,
  createSession,
};
