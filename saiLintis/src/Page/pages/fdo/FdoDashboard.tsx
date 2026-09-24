import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import "../../../FdoDashboard.css";

interface FdoPassenger {
  passenger_id: string;
  display_name: string;
  email: string;
  status: string;
  checkin_status: string;
  cabin_number: string | null;
  is_vip: boolean;
}

interface CabinData {
  cabin_number: string;
  category: string;
  status: string;
  assigned_passenger_id: string | null;
  assigned_passenger_name: string | null;
}

interface Complaint {
  incident_id: string;
  passenger_name: string | null;
  subject: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
}

interface ChatQueueEntry {
  passenger_id: string;
  display_name: string;
  is_vip: boolean;
  vip_contact_channel: string | null;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

interface ChatMessage {
  message_id: string;
  passenger_id: string;
  sender_role: string;
  sender_name: string;
  message_body: string;
  created_at: string;
  is_read: boolean;
}

export function FdoDashboard() {
  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");
  const [activeTab, setActiveTab] = useState("passengers");
  const [activeItem, setActiveItem] = useState("Front Desk Console");
  const [activeSection, setActiveSection] = useState("Overview");

  const [passengers, setPassengers] = useState<FdoPassenger[]>([]);
  const [cabins, setCabins] = useState<CabinData[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [chatQueues, setChatQueues] = useState<ChatQueueEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedChatPassenger, setSelectedChatPassenger] = useState<ChatQueueEntry | null>(null);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  const [cabinAssignMap, setCabinAssignMap] = useState<Record<string, string>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadPassengers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<FdoPassenger[]>("fdo_get_passengers");
      setPassengers(data);
    } catch (e) {
      showToast("error", String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCabins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<CabinData[]>("fdo_get_cabins");
      setCabins(data);
    } catch (e) {
      showToast("error", String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<Complaint[]>("fdo_get_complaints");
      setComplaints(data);
    } catch (e) {
      showToast("error", String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChatQueues = useCallback(async () => {
    try {
      const data = await invoke<ChatQueueEntry[]>("fdo_get_chat_queues");
      setChatQueues(data);
    } catch (_) {
      void 0;
    }
  }, []);

  const loadChatHistory = useCallback(async (passengerId: string) => {
    try {
      const msgs = await invoke<ChatMessage[]>("get_chat_history", { passengerId });
      setChatMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (_) {
      void 0;
    }
  }, []);

  useEffect(() => {
    if (activeTab === "passengers") loadPassengers();
    if (activeTab === "cabins") { loadCabins(); loadPassengers(); }
    if (activeTab === "complaints") loadComplaints();
    if (activeTab === "chat") loadChatQueues();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "chat" && selectedChatPassenger) {
      loadChatHistory(selectedChatPassenger.passenger_id);
      chatPollRef.current = setInterval(() => {
        loadChatHistory(selectedChatPassenger.passenger_id);
        loadChatQueues();
      }, 3000);
    }
    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, [selectedChatPassenger, activeTab]);

  const handleCheckin = async (passengerId: string) => {
    try {
      const msg = await invoke<string>("fdo_check_in_passenger", { passengerId });
      showToast("success", msg);
      loadPassengers();
    } catch (e) {
      showToast("error", String(e));
    }
  };

  const handleCheckout = async (passengerId: string) => {
    try {
      const msg = await invoke<string>("fdo_check_out_passenger", { passengerId });
      showToast("success", msg);
      loadPassengers();
    } catch (e) {
      showToast("error", String(e));
    }
  };

  const handleStatusUpdate = async (passengerId: string, newStatus: string) => {
    try {
      const msg = await invoke<string>("fdo_update_onboard_status", {
        payload: { passenger_id: passengerId, new_status: newStatus }
      });
      showToast("success", msg);
      loadPassengers();
    } catch (e) {
      showToast("error", String(e));
    }
  };

  const handleAssignCabin = async (cabinNumber: string) => {
    const passengerId = cabinAssignMap[cabinNumber];
    if (!passengerId) {
      showToast("error", "Please select a passenger first.");
      return;
    }
    try {
      const msg = await invoke<string>("fdo_assign_cabin", {
        payload: { cabin_number: cabinNumber, passenger_id: passengerId }
      });
      showToast("success", msg);
      loadCabins();
      setCabinAssignMap(prev => ({ ...prev, [cabinNumber]: "" }));
    } catch (e) {
      showToast("error", String(e));
    }
  };

  const handleResolveComplaint = async (incidentId: string) => {
    try {
      const msg = await invoke<string>("fdo_resolve_complaint", {
        payload: { incident_id: incidentId, resolved_by: loggedInUser.user_id }
      });
      showToast("success", msg);
      loadComplaints();
    } catch (e) {
      showToast("error", String(e));
    }
  };

  const handleSelectChatPassenger = (entry: ChatQueueEntry) => {
    setSelectedChatPassenger(entry);
    setChatMessages([]);
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    loadChatHistory(entry.passenger_id);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedChatPassenger) return;
    setSending(true);
    try {
      await invoke<string>("send_chat_message", {
        payload: {
          passenger_id: selectedChatPassenger.passenger_id,
          sender_id: loggedInUser.user_id,
          sender_role: "Front Desk Officer",
          message_body: chatInput.trim()
        }
      });
      setChatInput("");
      loadChatHistory(selectedChatPassenger.passenger_id);
    } catch (e) {
      showToast("error", String(e));
    } finally {
      setSending(false);
    }
  };

  const filteredPassengers = passengers.filter(p =>
    p.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) =>
    name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  const tabs = [
    { key: "passengers", label: "Passenger Status", icon: "fa-users" },
    { key: "cabins", label: "Cabin Assignment", icon: "fa-bed" },
    { key: "complaints", label: "Guest Complaints", icon: "fa-triangle-exclamation" },
    { key: "chat", label: "Live Chat Support", icon: "fa-message" },
  ];

  return (
    <Dashboard
      activeItem={activeItem}
      activeSection={activeSection}
      setActiveItem={setActiveItem}
      setActiveSection={setActiveSection}
    >
      <div className="fdo-root">
        <div className="fdo-hero">
          <h1 className="fdo-hero-title">Front Desk Console</h1>
          <p className="fdo-hero-sub">Manage check-ins, cabin assignments, guest complaints, and live support chat.</p>
        </div>

        <div className="fdo-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`fdo-tab-btn ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <i className={`fa-solid ${tab.icon} fdo-tab-icon`} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="fdo-content">
          {activeTab === "passengers" && (
            <div>
              <div className="fdo-filter-row">
                <input
                  className="fdo-search-input"
                  placeholder="Search passenger..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <span className="fdo-filter-count">
                  {filteredPassengers.length} guest{filteredPassengers.length !== 1 ? "s" : ""}
                </span>
              </div>

              {loading ? (
                <div className="fdo-loading"><i className="fa-solid fa-spinner" />Loading passengers...</div>
              ) : filteredPassengers.length === 0 ? (
                <div className="fdo-no-data">
                  <i className="fa-solid fa-users" />
                  No passengers found.
                </div>
              ) : (
                <div className="fdo-table-wrap">
                  <table className="fdo-table">
                    <thead>
                      <tr>
                        <th>Guest</th>
                        <th>Status</th>
                        <th>Check-in</th>
                        <th>Cabin</th>
                        <th>Onboard Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPassengers.map(p => (
                        <tr key={p.passenger_id}>
                          <td>
                            <div className="fdo-guest-cell">
                              <div className={`fdo-avatar ${p.is_vip ? "fdo-avatar-vip" : "fdo-avatar-normal"}`}>
                                {getInitials(p.display_name)}
                              </div>
                              <div>
                                <div className="fdo-guest-name">{p.display_name}</div>
                                <div className="fdo-guest-email">{p.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {p.is_vip ? (
                              <span className="fdo-badge fdo-badge-vip">
                                <i className="fa-solid fa-star fdo-star-icon" />VIP
                              </span>
                            ) : (
                              <span className="fdo-badge fdo-badge-normal">Normal</span>
                            )}
                          </td>
                          <td>
                            <span className={`fdo-badge ${
                              p.checkin_status === "Checked In" ? "fdo-badge-checkedin" :
                              p.checkin_status === "Checked Out" ? "fdo-badge-checkedout" :
                              "fdo-badge-normal"
                            }`}>
                              {p.checkin_status}
                            </span>
                          </td>
                          <td className={`fdo-cabin-cell ${p.cabin_number ? "" : "unassigned"}`}>
                            {p.cabin_number || "—"}
                          </td>
                          <td>
                            <select
                              className="fdo-select"
                              value={p.status}
                              onChange={e => handleStatusUpdate(p.passenger_id, e.target.value)}
                            >
                              <option value="Normal">Normal</option>
                              <option value="VIP">VIP</option>
                              <option value="Onboard">Onboard</option>
                              <option value="Disembarked">Disembarked</option>
                            </select>
                          </td>
                          <td>
                            <div className="fdo-btn-row">
                              {p.checkin_status !== "Checked In" && (
                                <button
                                  className="fdo-btn fdo-btn-success fdo-btn-sm"
                                  onClick={() => handleCheckin(p.passenger_id)}
                                >
                                  Check In
                                </button>
                              )}
                              {p.checkin_status === "Checked In" && (
                                <button
                                  className="fdo-btn fdo-btn-danger fdo-btn-sm"
                                  onClick={() => handleCheckout(p.passenger_id)}
                                >
                                  Check Out
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "cabins" && (
            <div>
              <p className="fdo-section-title">{cabins.length} cabins total — assign or reassign guests below.</p>
              {loading ? (
                <div className="fdo-loading"><i className="fa-solid fa-spinner" />Loading cabins...</div>
              ) : (
                <div className="fdo-cabin-grid">
                  {cabins.map(cabin => (
                    <div key={cabin.cabin_number} className="fdo-cabin-card">
                      <p className="fdo-cabin-num">{cabin.cabin_number}</p>
                      <p className="fdo-cabin-cat">{cabin.category}</p>
                      <div className="fdo-cabin-status-wrapper">
                        <span className={`fdo-badge ${cabin.status === "Occupied" ? "fdo-badge-occupied" : "fdo-badge-available"}`}>
                          {cabin.status}
                        </span>
                      </div>
                      <p className="fdo-cabin-occupant">
                        {cabin.assigned_passenger_name ? (
                          <><i className="fa-solid fa-user fdo-occupant-icon" />{cabin.assigned_passenger_name}</>
                        ) : <span className="fdo-unoccupied-text">Unoccupied</span>}
                      </p>
                      <div className="fdo-assign-row">
                        <select
                          className="fdo-select"
                          value={cabinAssignMap[cabin.cabin_number] || ""}
                          onChange={e => setCabinAssignMap(prev => ({ ...prev, [cabin.cabin_number]: e.target.value }))}
                        >
                          <option value="">— Assign Guest —</option>
                          {passengers.map(p => (
                            <option key={p.passenger_id} value={p.passenger_id}>
                              {p.display_name}{p.is_vip ? " ★" : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          className="fdo-btn fdo-btn-primary fdo-btn-sm"
                          onClick={() => handleAssignCabin(cabin.cabin_number)}
                          disabled={!cabinAssignMap[cabin.cabin_number]}
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "complaints" && (
            <div>
              {loading ? (
                <div className="fdo-loading"><i className="fa-solid fa-spinner" />Loading complaints...</div>
              ) : complaints.length === 0 ? (
                <div className="fdo-no-data">
                  <i className="fa-solid fa-face-smile" />
                  No guest complaints. All clear!
                </div>
              ) : (
                complaints.map(c => (
                  <div key={c.incident_id} className="fdo-complaint-card">
                    <div className="fdo-complaint-top">
                      <div>
                        <div className="fdo-complaint-meta">
                          <span className="fdo-complaint-who">
                            {c.passenger_name || "Guest"}
                          </span>
                          <span className={`fdo-badge fdo-badge-${c.severity.toLowerCase() === "high" ? "occupied" : c.severity.toLowerCase() === "medium" ? "pending" : "normal"}`}>
                            {c.severity}
                          </span>
                          <span className={`fdo-badge ${c.status === "Resolved" ? "fdo-badge-resolved" : "fdo-badge-pending"}`}>
                            {c.status}
                          </span>
                        </div>
                        <p className="fdo-complaint-desc">{c.description}</p>
                        <p className="fdo-complaint-date">
                          <i className="fa-regular fa-clock fdo-clock-icon" />
                          {formatDate(c.created_at)}
                        </p>
                      </div>
                      {c.status !== "Resolved" && (
                        <button
                          className="fdo-btn fdo-btn-success"
                          onClick={() => handleResolveComplaint(c.incident_id)}
                        >
                          <i className="fa-solid fa-check fdo-check-icon" />
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="fdo-chat-layout">
              <div className="fdo-chat-sidebar">
                <div className="fdo-chat-sidebar-header">
                  <i className="fa-solid fa-inbox" style={{ marginRight: "0.4rem" }} />
                  Guest Messages
                </div>
                {chatQueues.length === 0 ? (
                  <div className="fdo-no-data fdo-chat-no-data">
                    <i className="fa-solid fa-message" />
                    No active chats
                  </div>
                ) : (
                  chatQueues.map(entry => (
                    <div
                      key={entry.passenger_id}
                      className={`fdo-chat-queue-item ${selectedChatPassenger?.passenger_id === entry.passenger_id ? "selected" : ""}`}
                      onClick={() => handleSelectChatPassenger(entry)}
                    >
                      <div className={`fdo-chat-queue-avatar ${entry.is_vip ? "vip" : ""}`}>
                        {getInitials(entry.display_name)}
                      </div>
                      <div className="fdo-chat-queue-info">
                        <div className="fdo-chat-queue-name">
                          {entry.display_name}
                          {entry.is_vip && <i className="fa-solid fa-star fdo-vip-star" />}
                        </div>
                        <div className="fdo-chat-queue-last">
                          {entry.last_message || "No messages yet"}
                        </div>
                      </div>
                      {entry.unread_count > 0 && (
                        <span className="fdo-unread-pill">{entry.unread_count}</span>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="fdo-chat-panel">
                {!selectedChatPassenger ? (
                  <div className="fdo-chat-empty">
                    <i className="fa-solid fa-comments" />
                    <span>Select a guest conversation to begin</span>
                  </div>
                ) : (
                  <>
                    <div className="fdo-chat-panel-header">
                      <div>
                        <div className="fdo-chat-panel-name">
                          {selectedChatPassenger.display_name}
                          {selectedChatPassenger.is_vip && (
                            <span className="fdo-badge fdo-badge-vip fdo-badge-vip-header">
                              <i className="fa-solid fa-star fdo-star-header-icon" />VIP
                            </span>
                          )}
                        </div>
                        {selectedChatPassenger.vip_contact_channel && (
                          <div className="fdo-chat-panel-sub">
                            VIP Channel: {selectedChatPassenger.vip_contact_channel}
                          </div>
                        )}
                      </div>
                      <button
                        className="fdo-btn fdo-btn-primary fdo-btn-sm"
                        onClick={() => loadChatHistory(selectedChatPassenger.passenger_id)}
                      >
                        <i className="fa-solid fa-rotate-right fdo-refresh-icon" />
                        Refresh
                      </button>
                    </div>

                    <div className="fdo-chat-messages">
                      {chatMessages.length === 0 ? (
                        <div className="fdo-chat-empty-thread">
                          No messages yet — start the conversation below.
                        </div>
                      ) : (
                        chatMessages.map(msg => {
                          const isFdo = msg.sender_role !== "Passenger";
                          return (
                            <div
                              key={msg.message_id}
                              className={`fdo-chat-bubble-wrap ${isFdo ? "from-fdo" : "from-passenger"}`}
                            >
                              <div className={`fdo-chat-bubble ${isFdo ? "from-fdo" : "from-passenger"}`}>
                                {msg.message_body}
                              </div>
                              <div className="fdo-chat-bubble-meta">
                                {msg.sender_name} · {formatDate(msg.created_at)}
                                {isFdo && (
                                  <span className={`fdo-chat-read-tick ${msg.is_read ? "read" : "sent"}`}>
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

                    <div className="fdo-chat-input-row">
                      <textarea
                        className="fdo-chat-input"
                        placeholder="Type a reply..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        rows={1}
                      />
                      <button
                        className="fdo-chat-send-btn"
                        onClick={handleSendMessage}
                        disabled={sending || !chatInput.trim()}
                      >
                        <i className="fa-solid fa-paper-plane" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {toast && (
          <div className={`fdo-toast ${toast.type === "success" ? "fdo-toast-success" : "fdo-toast-error"}`}>
            <i className={`fa-solid ${toast.type === "success" ? "fa-circle-check" : "fa-circle-xmark"}`} style={{ marginRight: "0.5rem" }} />
            {toast.msg}
          </div>
        )}
      </div>
    </Dashboard>
  );
}
