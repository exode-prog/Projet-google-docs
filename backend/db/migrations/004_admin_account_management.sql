-- Migration 004 : gestion des comptes par l'administrateur.
--
-- 1) is_active permet de désactiver un compte sans le supprimer (bloque la
--    connexion, sans toucher à ses documents).
--
-- 2) La suppression d'un compte NE DOIT PAS supprimer ses documents : on
--    remplace donc la contrainte ON DELETE CASCADE de document.owner_id par
--    ON DELETE SET NULL. Le document survit à la suppression de son
--    propriétaire ; il devient orphelin (owner_id = NULL) mais reste
--    consultable par les autres collaborateurs qui ont déjà un rôle dessus.

ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE document DROP CONSTRAINT IF EXISTS document_owner_id_fkey;
ALTER TABLE document
  ADD CONSTRAINT document_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES utilisateur(id) ON DELETE SET NULL;
