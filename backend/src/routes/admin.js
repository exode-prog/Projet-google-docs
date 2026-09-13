const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const { requireAuth } = require("../middlewares/auth");
const { requireAdmin } = require("../middlewares/requireAdmin");

const router = express.Router();

router.use(requireAuth, requireAdmin);

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     tags: [Administration]
 *     summary: Vue d'ensemble globale de la plateforme
 *     responses:
 *       200: { description: "Nombre total d'utilisateurs, de documents, et stockage utilisé" }
 *       403: { description: Réservé aux administrateurs }
 */
router.get("/stats", async (req, res) => {
  try {
    const [users, documents, storage] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM utilisateur"),
      pool.query("SELECT COUNT(*) FROM document"),
      pool.query("SELECT COALESCE(SUM(size), 0) AS total FROM fichier"),
    ]);
    res.json({
      status: "ok",
      stats: {
        total_users: parseInt(users.rows[0].count, 10),
        total_documents: parseInt(documents.rows[0].count, 10),
        total_storage_bytes: parseInt(storage.rows[0].total, 10),
      },
    });
  } catch (err) {
    console.error("Erreur stats admin :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la récupération des statistiques" });
  }
});

/**
 * @openapi
 * /admin/users:
 *   post:
 *     tags: [Administration]
 *     summary: Créer un compte directement (le seul moyen de créer un compte admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string, nullable: true }
 *               isAdmin: { type: boolean, default: false }
 *     responses:
 *       201: { description: Compte créé }
 *       403: { description: Réservé aux administrateurs }
 *       409: { description: Email déjà utilisé }
 */
router.post("/users", async (req, res) => {
  const { email, password, name, isAdmin } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: "error", message: "Email et mot de passe requis" });
  }
  if (password.length < 8) {
    return res.status(400).json({ status: "error", message: "Le mot de passe doit faire au moins 8 caractères" });
  }

  try {
    const existing = await pool.query("SELECT id FROM utilisateur WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ status: "error", message: "Cet email est déjà utilisé" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO utilisateur (email, password_hash, name, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, is_admin, is_active, created_at`,
      [email, passwordHash, name || null, !!isAdmin]
    );

    res.status(201).json({ status: "ok", user: result.rows[0] });
  } catch (err) {
    console.error("Erreur création utilisateur (admin) :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la création du compte" });
  }
});

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Administration]
 *     summary: Lister tous les comptes (admins et utilisateurs), avec documents et stockage
 *     responses:
 *       200: { description: Liste complète des comptes }
 *       403: { description: Réservé aux administrateurs }
 */
router.get("/users", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.email, u.name, u.is_admin, u.is_active, u.created_at,
        COUNT(DISTINCT d.id) AS document_count,
        COALESCE(SUM(f.size), 0) AS storage_bytes
      FROM utilisateur u
      LEFT JOIN document d ON d.owner_id = u.id
      LEFT JOIN fichier f ON f.document_id = d.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    const users = result.rows.map((row) => ({
      ...row,
      document_count: parseInt(row.document_count, 10),
      storage_bytes: parseInt(row.storage_bytes, 10),
    }));

    res.json({ status: "ok", users });
  } catch (err) {
    console.error("Erreur liste utilisateurs (admin) :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la récupération des utilisateurs" });
  }
});

/**
 * @openapi
 * /admin/users/{id}:
 *   patch:
 *     tags: [Administration]
 *     summary: Modifier un compte (nom, email, statut admin, actif/désactivé)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, nullable: true }
 *               email: { type: string, format: email }
 *               isAdmin: { type: boolean }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Compte modifié }
 *       400: { description: "Aucune modification fournie, ou tentative sur son propre compte" }
 *       404: { description: Utilisateur introuvable }
 */
router.patch("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ status: "error", message: "Impossible de modifier son propre compte administrateur depuis cette page" });
  }

  const { name, email, isAdmin, isActive } = req.body;
  const fields = [];
  const values = [];
  let i = 1;

  if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name || null); }
  if (email !== undefined) { fields.push(`email = $${i++}`); values.push(email); }
  if (isAdmin !== undefined) { fields.push(`is_admin = $${i++}`); values.push(isAdmin); }
  if (isActive !== undefined) { fields.push(`is_active = $${i++}`); values.push(isActive); }

  if (fields.length === 0) {
    return res.status(400).json({ status: "error", message: "Aucune modification fournie" });
  }

  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE utilisateur SET ${fields.join(", ")} WHERE id = $${i} RETURNING id, email, name, is_admin, is_active`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Utilisateur introuvable" });
    }
    res.json({ status: "ok", user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ status: "error", message: "Cet email est déjà utilisé" });
    }
    console.error("Erreur modification utilisateur (admin) :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la modification du compte" });
  }
});

/**
 * @openapi
 * /admin/users/{id}:
 *   delete:
 *     tags: [Administration]
 *     summary: Supprimer un compte (ses documents sont supprimés avec lui)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Compte supprimé }
 *       400: { description: Impossible de supprimer son propre compte }
 *       404: { description: Utilisateur introuvable }
 */
router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ status: "error", message: "Impossible de supprimer son propre compte administrateur" });
  }

  try {
    const result = await pool.query("DELETE FROM utilisateur WHERE id = $1 RETURNING email", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Utilisateur introuvable" });
    }
    res.json({ status: "ok", message: `Compte ${result.rows[0].email} supprimé (avec ses documents)` });
  } catch (err) {
    console.error("Erreur suppression utilisateur (admin) :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la suppression du compte" });
  }
});

/**
 * @openapi
 * /admin/users/{id}/documents:
 *   get:
 *     tags: [Administration]
 *     summary: Documents dont cet utilisateur est propriétaire (lecture seule)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Liste des documents de cet utilisateur }
 */
router.get("/users/:id/documents", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.title, d.created_at, d.updated_at,
              COALESCE(SUM(f.size), 0) AS storage_bytes
       FROM document d
       LEFT JOIN fichier f ON f.document_id = d.id
       WHERE d.owner_id = $1
       GROUP BY d.id
       ORDER BY d.updated_at DESC`,
      [req.params.id]
    );

    const documents = result.rows.map((row) => ({ ...row, storage_bytes: parseInt(row.storage_bytes, 10) }));
    res.json({ status: "ok", documents });
  } catch (err) {
    console.error("Erreur documents utilisateur (admin) :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la récupération des documents" });
  }
});

module.exports = router;
