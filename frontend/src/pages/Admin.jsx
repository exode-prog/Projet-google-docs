import { useEffect, useState } from "react";
import { Users, FileText, HardDrive, ChevronDown, ChevronRight, ShieldCheck, Pencil, Ban, CheckCircle2, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import Navbar from "../components/Navbar";
import "./Admin.css";

function formatSize(bytes) {
  if (!bytes) return "0 o";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function Admin() {
  const { token, user: currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("admins"); // "admins" | "users"
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [userDocuments, setUserDocuments] = useState({});
  const [editingUserId, setEditingUserId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: "", password: "", name: "" });
  const [creating, setCreating] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [statsData, usersData] = await Promise.all([api.adminStats(token), api.adminListUsers(token)]);
      setStats(statsData.stats);
      setUsers(usersData.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function toggleUser(userId) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    if (!userDocuments[userId]) {
      try {
        const data = await api.adminUserDocuments(userId, token);
        setUserDocuments((prev) => ({ ...prev, [userId]: data.documents }));
      } catch (err) {
        setError(err.message);
      }
    }
  }

  function startEdit(u, e) {
    e.stopPropagation();
    setEditingUserId(u.id);
    setEditName(u.name || "");
    setEditEmail(u.email);
  }

  async function saveEdit(userId, e) {
    e.stopPropagation();
    setError("");
    try {
      await api.adminUpdateUser(userId, { name: editName || null, email: editEmail }, token);
      setEditingUserId(null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(u, e) {
    e.stopPropagation();
    setError("");
    try {
      await api.adminUpdateUser(u.id, { isActive: !u.is_active }, token);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteUser(u, e) {
    e.stopPropagation();
    const kind = u.is_admin ? "administrateur" : "utilisateur";
    if (!window.confirm(`Supprimer définitivement ce compte ${kind} (${u.name || u.email}) ? Ses documents seront supprimés avec.`)) return;
    setError("");
    try {
      await api.adminDeleteUser(u.id, token);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateAdmin(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      // isAdmin toujours vrai ici : c'est la seule création manuelle exposée,
      // puisqu'un utilisateur normal crée déjà son propre compte via /inscription.
      await api.adminCreateUser({ ...newAdmin, isAdmin: true }, token);
      setNewAdmin({ email: "", password: "", name: "" });
      setShowCreateForm(false);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const admins = users.filter((u) => u.is_admin);
  const regularUsers = users.filter((u) => !u.is_admin);
  const visibleUsers = tab === "admins" ? admins : regularUsers;

  function renderUserRow(u) {
    const isSelf = u.id === currentUser.id;
    const isEditing = editingUserId === u.id;
    const showDocColumns = tab === "users";
    return (
      <div key={u.id} className="admin-user-row-wrapper">
        <div
          className={`admin-user-row ${showDocColumns ? "with-docs" : ""} ${!isEditing ? "clickable" : ""}`}
          onClick={() => showDocColumns && !isEditing && toggleUser(u.id)}
        >
          {isEditing ? (
            <span className="admin-edit-form" onClick={(e) => e.stopPropagation()}>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom" />
              <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" />
            </span>
          ) : (
            <span className="admin-user-identity">
              {u.is_admin && <ShieldCheck size={14} className="admin-badge" title="Administrateur" />}
              {!u.is_active && <span className="admin-inactive-tag">Désactivé</span>}
              <span className="admin-user-name">{u.name || u.email}</span>
              {u.name && <span className="admin-user-email">{u.email}</span>}
            </span>
          )}
          {showDocColumns && (
            <>
              <span data-label="Documents">{u.document_count}</span>
              <span data-label="Stockage">{formatSize(u.storage_bytes)}</span>
            </>
          )}
          <span className="admin-actions">
            {isEditing ? (
              <button className="icon-btn" onClick={(e) => saveEdit(u.id, e)} title="Enregistrer">
                <CheckCircle2 size={16} />
              </button>
            ) : isSelf ? (
              <span className="admin-self-tag">C'est toi</span>
            ) : (
              <>
                <button className="icon-btn" onClick={(e) => startEdit(u, e)} title="Modifier">
                  <Pencil size={15} />
                </button>
                <button className="icon-btn" onClick={(e) => toggleActive(u, e)} title={u.is_active ? "Désactiver" : "Activer"}>
                  {u.is_active ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                </button>
                <button className="icon-btn icon-btn-danger" onClick={(e) => deleteUser(u, e)} title="Supprimer le compte">
                  <Trash2 size={15} />
                </button>
                {showDocColumns && (
                  <span className="admin-expand-icon">
                    {expandedUserId === u.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                )}
              </>
            )}
          </span>
        </div>

        {showDocColumns && expandedUserId === u.id && !isEditing && (
          <div className="admin-user-documents">
            {!userDocuments[u.id] ? (
              <p className="admin-empty">Chargement…</p>
            ) : userDocuments[u.id].length === 0 ? (
              <p className="admin-empty">Aucun document créé par cet utilisateur.</p>
            ) : (
              <ul>
                {userDocuments[u.id].map((doc) => (
                  <li key={doc.id}>
                    <span>{doc.title}</span>
                    <span className="admin-doc-meta">{formatSize(doc.storage_bytes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar />
      <main className="admin">
        <div className="admin-header">
          <h1>Administration</h1>
        </div>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <div className="centered-loader">Chargement…</div>
        ) : (
          <>
            <div className="admin-stats">
              <div className="admin-stat-card card">
                <Users size={20} />
                <div>
                  <span className="admin-stat-value">{stats.total_users}</span>
                  <span className="admin-stat-label">Comptes au total</span>
                </div>
              </div>
              <div className="admin-stat-card card">
                <FileText size={20} />
                <div>
                  <span className="admin-stat-value">{stats.total_documents}</span>
                  <span className="admin-stat-label">Documents</span>
                </div>
              </div>
              <div className="admin-stat-card card">
                <HardDrive size={20} />
                <div>
                  <span className="admin-stat-value">{formatSize(stats.total_storage_bytes)}</span>
                  <span className="admin-stat-label">Stockage utilisé</span>
                </div>
              </div>
            </div>

            <div className="admin-tabs-bar">
              <div className="admin-tabs-group">
                <button className={`admin-tab-btn ${tab === "admins" ? "active" : ""}`} onClick={() => setTab("admins")}>
                  Administrateurs ({admins.length})
                </button>
                <button className={`admin-tab-btn ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
                  Utilisateurs ({regularUsers.length})
                </button>
              </div>
              {tab === "admins" && (
                <button className="btn btn-primary" onClick={() => setShowCreateForm((v) => !v)}>
                  <UserPlus size={16} />
                  Nouvel administrateur
                </button>
              )}
            </div>

            {tab === "admins" && showCreateForm && (
              <form className="admin-create-form card" onSubmit={handleCreateAdmin}>
                <div className="admin-create-row">
                  <input
                    type="text"
                    placeholder="Nom (optionnel)"
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin((u) => ({ ...u, name: e.target.value }))}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    required
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin((u) => ({ ...u, email: e.target.value }))}
                  />
                  <input
                    type="password"
                    placeholder="Mot de passe (8 caractères min.)"
                    required
                    minLength={8}
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin((u) => ({ ...u, password: e.target.value }))}
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={creating}>
                  {creating ? "Création…" : "Créer l'administrateur"}
                </button>
              </form>
            )}

            <div className="admin-users card">
              <div className={`admin-users-header ${tab === "users" ? "with-docs" : ""}`}>
                <span>{tab === "admins" ? "Administrateur" : "Utilisateur"}</span>
                {tab === "users" && (
                  <>
                    <span>Documents</span>
                    <span>Stockage</span>
                  </>
                )}
                <span>Actions</span>
              </div>
              {visibleUsers.length === 0 ? (
                <p className="admin-empty" style={{ padding: "16px" }}>
                  {tab === "admins" ? "Aucun autre administrateur pour l'instant." : "Aucun utilisateur pour l'instant."}
                </p>
              ) : (
                visibleUsers.map(renderUserRow)
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
