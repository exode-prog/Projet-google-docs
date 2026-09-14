import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import "./CallPanel.css";

const PEER_HOST = import.meta.env.VITE_PEER_HOST || "localhost";
const PEER_PORT = import.meta.env.VITE_PEER_PORT || 9000;

// Appel audio/vidéo en mesh WebRTC : chaque participant se connecte directement
// à chaque autre (adapté au PoC déjà validé). Le peerId utilisé est l'id de
// connexion Socket.io (socket.id), unique à chaque session, ce qui évite les
// conflits d'identifiant rencontrés dans le PoC initial (plusieurs onglets ou
// plusieurs appareils avec le même utilisateur ne se marchent plus dessus).
export default function CallPanel({ documentId }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [inCall, setInCall] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [participants, setParticipants] = useState({}); // { peerId: { stream, userId, name, email } }
  const [error, setError] = useState("");

  const localVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const callsRef = useRef({}); // { peerId: MediaConnection }

  useEffect(() => {
    if (!socket) return;

    function onPeerJoined({ peerId, userId, name, email }) {
      if (!streamRef.current || !peerRef.current) return;
      const call = peerRef.current.call(peerId, streamRef.current);
      registerCall(peerId, call, userId, name, email);
    }

    function onPeerLeft({ userId }) {
      setParticipants((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          if (next[id].userId === userId) delete next[id];
        }
        return next;
      });
    }

    socket.on("call:peer_joined", onPeerJoined);
    socket.on("call:peer_left", onPeerLeft);
    return () => {
      socket.off("call:peer_joined", onPeerJoined);
      socket.off("call:peer_left", onPeerLeft);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  function registerCall(peerId, call, userId, name, email) {
    callsRef.current[peerId] = call;
    call.on("stream", (remoteStream) => {
      setParticipants((prev) => ({ ...prev, [peerId]: { stream: remoteStream, userId, name, email } }));
    });
    call.on("close", () => {
      setParticipants((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    });
  }

  async function joinCall() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      // Ne PAS tenter d'attacher le flux ici : à ce stade, inCall vaut encore
      // false, donc l'élément <video> de la preview locale n'existe pas
      // encore dans le DOM (voir le useEffect ci-dessous, qui s'en charge
      // une fois que l'élément apparaît réellement).

      const peer = new Peer(undefined, { host: PEER_HOST, port: PEER_PORT, path: "/peer", secure: true });
      peerRef.current = peer;

      peer.on("open", (peerId) => {
        socket.emit("call:announce", { documentId, peerId });
        setInCall(true);
      });

      peer.on("call", (call) => {
        call.answer(stream);
        registerCall(call.peer, call, null, null, "Participant");
      });

      peer.on("error", (err) => {
        console.error("Erreur PeerJS :", err);
        setError("Erreur de connexion à l'appel : " + err.type);
      });
    } catch (err) {
      setError("Impossible d'accéder à la caméra/au micro : " + err.message);
    }
  }

  function leaveCall() {
    Object.values(callsRef.current).forEach((call) => call.close());
    callsRef.current = {};
    peerRef.current?.destroy();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setParticipants({});
    setInCall(false);
  }

  function toggleVideo() {
    const next = !videoEnabled;
    streamRef.current?.getVideoTracks().forEach((track) => (track.enabled = next));
    setVideoEnabled(next);
  }

  function toggleAudio() {
    const next = !audioEnabled;
    streamRef.current?.getAudioTracks().forEach((track) => (track.enabled = next));
    setAudioEnabled(next);
  }

  useEffect(() => () => leaveCall(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Attache le flux local à l'élément <video> une fois qu'il existe vraiment
  // dans le DOM (c'est-à-dire une fois inCall passé à true). C'est le
  // correctif du bug : avant, on tentait l'attachement trop tôt, quand
  // l'élément n'était pas encore monté, et rien ne réessayait ensuite.
  useEffect(() => {
    if (inCall && localVideoRef.current && streamRef.current) {
      localVideoRef.current.srcObject = streamRef.current;
    }
  }, [inCall]);

  return (
    <div className="call-panel">
      {error && <div className="form-error">{error}</div>}

      {!inCall ? (
        <div className="call-start">
          <p>Personne d'autre n'est visible avant de rejoindre l'appel.</p>
          <button className="btn btn-primary" onClick={joinCall}>
            <Phone size={16} />
            Rejoindre l'appel
          </button>
        </div>
      ) : (
        <>
          <div className="call-grid">
            <div className="call-tile">
              <video ref={localVideoRef} autoPlay muted playsInline />
              <span className="call-tile-label">{user?.name || user?.email} (toi)</span>
            </div>
            {Object.entries(participants).map(([peerId, p]) => (
              <CallTile key={peerId} stream={p.stream} label={p.name || p.email} />
            ))}
          </div>

          <div className="call-controls">
            <button className="call-control-btn" onClick={toggleAudio} title={audioEnabled ? "Couper le micro" : "Activer le micro"}>
              {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <button className="call-control-btn" onClick={toggleVideo} title={videoEnabled ? "Couper la caméra" : "Activer la caméra"}>
              {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
            <button className="call-control-btn call-control-hangup" onClick={leaveCall} title="Quitter l'appel">
              <PhoneOff size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CallTile({ stream, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="call-tile">
      <video ref={ref} autoPlay playsInline />
      <span className="call-tile-label">{label}</span>
    </div>
  );
}
