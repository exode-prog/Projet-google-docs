const express = require("express");
const pool = require("../config/db");
const { requireAuth } = require("../middlewares/auth");
const etherpad = require("../config/etherpad");
const { getRole } = require("../utils/permissions");

const router = express.Router();

// Toutes les routes documents nécessitent d'être authentifié.
router.use(requireAuth);

/**
 * @openapi
 * /documents:
 *   post:
 *     tags: [Documents]
 *     summary: Créer un document (crée aussi le pad Etherpad de groupe associé)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties: { title: { type: string } }
 *     responses:
 *       201: { description: Document créé }
 *       400: { description: Titre manquant }
 *       500: { description: "Échec de création du pad Etherpad (transaction annulée)" }
 */
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

    // Le pad est créé après la validation en base : si Etherpad est indisponible,
    // on préfère annuler la création plutôt que d'avoir un document sans éditeur.
    // On crée un PAD DE GROUPE (pas un pad simple) : c'est ce qui permettra
    // ensuite de n'autoriser l'accès qu'avec une session valide (voir GET /:id),
    // plutôt qu'un pad public accessible par quiconque connaît son URL.
    const groupID = await etherpad.createGroupIfNotExistsFor(document.id);
    const etherpadId = await etherpad.createGroupPad(groupID, "main");
    await client.query("UPDATE document SET etherpad_id = $1 WHERE id = $2", [etherpadId, document.id]);

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

/**
 * @openapi
 * /documents:
 *   get:
 *     tags: [Documents]
 *     summary: Lister les documents accessibles à l'utilisateur connecté
 *     responses:
 *       200: { description: "Liste des documents avec le rôle de l'utilisateur sur chacun" }
 */
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

/**
 * @openapi
 * /documents/{id}:
 *   get:
 *     tags: [Documents]
 *     summary: Consulter un document (renvoie pad_url et la session Etherpad)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Document, rôle, pad_url et session Etherpad" }
 *       403: { description: Accès refusé }
 *       404: { description: Document introuvable }
 */
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
    const document = result.rows[0];
    const publicUrl = process.env.ETHERPAD_PUBLIC_URL || "https://localhost:9002";

    let padUrl = null;
    let etherpadSessionId = null;
    const SESSION_DURATION_SECONDS = 24 * 60 * 60; // 24h, cohérent avec la durée du token JWT

    if (document.etherpad_id) {
      const [groupID, padName] = document.etherpad_id.split("$");

      const authorID = await etherpad.createAuthorIfNotExistsFor(req.user.id, req.user.name || req.user.email);
      const validUntil = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
      etherpadSessionId = await etherpad.createSession(groupID, authorID, validUntil);

      if (role === "viewer") {
        const readOnlyID = await etherpad.getReadOnlyID(document.etherpad_id);
        padUrl = `${publicUrl}/p/${readOnlyID}`;
      } else {
        padUrl = `${publicUrl}/p/${document.etherpad_id}`;
      }
    }

    res.json({
      status: "ok",
      document,
      role,
      pad_url: padUrl,
      etherpad_session_id: etherpadSessionId,
      etherpad_session_expires_in: SESSION_DURATION_SECONDS,
    });
  } catch (err) {
    console.error("Erreur lecture document :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la récupération du document" });
  }
});

/**
 * @openapi
 * /documents/{id}:
 *   patch:
 *     tags: [Documents]
 *     summary: Renommer un document (owner et editor uniquement)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [title], properties: { title: { type: string } } }
 *     responses:
 *       200: { description: Document renommé }
 *       403: { description: Droit insuffisant }
 */
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

/**
 * @openapi
 * /documents/{id}:
 *   delete:
 *     tags: [Documents]
 *     summary: Supprimer un document (owner uniquement)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Document supprimé }
 *       403: { description: Réservé au propriétaire }
 */
router.delete("/:id", async (req, res) => {
  const role = await getRole(req.params.id, req.user.id);
  if (role !== "owner") {
    return res.status(403).json({ status: "error", message: "Seul le propriétaire peut supprimer ce document" });
  }

  try {
    const docResult = await pool.query("SELECT etherpad_id FROM document WHERE id = $1", [req.params.id]);
    const etherpadId = docResult.rows[0]?.etherpad_id;

    if (etherpadId) {
      try {
        await etherpad.deletePad(etherpadId);
      } catch (padErr) {
        console.error("Avertissement : suppression du pad Etherpad échouée :", padErr.message);
      }
    }

    await pool.query("DELETE FROM document WHERE id = $1", [req.params.id]);
    res.json({ status: "ok", message: "Document supprimé" });
  } catch (err) {
    console.error("Erreur suppression document :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la suppression du document" });
  }
});

/**
 * @openapi
 * /documents/{id}/permissions:
 *   get:
 *     tags: [Droits]
 *     summary: Lister les collaborateurs d'un document et leur rôle
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Liste des collaborateurs }
 */
router.get("/:id/permissions", async (req, res) => {
  const role = await getRole(req.params.id, req.user.id);
  if (!role) {
    return res.status(403).json({ status: "error", message: "Accès refusé à ce document" });
  }

  try {
    const result = await pool.query(
      `SELECT u.email, u.name, p.role
       FROM permission p
       JOIN utilisateur u ON u.id = p.user_id
       WHERE p.document_id = $1
       ORDER BY CASE p.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.email`,
      [req.params.id]
    );
    res.json({ status: "ok", collaborators: result.rows });
  } catch (err) {
    console.error("Erreur liste des droits :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la récupération des droits" });
  }
});

/**
 * @openapi
 * /documents/{id}/invite:
 *   post:
 *     tags: [Droits]
 *     summary: Inviter quelqu'un par email (owner uniquement)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [editor, viewer] }
 *     responses:
 *       200: { description: Invitation effectuée }
 *       403: { description: Réservé au propriétaire }
 *       404: { description: Aucun compte avec cet email }
 */
router.post("/:id/invite", async (req, res) => {
  const role = await getRole(req.params.id, req.user.id);
  if (role !== "owner") {
    return res.status(403).json({ status: "error", message: "Seul le propriétaire peut inviter quelqu'un" });
  }

  const { email, role: invitedRole } = req.body;
  if (!email || !["editor", "viewer"].includes(invitedRole)) {
    return res.status(400).json({ status: "error", message: "Email et rôle (editor ou viewer) requis" });
  }

  try {
    const userResult = await pool.query("SELECT id, email FROM utilisateur WHERE email = $1", [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Aucun compte n'existe avec cet email. La personne doit d'abord créer un compte.",
      });
    }
    const invitedUser = userResult.rows[0];

    if (invitedUser.id === req.user.id) {
      return res.status(400).json({ status: "error", message: "Vous êtes déjà propriétaire de ce document" });
    }

    await pool.query(
      `INSERT INTO permission (document_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, invitedUser.id, invitedRole]
    );

    res.json({ status: "ok", invited: { email: invitedUser.email, role: invitedRole } });
  } catch (err) {
    console.error("Erreur invitation :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de l'invitation" });
  }
});

module.exports = router;
