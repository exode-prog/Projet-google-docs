const pool = require("../config/db");

// Renvoie le rôle (owner/editor/viewer) d'un utilisateur sur un document,
// ou null s'il n'a aucun accès. Utilisé par toutes les routes qui touchent
// à un document (documents.js, files.js...) pour éviter de dupliquer la requête.
async function getRole(documentId, userId) {
  const result = await pool.query(
    "SELECT role FROM permission WHERE document_id = $1 AND user_id = $2",
    [documentId, userId]
  );
  return result.rows[0]?.role || null;
}

module.exports = { getRole };
