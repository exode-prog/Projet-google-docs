import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import Navbar from "../components/Navbar";
import "./Dashboard.css";

const ROLE_LABELS = {
  owner: "Propriétaire",
  editor: "Éditeur",
  viewer: "Lecteur",
};

export default function Dashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const data = await api.listDocuments(token);
      setDocuments(data.documents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { document } = await api.createDocument(newTitle.trim(), token);
      setNewTitle("");
      navigate(`/documents/${document.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm("Supprimer définitivement ce document ?")) return;
    try {
      await api.deleteDocument(id, token);
      setDocuments((docs) => docs.filter((d) => d.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <Navbar />
      <main className="dashboard">
        <div className="dashboard-header">
          <h1>Mes documents</h1>
        </div>

        <form className="dashboard-create card" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Titre du nouveau document"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={creating || !newTitle.trim()}>
            <Plus size={16} />
            Créer
          </button>
        </form>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <div className="centered-loader">Chargement des documents…</div>
        ) : documents.length === 0 ? (
          <div className="dashboard-empty card">
            <FileText size={32} strokeWidth={1.5} />
            <p>Aucun document pour le moment. Crée le premier ci-dessus.</p>
          </div>
        ) : (
          <ul className="document-list">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="document-item card"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                <FileText size={20} className="document-icon" />
                <div className="document-info">
                  <span className="document-title">{doc.title}</span>
                  <span className="document-meta">
                    {ROLE_LABELS[doc.role] || doc.role} · modifié le{" "}
                    {new Date(doc.updated_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                {doc.role === "owner" && (
                  <button
                    className="btn btn-danger document-delete"
                    onClick={(e) => handleDelete(doc.id, e)}
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
