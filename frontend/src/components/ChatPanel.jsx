import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { api } from "../api/client";
import "./ChatPanel.css";

export default function ChatPanel({ documentId }) {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    api
      .listMessages(documentId, token)
      .then((data) => setMessages(data.messages))
      .finally(() => setLoading(false));
  }, [documentId, token]);

  useEffect(() => {
    if (!socket) return;
    function onNewMessage(msg) {
      if (msg.document_id === documentId || !msg.document_id) {
        setMessages((prev) => [...prev, msg]);
      }
    }
    socket.on("new_message", onNewMessage);
    return () => socket.off("new_message", onNewMessage);
  }, [socket, documentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    if (!content.trim() || !socket) return;
    socket.emit("send_message", { documentId, content: content.trim() }, (res) => {
      if (res?.status === "error") console.error(res.message);
    });
    setContent("");
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {loading ? (
          <div className="centered-loader">Chargement…</div>
        ) : messages.length === 0 ? (
          <p className="chat-empty">Aucun message pour l'instant. Lance la discussion.</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.user_id === user.id ? "own" : ""}`}>
              <div className="chat-message-author">{msg.user_id === user.id ? "Toi" : msg.name || msg.email}</div>
              <div className="chat-message-bubble">{msg.content}</div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Écrire un message…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={!content.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
