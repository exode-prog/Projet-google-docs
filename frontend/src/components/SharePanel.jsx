import { useEffect, useState } from "react";
import { UserPlus, Crown, Pencil, Eye } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import "./SharePanel.css";

const ROLE_META = {
  owner: { label: "Propriétaire", icon: Crown },
  editor: { label: "Éditeur", icon: Pencil },
  viewer: { label: "Lecteur", icon: Eye },
};

export default function SharePanel({ documentId, role }) {
  const { token } = useAuth();
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isOwner = role === "owner";

  async function loadCollaborators() {
    setLoading(true);
    try {
      const data = await api.listPermissions(documentId, token);
      setCollaborators(data.collaborators);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCollaborators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function handleInvite(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError("");
    setSuccess("");
    try {
      await api.inviteToDocument(documentId, email.trim(), inviteRole, token);
      setSuccess(`${email.trim()} a maintenant accès à ce document.`);
      setEmail("");
      await loadCollaborators();
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="share-panel">
      {isOwner && (
        <form className="share-invite" onSubmit={handleInvite}>
          <p className="share-invite-label">Inviter quelqu'un par email</p>
          <div className="share-invite-row">
            <input
              type="email"
              placeholder="adresse@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="editor">Éditeur</option>
              <option value="viewer">Lecteur</option>
            </select>
          </div>
          <button className="btn btn-primary share-invite-btn" type="submit" disabled={inviting || !email.trim()}>
            <UserPlus size={16} />
            {inviting ? "Envoi…" : "Inviter"}
          </button>
          <p className="share-invite-hint">
            La personne doit déjà avoir un compte sur la plateforme avec cet email.
          </p>
        </form>
      )}

      {error && <div className="form-error">{error}</div>}
      {success && <div className="share-success">{success}</div>}

      <p className="share-section-title">Personnes ayant accès</p>
      {loading ? (
        <div className="centered-loader">Chargement…</div>
      ) : (
        <ul className="share-list">
          {collaborators.map((c) => {
            const meta = ROLE_META[c.role] || { label: c.role, icon: Eye };
            const Icon = meta.icon;
            return (
              <li key={c.email} className="share-item">
                <span className="share-item-email">{c.name || c.email}</span>
                <span className="share-item-role">
                  <Icon size={13} />
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
