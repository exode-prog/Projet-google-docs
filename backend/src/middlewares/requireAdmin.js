// Réservé aux routes d'administration. À utiliser après requireAuth,
// puisqu'il dépend de req.user déjà renseigné.
function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ status: "error", message: "Réservé aux administrateurs" });
  }
  next();
}

module.exports = { requireAdmin };
