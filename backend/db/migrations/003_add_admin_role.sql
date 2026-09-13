-- Migration 003 : ajoute un indicateur d'administrateur sur les utilisateurs.
-- Un administrateur peut consulter la liste des utilisateurs, leurs documents
-- et l'espace de stockage utilisé, mais ne peut rien supprimer via cette
-- interface (lecture seule, par choix produit).

ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
