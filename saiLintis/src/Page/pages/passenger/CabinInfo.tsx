import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createPortal } from "react-dom";
import "../../../FdoDashboard.css";

interface CabinInfoProps {
  passengerId: string;
  passengerProfileDetails: any;
  fetchSpendingData: () => Promise<void>;
  isUpdating: boolean;
  setIsUpdating: (val: boolean) => void;
  setOperationError: (val: string) => void;
  setOperationSuccess: (val: string) => void;
  onNotificationAdded?: () => void;
}

export function CabinInfo({
  passengerId,
  passengerProfileDetails,
  fetchSpendingData,
  isUpdating,
  setIsUpdating,
  setOperationError,
  setOperationSuccess,
  onNotificationAdded
}: CabinInfoProps) {
  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChatHistory = useCallback(async () => {
    if (!passengerId) return;
    try {
      const msgs = await invoke<any[]>("get_chat_history", { passenger_id: passengerId });
      setChatMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (_) {
      void 0;
    }
  }, [passengerId]);

  useEffect(() => {
    loadChatHistory();
    chatPollRef.current = setInterval(loadChatHistory, 3000);
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [loadChatHistory]);

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || chatSending) return;
    setChatSending(true);
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
      setOperationError("Failed to send message: " + String(e));
    } finally {
      setChatSending(false);
    }
  };

  const formatChatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };
  const [roomServiceQuantities, setRoomServiceQuantities] = useState<Record<string, number>>({
    "Gourmet Burger": 0,
    "Seafood Pasta": 0,
    "Club Sandwich": 0,
    "Fruit Platter": 0,
    "Champagne": 0,
    "Orange Juice": 0,
    "Coffee": 0
  });

  const [feedbackSubjectInput, setFeedbackSubjectInput] = useState("");
  const [feedbackContentInput, setFeedbackContentInput] = useState("");

  const [medicalCabinNumberInput, setMedicalCabinNumberInput] = useState("");
  const [medicalEmergencyType, setMedicalEmergencyType] = useState("General Support");
  const [medicalSeverityLevel, setMedicalSeverityLevel] = useState("Medium");

  const [showSosConfirmModal, setShowSosConfirmModal] = useState(false);
  const [sosQueueTicketDetails, setSosQueueTicketDetails] = useState<any>(null);

  const roomServicePriceMap: Record<string, number> = {
    "Gourmet Burger": 15,
    "Seafood Pasta": 22,
    "Club Sandwich": 12,
    "Fruit Platter": 10,
    "Champagne": 95,
    "Orange Juice": 5,
    "Coffee": 4
  };

  const handleModifyQuantity = (itemName: string, increment: boolean) => {
    setRoomServiceQuantities(prev => {
      const current = prev[itemName] || 0;
      const next = increment ? current + 1 : Math.max(0, current - 1);
      return { ...prev, [itemName]: next };
    });
  };

  const computeRoomServiceTotal = () => {
    let totalValue = 0;
    Object.entries(roomServiceQuantities).forEach(([itemName, qty]) => {
      const price = roomServicePriceMap[itemName] || 0;
      totalValue += price * qty;
    });
    return totalValue;
  };

  const handleSendRoomServiceOrder = async () => {
    setOperationError("");
    setOperationSuccess("");
    const orderedItems: string[] = [];
    Object.entries(roomServiceQuantities).forEach(([itemName, qty]) => {
      if (qty > 0) {
        orderedItems.push(`${itemName} x${qty}`);
      }
    });
    if (orderedItems.length === 0) {
      setOperationError("Please select at least one room service menu item to order.");
      return;
    }
    setIsUpdating(true);
    try {
      const totalPriceVal = computeRoomServiceTotal();
      await invoke("order_room_service", {
        payload: {
          passenger_id: passengerId,
          items: orderedItems,
          total_price: totalPriceVal.toFixed(2)
        }
      });
      setOperationSuccess(`Room service order submitted successfully! Total: Rp ${totalPriceVal.toLocaleString("id-ID")}`);
      setRoomServiceQuantities({
        "Gourmet Burger": 0,
        "Seafood Pasta": 0,
        "Club Sandwich": 0,
        "Fruit Platter": 0,
        "Champagne": 0,
        "Orange Juice": 0,
        "Coffee": 0
      });
      await fetchSpendingData();
    } catch (error) {
      setOperationError("Failed to submit room service order: " + String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendFeedbackComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationError("");
    setOperationSuccess("");
    if (!feedbackSubjectInput || !feedbackContentInput) {
      setOperationError("Subject and feedback content are required.");
      return;
    }
    setIsUpdating(true);
    try {
      await invoke("submit_formal_feedback_or_complaint", {
        payload: {
          passenger_id: passengerId,
          subject: feedbackSubjectInput.trim(),
          content: feedbackContentInput.trim()
        }
      });
      setOperationSuccess("Your formal feedback has been submitted successfully and is awaiting review.");
      setFeedbackSubjectInput("");
      setFeedbackContentInput("");
    } catch (error) {
      setOperationError("Failed to submit feedback: " + String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const triggerSosConfirmationFlow = () => {
    setOperationError("");
    setOperationSuccess("");
    if (!medicalCabinNumberInput) {
      setOperationError("Cabin number is required for medical emergency signals.");
      return;
    }
    setShowSosConfirmModal(true);
  };

  const handleSendMedicalUrgentDistress = async () => {
    setIsUpdating(true);
    try {
      await invoke("request_medical_support", {
        payload: {
          passenger_id: passengerId,
          cabin_number: medicalCabinNumberInput.trim(),
          request_type: medicalEmergencyType,
          severity: medicalSeverityLevel
        }
      });

      const randomPartOne = Math.floor(100 + Math.random() * 900);
      const randomPartTwo = Math.floor(100 + Math.random() * 900);
      const generatedTicketCode = `MED-${randomPartOne}-${randomPartTwo}`;

      setSosQueueTicketDetails({
        ticketNumber: generatedTicketCode,
        priority: medicalSeverityLevel,
        status: "DISPATCHED",
        estimatedArrival: "3-5 Minutes"
      });

      const storageKey = `passenger_notifications_${passengerId}`;
      const existingNotifs = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const newNotif = {
        id: `sos-${Date.now()}`,
        title: "Medical SOS Dispatched",
        body: `Emergency signal sent for Cabin ${medicalCabinNumberInput.trim()}. Queue Ticket: ${generatedTicketCode}.`,
        time: new Date().toISOString(),
        icon: "fa-triangle-exclamation"
      };
      localStorage.setItem(storageKey, JSON.stringify([newNotif, ...existingNotifs]));

      if (onNotificationAdded) {
        onNotificationAdded();
      }

      setMedicalCabinNumberInput("");
    } catch (error) {
      setOperationError("Failed to dispatch emergency signal: " + String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="ps-dashboard-container">
      <div className="ps-title-section">
        <h1 className="hp-title-giant">Cabin Services & Room Service</h1>
        <p className="hp-subtitle-clean">Order cabin room service, submit formal feedback, or request emergency assistance.</p>
      </div>

      <div className="ps-grid-selection">
        <div className="ps-booking-card">
          <h3>Order Cabin Room Service</h3>
          <p className="ps-card-subtitle">Order gourmet dining items delivered directly to your cabin door.</p>

          <div className="ps-menu-card-grid">
            {Object.entries(roomServicePriceMap).map(([itemName, price]) => {
              const qty = roomServiceQuantities[itemName] || 0;
              return (
                <div key={itemName} className="ps-menu-card">
                  <div className="ps-menu-card-top">
                    <span className="ps-menu-card-name">{itemName}</span>
                    <span className="ps-menu-card-price">Rp {price.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="ps-menu-card-counter">
                    <button type="button" onClick={() => handleModifyQuantity(itemName, false)} className="ps-counter-btn">-</button>
                    <span className="ps-counter-val">{qty}</span>
                    <button type="button" onClick={() => handleModifyQuantity(itemName, true)} className="ps-counter-btn">+</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ps-room-service-total-row">
            <span className="ps-room-service-total-label">Total Order Price</span>
            <span className="ps-room-service-total-value">Rp {computeRoomServiceTotal().toLocaleString("id-ID")}</span>
          </div>

          <button onClick={handleSendRoomServiceOrder} disabled={isUpdating} className="hp-btn-primary-sharp ps-submit-btn">
            Send Room Service Order
          </button>
        </div>

        <div className="ps-booking-split-col">
          <div className="ps-booking-card">
            <h3>Submit Cabin Complaint / Feedback</h3>
            <form onSubmit={handleSendFeedbackComplaint} className="ps-spending-form ps-field-wrapper-top">
              <div className="hp-field">
                <label className="ps-field-label">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AC Malfunction, Missing Towels"
                  value={feedbackSubjectInput}
                  onChange={(e) => setFeedbackSubjectInput(e.target.value)}
                  className="it-input"
                />
              </div>
              <div className="hp-field">
                <label className="ps-field-label">Detail Description</label>
                <textarea
                  required
                  placeholder="Provide details regarding your cabin concern..."
                  value={feedbackContentInput}
                  onChange={(e) => setFeedbackContentInput(e.target.value)}
                  className="it-input ps-dietary-textarea"
                />
              </div>
              <button type="submit" disabled={isUpdating} className="hp-btn-primary-sharp">
                Submit Formal Feedback
              </button>
            </form>
          </div>

          <div className="ps-emergency-card">
            <h3 className="ps-emergency-header-text">EMERGENCY MEDICAL SUPPORT</h3>
            <p className="ps-emergency-alert-desc">
              Use this button ONLY in case of urgent medical emergencies. Abuse is strictly penalized.
            </p>

            <div className="hp-grid-2 ps-emergency-fields-row">
              <div className="hp-field">
                <label className="ps-field-label ps-emergency-field-label">Cabin Number</label>
                <input
                  type="text"
                  placeholder="e.g. Suite 102"
                  value={medicalCabinNumberInput}
                  onChange={(e) => setMedicalCabinNumberInput(e.target.value)}
                  className="it-input ps-emergency-input"
                />
              </div>
              <div className="hp-field">
                <label className="ps-field-label ps-emergency-field-label">Request Type</label>
                <select
                  value={medicalEmergencyType}
                  onChange={(e) => setMedicalEmergencyType(e.target.value)}
                  className="it-select ps-emergency-select"
                >
                  <option value="General Support">General Support</option>
                  <option value="Emergency Ambulance">Emergency Ambulance</option>
                  <option value="First Aid Box Delivery">First Aid Box Delivery</option>
                  <option value="Physician Visit">Physician Visit</option>
                </select>
              </div>
              <div className="hp-field">
                <label className="ps-field-label ps-emergency-field-label">Severity Level</label>
                <select
                  value={medicalSeverityLevel}
                  onChange={(e) => setMedicalSeverityLevel(e.target.value)}
                  className="it-select ps-emergency-select"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div>
              <button type="button" onClick={triggerSosConfirmationFlow} disabled={isUpdating} className="ps-emergency-btn">
                <i className="fa fa-phone" />
              </button>
            </div>
            <span className="ps-emergency-alert-text">PRESS TO DISPATCH MEDICAL DISTRESS SIGNAL</span>
          </div>

          {passengerProfileDetails?.status?.toLowerCase() === "vip" && (
            <div className="ps-vip-direct-line">
              <i className="fa fa-headset" />
              <div>
                <span className="ps-vip-badge ps-direct-concierge-badge">Direct Concierge</span>
                <div className="ps-vip-direct-line-text">
                  VIP Hotline: {passengerProfileDetails.vip_contact_channel || "Active VIP Support Desk"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSosConfirmModal && createPortal(
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card ps-sos-modal-card">
            <div className="it-modal-header ps-sos-modal-header">Confirm Emergency Signal</div>
            <div className="it-modal-body">
              <p className="ps-sos-modal-body-text">
                Are you sure you want to dispatch a medical distress signal for Cabin <strong>{medicalCabinNumberInput}</strong>?
                This will deploy crew members immediately.
              </p>
            </div>
            <div className="it-modal-footer">
              <button className="it-btn" onClick={() => setShowSosConfirmModal(false)}>
                Cancel
              </button>
              <button
                className="it-btn ps-sos-btn-modal-confirm"
                onClick={() => {
                  setShowSosConfirmModal(false);
                  handleSendMedicalUrgentDistress();
                }}
              >
                Dispatch SOS
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {sosQueueTicketDetails && createPortal(
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card ps-sos-ticket-modal-card">
            <div className="it-modal-header ps-sos-ticket-modal-header">Distress Signal Sent!</div>
            <div className="it-modal-body ps-sos-ticket-modal-body">
              <div className="ps-sos-ticket-exclamation">
                <i className="fa fa-circle-exclamation" />
              </div>
              <p className="ps-sos-ticket-desc">
                Your emergency medical support request has been received by the ship crew. Officers are preparing to deploy to your cabin.
              </p>
              <div className="ps-sos-ticket-card">
                <div className="ps-sos-ticket-label">EMERGENCY QUEUE TICKET</div>
                <div className="ps-sos-ticket-code">
                  {sosQueueTicketDetails.ticketNumber}
                </div>
                <div className="ps-sos-ticket-row">
                  <span>Priority: <strong>{sosQueueTicketDetails.priority}</strong></span>
                  <span>ETA: <strong>{sosQueueTicketDetails.estimatedArrival}</strong></span>
                </div>
              </div>
            </div>
            <div className="it-modal-footer ps-sos-ticket-modal-footer">
              <button className="hp-btn-primary-sharp ps-sos-ticket-btn-close" onClick={() => setSosQueueTicketDetails(null)}>
                Acknowledge (Close)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <div className="ps-grid-selection ps-chat-section-margin">
        <div className="ps-booking-card ps-chat-booking-card">
          <h3 className="ps-chat-header-title">
            <i className="fa-solid fa-headset" />
            Contact Front Desk
            {passengerProfileDetails?.status?.toLowerCase() === "vip" && (
              <span className="fdo-badge fdo-badge-vip ps-chat-badge-vip">
                <i className="fa-solid fa-star ps-chat-star-icon" />VIP
              </span>
            )}
          </h3>
          <p className="ps-card-subtitle">Send a message to our Front Desk Officers. They are available 24/7 to assist you.</p>

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
              placeholder="Message the Front Desk..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChatMessage(); }
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
      </div>
    </div>
  );
}
