const jwt = require("jsonwebtoken");

// Vérifie la présence et la validité du token JWT envoyé dans l'en-tête Authorization.
// Format attendu : "Authorization: Bearer <token>"
// En cas de succès, req.user contient { id, email } pour les routes suivantes.
function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "Authentification requise" });
  }

  const token = header.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ status: "error", message: "Token invalide ou expiré" });
  }
}

module.exports = { requireAuth };
