import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import "../../../RefundPage.css";

interface RefundRequest {
  refund_id: string;
  entry_id: string;
  passenger_id: string;
  passenger_name: string;
  passenger_email: string;
  reason: string;
  status: string;
  decision_notes: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
  charge_description: string;
  charge_amount: number | string;
  charge_date: string;
}

interface CancellationPolicy {
  policy_id: string;
  policy_name: string;
  terms: string;
  window_hours: number;
}

export function RefundPage() {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("Refund Requests");
  const [activeSection, setActiveSection] = useState("Overview");

  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isFinanceManager = loggedInUser.role_name === "Finance Manager";

  useEffect(() => {
    if (!isFinanceManager) {
      const timer = setTimeout(() => {
        navigate("/home");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isFinanceManager, navigate]);

  const loadData = async () => {
    if (!isFinanceManager) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const list = await invoke<RefundRequest[]>("list_refund_requests");
      setRefundRequests(list);
      
      const policy = await invoke<CancellationPolicy>("get_cancellation_policy");
      setCancellationPolicy(policy);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectRequest = (req: RefundRequest) => {
    setSelectedRequest(req);
    setDecisionNotes(req.decision_notes || "");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleResolveRefund = async (approve: boolean) => {
    if (!selectedRequest) return;
    setErrorMsg("");
    setSuccessMsg("");

    if (!decisionNotes.trim()) {
      setErrorMsg("Decision notes are required before confirming.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        refund_id: selectedRequest.refund_id,
        decision_notes: decisionNotes.trim(),
        resolved_by: loggedInUser.user_id,
      };

      const cmd = approve ? "approve_refund_request" : "reject_refund_request";
      await invoke(cmd, { payload });

      const notifKey = `passenger_notifications_${selectedRequest.passenger_id}`;
      const existingNotifs = JSON.parse(localStorage.getItem(notifKey) || "[]");
      const title = approve ? "Refund Request Approved" : "Refund Request Rejected";
      const icon = approve ? "fa-circle-check" : "fa-circle-xmark";
      const body = approve 
        ? `Your refund request for '${selectedRequest.charge_description}' (Rp ${parseFloat(String(selectedRequest.charge_amount)).toLocaleString("id-ID")}) has been approved. Notes: ${decisionNotes}`
        : `Your refund request for '${selectedRequest.charge_description}' (Rp ${parseFloat(String(selectedRequest.charge_amount)).toLocaleString("id-ID")}) has been rejected. Notes: ${decisionNotes}`;
      
      const newNotif = {
        id: `refund-${selectedRequest.refund_id}-${Date.now()}`,
        title,
        body,
        time: new Date().toISOString(),
        icon,
      };
      localStorage.setItem(notifKey, JSON.stringify([newNotif, ...existingNotifs]));

      setSuccessMsg(`Refund request successfully ${approve ? "approved" : "rejected"}.`);
      setSelectedRequest(null);
      setDecisionNotes("");
      await loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const pendingRequests = refundRequests.filter(r => r.status === "Pending");
  const resolvedRequests = refundRequests.filter(r => r.status !== "Pending");

  const currentList = activeTab === "pending" ? pendingRequests : resolvedRequests;

  const calculateTiming = (req: RefundRequest) => {
    if (!cancellationPolicy) return { elapsedHours: 0, isValid: false };
    const chargeTime = new Date(req.charge_date).getTime();
    const requestTime = new Date(req.created_at).getTime();
    const elapsedHours = (requestTime - chargeTime) / (1000 * 60 * 60);
    const isValid = elapsedHours <= cancellationPolicy.window_hours;
    return { elapsedHours, isValid };
  };

  const formatCurrency = (val: number | string) => {
    const num = typeof val === "number" ? val : parseFloat(val || "0");
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  if (!isFinanceManager) {
    return (
      <Dashboard
        activeItem={activeItem}
        activeSection={activeSection}
        setActiveItem={setActiveItem}
        setActiveSection={setActiveSection}
      >
        <div className="refund-access-denied">
          <i className="fa-solid fa-circle-exclamation refund-denied-icon" />
          <h2>Access Denied</h2>
          <p>You do not have permission to view the Refund Console. Redirecting to dashboard...</p>
          <div className="refund-redirect-spinner" />
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard
      activeItem={activeItem}
      activeSection={activeSection}
      setActiveItem={setActiveItem}
      setActiveSection={setActiveSection}
    >
      <div className="refund-container">
        <div className="refund-header">
          <h1 className="refund-title">Passenger Refund Request Console</h1>
          <p className="refund-desc">
            Review submitted passenger e-fund refund requests, inspect cancellation windows, and finalize approvals.
          </p>
        </div>

        {errorMsg && <div className="it-error-message">{errorMsg}</div>}
        {successMsg && <div className="it-success-message">{successMsg}</div>}

        <div className="payroll-tabs">
          <button
            className={`payroll-tab-btn ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => { setActiveTab("pending"); setSelectedRequest(null); }}
          >
            <i className="fa-solid fa-hourglass-half" /> Pending Requests ({pendingRequests.length})
          </button>
          <button
            className={`payroll-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => { setActiveTab("history"); setSelectedRequest(null); }}
          >
            <i className="fa-solid fa-clock-rotate-left" /> Resolved Ledger ({resolvedRequests.length})
          </button>
        </div>

        <div className="refund-layout-wrapper">
          <div className="refund-list-pane-full">
            <div className="payroll-table-container">
              <table className="payroll-table">
                <thead>
                  <tr>
                    <th>Passenger</th>
                    <th>Charge Info</th>
                    <th>Requested At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="refund-table-loading">
                        <i className="fa-solid fa-spinner fa-spin" /> Loading refund queue...
                      </td>
                    </tr>
                  ) : currentList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="refund-table-empty">
                        {activeTab === "pending" ? "No pending refund requests." : "No resolved requests."}
                      </td>
                    </tr>
                  ) : (
                    currentList.map((req) => (
                      <tr 
                        key={req.refund_id} 
                        onClick={() => handleSelectRequest(req)}
                        className={`hp-pointer ${selectedRequest?.refund_id === req.refund_id ? "refund-row-selected" : ""}`}
                      >
                        <td>
                          <div className="refund-passenger-name">{req.passenger_name}</div>
                          <div className="refund-passenger-email">{req.passenger_email}</div>
                        </td>
                        <td>
                          <div className="refund-charge-desc">{req.charge_description}</div>
                          <div className="refund-charge-val">{formatCurrency(req.charge_amount)}</div>
                        </td>
                        <td>
                          <div className="refund-request-date">{new Date(req.created_at).toLocaleDateString()}</div>
                          <div className="refund-request-time">{new Date(req.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td>
                          <span className={`refund-badge ${req.status.toLowerCase()}`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {selectedRequest && (
          <div className="refund-modal-overlay">
            <div className="refund-modal-card">
              <div className="refund-modal-header">
                <div className="refund-modal-title-group">
                  <span className="refund-modal-subtitle">
                    Refund Request Review
                  </span>
                  <h3 className="refund-modal-title">
                    {selectedRequest.charge_description}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="refund-modal-close-btn"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              <div className="refund-modal-body">
                <div className="refund-info-grid-4">
                  <div className="refund-info-item">
                    <span className="refund-info-label">Passenger Name</span>
                    <span className="refund-info-value name">{selectedRequest.passenger_name}</span>
                  </div>
                  <div className="refund-info-item">
                    <span className="refund-info-label">Passenger Email</span>
                    <span className="refund-info-value email">{selectedRequest.passenger_email}</span>
                  </div>
                  <div className="refund-info-item">
                    <span className="refund-info-label">Charge Amount</span>
                    <span className="refund-info-value amount">
                      {formatCurrency(selectedRequest.charge_amount)}
                    </span>
                  </div>
                  <div className="refund-info-item">
                    <span className="refund-info-label">Current Status</span>
                    <div>
                      <span className={`refund-badge ${selectedRequest.status.toLowerCase()}`}>
                        {selectedRequest.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="refund-info-grid-2">
                  <div className="refund-info-item">
                    <span className="refund-info-label">Transaction Date</span>
                    <span className="refund-info-value">{new Date(selectedRequest.charge_date).toLocaleString()}</span>
                  </div>
                  <div className="refund-info-item">
                    <span className="refund-info-label">Request Date</span>
                    <span className="refund-info-value">{new Date(selectedRequest.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div className="refund-info-item">
                  <span className="refund-info-label">Reason for Request</span>
                  <p className="refund-reason-text">
                    {selectedRequest.reason}
                  </p>
                </div>

                {cancellationPolicy ? (
                  <div className="refund-policy-box">
                    <div className="refund-policy-title">
                      <i className="fa-solid fa-shield-halved" /> {cancellationPolicy.policy_name}
                    </div>
                    <p className="refund-policy-desc">
                      {cancellationPolicy.terms}
                    </p>
                    
                    {(() => {
                      const { elapsedHours, isValid } = calculateTiming(selectedRequest);
                      return (
                        <div className={`refund-policy-status ${isValid ? "valid" : "invalid"}`}>
                          <span>Elapsed Time: <strong>{elapsedHours.toFixed(1)} hours</strong></span>
                          <span>
                            {isValid 
                              ? `Valid Window (under ${cancellationPolicy.window_hours}h)` 
                              : `Exceeded Window (over ${cancellationPolicy.window_hours}h)`
                            }
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="it-error-message margin-0">
                    Policy terms unavailable - cannot evaluate request.
                  </div>
                )}

                {selectedRequest.status === "Pending" ? (
                  <div className="refund-decision-form">
                    <div className="refund-info-item">
                      <span className="refund-info-label refund-textarea-label">Decision Notes</span>
                      <textarea
                        required
                        rows={4}
                        className="refund-textarea"
                        placeholder="Explain the approval or rejection details..."
                        value={decisionNotes}
                        onChange={(e) => setDecisionNotes(e.target.value)}
                      />
                    </div>
                    <div className="refund-action-buttons">
                      <button
                        className="refund-btn-reject"
                        disabled={submitting}
                        onClick={() => handleResolveRefund(false)}
                      >
                        <i className="fa-solid fa-circle-xmark" /> Reject Refund
                      </button>
                      <button
                        className="refund-btn-approve"
                        disabled={submitting}
                        onClick={() => handleResolveRefund(true)}
                      >
                        <i className="fa-solid fa-circle-check" /> Approve Refund
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="refund-resolution-summary">
                    <h4 className="refund-resolution-title">
                      Resolution Summary
                    </h4>
                    <div className="refund-resolution-grid">
                      <div className="refund-resolution-col">
                        <span className="refund-info-label">Decision</span>
                        <strong className={`refund-resolution-status-val ${selectedRequest.status.toLowerCase()}`}>
                          {selectedRequest.status}
                        </strong>
                      </div>
                      <div className="refund-resolution-col">
                        <span className="refund-info-label">Resolved By</span>
                        <span className="refund-resolution-val">{selectedRequest.resolved_by_name}</span>
                      </div>
                      <div className="refund-resolution-col">
                        <span className="refund-info-label">Resolved At</span>
                        <span className="refund-resolution-val">
                          {selectedRequest.resolved_at ? new Date(selectedRequest.resolved_at).toLocaleString() : ""}
                        </span>
                      </div>
                    </div>
                    <div className="refund-resolution-notes-box">
                      <span className="refund-info-label">Decision Notes</span>
                      <p className="refund-resolution-notes-text">
                        {selectedRequest.decision_notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Dashboard>
  );
}
