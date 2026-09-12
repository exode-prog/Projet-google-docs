const express = require("express");
const pool = require("../config/db");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

// Toutes les routes documents nécessitent d'être authentifié.
router.use(requireAuth);

// POST /api/documents
// Crée un document et donne automatiquement le rôle "owner" à son créateur
// (matérialise l'association A_ACCES du MCD, portée par la table permission).
router.post("/", async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ status: "error", message: "Le titre est requis" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const docResult = await client.query(
      "INSERT INTO document (title, owner_id) VALUES ($1, $2) RETURNING id, title, created_at",
      [title, req.user.id]
    );
    const document = docResult.rows[0];

    await client.query(
      "INSERT INTO permission (document_id, user_id, role) VALUES ($1, $2, 'owner')",
      [document.id, req.user.id]
    );

    await client.query("COMMIT");
    res.status(201).json({ status: "ok", document });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur création document :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la création du document" });
  } finally {
    client.release();
  }
});

// GET /api/documents
// Liste uniquement les documents auxquels l'utilisateur connecté a accès,
// avec le rôle qu'il y détient (jointure sur la table permission).
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.title, d.created_at, d.updated_at, p.role
       FROM document d
       JOIN permission p ON p.document_id = d.id
       WHERE p.user_id = $1
       ORDER BY d.updated_at DESC`,
      [req.user.id]
    );
    res.json({ status: "ok", documents: result.rows });
  } catch (err) {
    console.error("Erreur liste documents :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la récupération des documents" });
  }
});

// Petite fonction utilitaire : vérifie le rôle de l'utilisateur sur un document donné.
async function getRole(documentId, userId) {
  const result = await pool.query(
    "SELECT role FROM permission WHERE document_id = $1 AND user_id = $2",
    [documentId, userId]
  );
  return result.rows[0]?.role || null;
}

// GET /api/documents/:id
// Accessible à owner, editor et viewer.
router.get("/:id", async (req, res) => {
  const role = await getRole(req.params.id, req.user.id);
  if (!role) {
    return res.status(403).json({ status: "error", message: "Accès refusé à ce document" });
  }

  try {
    const result = await pool.query("SELECT id, title, etherpad_id, created_at, updated_at FROM document WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Document introuvable" });
    }
    res.json({ status: "ok", document: result.rows[0], role });
  } catch (err) {
    console.error("Erreur lecture document :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la récupération du document" });
  }
});

// PATCH /api/documents/:id
// Renommer un document : réservé à owner et editor, pas viewer.
router.patch("/:id", async (req, res) => {
  const role = await getRole(req.params.id, req.user.id);
  if (!role || role === "viewer") {
    return res.status(403).json({ status: "error", message: "Droit insuffisant pour modifier ce document" });
  }

  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ status: "error", message: "Le titre est requis" });
  }

  try {
    const result = await pool.query(
      "UPDATE document SET title = $1, updated_at = now() WHERE id = $2 RETURNING id, title, updated_at",
      [title, req.params.id]
    );
    res.json({ status: "ok", document: result.rows[0] });
  } catch (err) {
    console.error("Erreur renommage document :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la mise à jour du document" });
  }
});

// DELETE /api/documents/:id
// Suppression réservée au owner uniquement.
router.delete("/:id", async (req, res) => {
  const role = await getRole(req.params.id, req.user.id);
  if (role !== "owner") {
    return res.status(403).json({ status: "error", message: "Seul le propriétaire peut supprimer ce document" });
  }

  try {
    await pool.query("DELETE FROM document WHERE id = $1", [req.params.id]);
    res.json({ status: "ok", message: "Document supprimé" });
  } catch (err) {
    console.error("Erreur suppression document :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la suppression du document" });
  }
});

module.exports = router;
