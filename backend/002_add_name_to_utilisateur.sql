-- Migration 002 : ajout d'un nom d'affichage optionnel pour les utilisateurs.
-- Nullable : les comptes existants n'en ont pas, on retombe alors sur l'email
-- partout dans l'application (chat, appel, liste des collaborateurs...).

ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS name VARCHAR(255);
