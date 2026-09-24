import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "../../../FdoDashboard.css";

interface PassengerChatProps {
  passengerId: string;
  passengerProfileDetails: any;
}

export function PassengerChat({ passengerId, passengerProfileDetails }: PassengerChatProps) {
  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChatHistory = useCallback(async () => {
    if (!passengerId) return;
    try {
      const msgs = await invoke<any[]>("get_chat_history", { passengerId });
      setChatMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      await invoke("mark_fdo_messages_read", { passengerId });
    } catch (_) {
      void 0;
    }
  }, [passengerId]);

  useEffect(() => {
    loadChatHistory();
    chatPollRef.current = setInterval(loadChatHistory, 3000);
    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, [loadChatHistory]);

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || chatSending) return;
    setChatSending(true);
    setErrorMsg("");
    try {
      await invoke("send_chat_message", {
        payload: {
          passenger_id: passengerId,
          sender_id: loggedInUser.user_id || passengerId,
          sender_role: "Passenger",
          message_body: chatInput.trim()
        }
      });
      setChatInput("");
      loadChatHistory();
    } catch (e) {
      setErrorMsg("Failed to send message: " + String(e));
    } finally {
      setChatSending(false);
    }
  };

  const formatChatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="ps-booking-card">
      <h3 className="ps-chat-header-title">
        <i className="fa-solid fa-comments" />
        Live Chat Support
        {passengerProfileDetails?.status?.toLowerCase() === "vip" && (
          <span className="fdo-badge fdo-badge-vip ps-chat-badge-vip">
            <i className="fa-solid fa-star ps-chat-star-icon" />VIP
          </span>
        )}
      </h3>
      <p className="ps-card-subtitle">Chat with our Front Desk Officer. We are here to assist you 24/7.</p>

      {errorMsg && (
        <div className="ps-chat-error">{errorMsg}</div>
      )}

      <div className="ps-chat-messages-container">
        {chatMessages.length === 0 ? (
          <div className="ps-chat-empty-message">
            <i className="fa-solid fa-comments ps-chat-empty-icon" />
            No messages yet. Say hello to the Front Desk!
          </div>
        ) : (
          chatMessages.map(msg => {
            const isMe = msg.sender_role === "Passenger";
            return (
              <div key={msg.message_id} className={`ps-chat-bubble-wrap ${isMe ? "is-me" : "is-other"}`}>
                <div className={`ps-chat-bubble ${isMe ? "is-me" : "is-other"}`}>
                  {msg.message_body}
                </div>
                <div className="ps-chat-bubble-meta">
                  {msg.sender_name} · {formatChatDate(msg.created_at)}
                  {isMe && (
                    <span className={`ps-chat-read-tick ${msg.is_read ? "read" : "sent"}`}>
                      {msg.is_read ? (
                        <><i className="fa-solid fa-check-double" /> Read</>
                      ) : (
                        <><i className="fa-solid fa-check" /> Sent</>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="ps-chat-input-row">
        <textarea
          className="ps-chat-input"
          placeholder="Type a message..."
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendChatMessage();
            }
          }}
          rows={1}
        />
        <button
          className="ps-chat-send-btn"
          onClick={handleSendChatMessage}
          disabled={chatSending || !chatInput.trim()}
        >
          <i className="fa-solid fa-paper-plane" />
        </button>
      </div>
    </div>
  );
}
