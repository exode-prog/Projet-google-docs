const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Créer un compte
 *     security: []
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
 *               name: { type: string, nullable: true, description: "Optionnel, l'email sert d'affichage sinon" }
 *     responses:
 *       201: { description: Compte créé }
 *       400: { description: Champs manquants ou mot de passe trop court }
 *       409: { description: Email déjà utilisé }
 */
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;

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
      "INSERT INTO utilisateur (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at",
      [email, passwordHash, name || null]
    );

    res.status(201).json({ status: "ok", user: result.rows[0] });
  } catch (err) {
    console.error("Erreur register :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la création du compte" });
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Se connecter
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: "Connexion réussie, renvoie un token JWT" }
 *       401: { description: Identifiants invalides }
 *       403: { description: Compte désactivé }
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: "error", message: "Email et mot de passe requis" });
  }

  try {
    const result = await pool.query("SELECT id, email, name, is_admin, is_active, password_hash FROM utilisateur WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ status: "error", message: "Identifiants invalides" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ status: "error", message: "Identifiants invalides" });
    }

    if (!user.is_active) {
      return res.status(403).json({ status: "error", message: "Ce compte a été désactivé" });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name, isAdmin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ status: "ok", token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin } });
  } catch (err) {
    console.error("Erreur login :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la connexion" });
  }
});

module.exports = router;
