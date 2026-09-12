const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

// POST /api/auth/register
// Crée un compte utilisateur. Le mot de passe n'est jamais stocké en clair :
// il est haché avec bcrypt avant l'insertion en base (colonne password_hash).
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

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
      "INSERT INTO utilisateur (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
      [email, passwordHash]
    );

    res.status(201).json({ status: "ok", user: result.rows[0] });
  } catch (err) {
    console.error("Erreur register :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la création du compte" });
  }
});

// POST /api/auth/login
// Vérifie les identifiants et renvoie un token JWT valable 24h.
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: "error", message: "Email et mot de passe requis" });
  }

  try {
    const result = await pool.query("SELECT id, email, password_hash FROM utilisateur WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ status: "error", message: "Identifiants invalides" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ status: "error", message: "Identifiants invalides" });
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "24h" });

    res.json({ status: "ok", token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Erreur login :", err.message);
    res.status(500).json({ status: "error", message: "Erreur lors de la connexion" });
  }
});

module.exports = router;
