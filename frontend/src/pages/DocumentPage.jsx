import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Paperclip, Phone, Share2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { api } from "../api/client";
import ChatPanel from "../components/ChatPanel";
import FilesPanel from "../components/FilesPanel";
import CallPanel from "../components/CallPanel";
import SharePanel from "../components/SharePanel";
import "./DocumentPage.css";

const TABS = [
  { key: "chat", label: "Discussion", icon: MessageSquare },
  { key: "files", label: "Fichiers", icon: Paperclip },
  { key: "call", label: "Appel", icon: Phone },
  { key: "share", label: "Partage", icon: Share2 },
];

export default function DocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { socket, connected } = useSocket();

  const [document, setDocument] = useState(null);
  const [role, setRole] = useState(null);
  const [padUrl, setPadUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("chat");

  useEffect(() => {
    let cancelled = false;
    api
      .getDocument(id, token)
      .then((data) => {
        if (cancelled) return;
        setDocument(data.document);
        setRole(data.role);

        // Le pad Etherpad est un "group pad" protégé par session : sans ce
        // cookie posé AVANT le chargement de l'iframe, Etherpad refuse l'accès
        // (voir backend/src/routes/documents.js). Le cookie est scopé par nom
        // d'hôte, pas par port : il s'applique donc aussi au proxy Etherpad
        // (port 9002) tant que les deux sont sur la même adresse.
        if (data.etherpad_session_id) {
          window.document.cookie = `sessionID=${data.etherpad_session_id}; path=/; max-age=${data.etherpad_session_expires_in}`;
        }
        setPadUrl(data.pad_url);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit("join_document", id, (res) => {
      if (res?.status === "error") setError(res.message);
    });
  }, [socket, connected, id]);

  if (loading) {
    return <div className="centered-loader">Chargement du document…</div>;
  }

  if (error && !document) {
    return (
      <div className="document-page-error">
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate("/")}>
          Retour aux documents
        </button>
      </div>
    );
  }

  return (
    <div className="document-page">
      <header className="document-topbar">
        <button className="icon-btn" onClick={() => navigate("/")} title="Retour">
          <ArrowLeft size={18} />
        </button>
        <span className="document-topbar-title">{document.title}</span>
      </header>

      <div className="document-body">
        <div className="document-editor">
          {padUrl ? (
            <iframe src={padUrl} title="Éditeur de document" className="document-iframe" />
          ) : (
            <div className="centered-loader">L'éditeur n'est pas encore disponible pour ce document.</div>
          )}
        </div>

        <aside className="document-sidebar card">
          <div className="document-tabs">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={`document-tab ${activeTab === key ? "active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <div className="document-tab-content">
            {activeTab === "chat" && <ChatPanel documentId={id} />}
            {activeTab === "files" && <FilesPanel documentId={id} role={role} />}
            {activeTab === "call" && <CallPanel documentId={id} />}
            {activeTab === "share" && <SharePanel documentId={id} role={role} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
