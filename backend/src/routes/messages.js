const express = require("express");
const pool = require("../config/db");
const { requireAuth } = require("../middlewares/auth");
const { getRole } = require("../utils/permissions");

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

/**
 * @openapi
 * /documents/{id}/messages:
 *   get:
 *     tags: [Messages]
 *     summary: Historique des messages du chat (le temps réel passe par Socket.io)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Liste des messages, du plus ancien au plus récent" }
 */
router.get("/", async (req, res) => {
  const documentId = req.params.id;
  const role = await getRole(documentId, req.user.id);
  if (!role) {
    return res.status(403).json({ status: "error", message: "Accès refusé à ce document" });
  }

  try {
    const result = await pool.query(
      `SELECT m.id, m.content, m.created_at, m.user_id, u.email
       FROM message m
       JOIN utilisateur u ON u.id = m.user_id
       WHERE m.document_id = $1
       ORDER BY m.created_at ASC`,
      [documentId]
    );
    res.json({ status: "ok", messages: result.rows });
  } catch (err) {
    console.error("Erreur historique messages :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la récupération des messages" });
  }
});

module.exports = router;
