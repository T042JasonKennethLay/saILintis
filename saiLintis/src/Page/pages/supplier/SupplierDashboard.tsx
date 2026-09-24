import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import "../../../SupplierDashboard.css";

interface RestockRequest {
  request_id: string;
  item_id: string;
  item_name: string;
  requested_quantity: number;
  reason: string;
  status: string;
  requested_by: string;
  requested_by_name: string;
  requested_at: string;
}

export function SupplierDashboard() {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("Supplier Dashboard");
  const [activeSection, setActiveSection] = useState("Overview");

  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RestockRequest | null>(null);

  const [activeTab, setActiveTab] = useState<"incoming" | "history">("incoming");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isSupplier = loggedInUser.role_name === "Supplier";

  useEffect(() => {
    if (!isSupplier) {
      const timer = setTimeout(() => {
        navigate("/home");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSupplier, navigate]);

  const loadData = async () => {
    if (!isSupplier) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const list = await invoke<RestockRequest[]>("rm_get_restock_requests");
      setRestockRequests(list);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectRequest = (req: RestockRequest) => {
    setSelectedRequest(req);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleShipRequest = async () => {
    if (!selectedRequest) return;
    setErrorMsg("");
    setSuccessMsg("");
    setSubmitting(true);
    try {
      await invoke("rm_update_restock_request_status", {
        requestId: selectedRequest.request_id,
        status: "Shipped",
      });
      setSuccessMsg(`Restock request for ${selectedRequest.item_name} has been marked as Shipped.`);
      setSelectedRequest(null);
      await loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const incomingRequests = restockRequests.filter(r => r.status === "Passed to Supplier");
  const historyRequests = restockRequests.filter(r => r.status === "Shipped" || r.status === "Delivered");

  const currentList = activeTab === "incoming" ? incomingRequests : historyRequests;

  if (!isSupplier) {
    return (
      <Dashboard
        activeItem={activeItem}
        activeSection={activeSection}
        setActiveItem={setActiveItem}
        setActiveSection={setActiveSection}
      >
        <div className="restock-access-denied">
          <i className="fa-solid fa-circle-exclamation restock-denied-icon" />
          <h2>Access Denied</h2>
          <p>You do not have permission to view the Supplier Dashboard. Redirecting to dashboard...</p>
          <div className="restock-redirect-spinner" />
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
      <div className="restock-container">
        <div className="restock-header">
          <h1 className="restock-title">Supplier Operations Console</h1>
          <p className="restock-desc">
            Manage and dispatch restock inventory requests submitted by Restaurant Managers.
          </p>
        </div>

        {errorMsg && <div className="it-error-message">{errorMsg}</div>}
        {successMsg && <div className="it-success-message">{successMsg}</div>}

        <div className="payroll-tabs">
          <button
            className={`payroll-tab-btn ${activeTab === "incoming" ? "active" : ""}`}
            onClick={() => { setActiveTab("incoming"); setSelectedRequest(null); }}
          >
            <i className="fa-solid fa-inbox" /> Incoming Orders ({incomingRequests.length})
          </button>
          <button
            className={`payroll-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => { setActiveTab("history"); setSelectedRequest(null); }}
          >
            <i className="fa-solid fa-clock-rotate-left" /> Dispatch Ledger ({historyRequests.length})
          </button>
        </div>

        <div className="restock-layout-wrapper">
          <div className="restock-list-pane-full">
            <div className="payroll-table-container">
              <table className="payroll-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Requested Quantity</th>
                    <th>Requested By</th>
                    <th>Requested At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="restock-table-loading">
                        <i className="fa-solid fa-spinner fa-spin" /> Loading requests...
                      </td>
                    </tr>
                  ) : currentList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="restock-table-empty">
                        {activeTab === "incoming" ? "No incoming restock requests from the galley." : "No shipment history."}
                      </td>
                    </tr>
                  ) : (
                    currentList.map((req) => (
                      <tr
                        key={req.request_id}
                        onClick={() => handleSelectRequest(req)}
                        className={`hp-pointer ${selectedRequest?.request_id === req.request_id ? "restock-row-selected" : ""}`}
                      >
                        <td><strong>{req.item_name}</strong></td>
                        <td>{req.requested_quantity}</td>
                        <td>{req.requested_by_name}</td>
                        <td>{new Date(req.requested_at).toLocaleString()}</td>
                        <td>
                          <span className={`rest-badge rest-badge-${req.status.toLowerCase().replace(/\s+/g, "-")}`}>
                            {req.status === "Passed to Supplier" ? "Sent to Supplier" : req.status}
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
          <div className="restock-modal-overlay">
            <div className="restock-modal-card">
              <div className="restock-modal-header">
                <div className="restock-modal-title-group">
                  <span className="restock-modal-subtitle">Dispatch Order Review</span>
                  <h3 className="restock-modal-title">{selectedRequest.item_name}</h3>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="restock-modal-close-btn"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              <div className="restock-modal-body">
                <div className="restock-info-grid">
                  <div className="restock-info-item">
                    <span className="restock-info-label">Item Name</span>
                    <span className="restock-info-value">{selectedRequest.item_name}</span>
                  </div>
                  <div className="restock-info-item">
                    <span className="restock-info-label">Requested Quantity</span>
                    <span className="restock-info-value" style={{ color: "var(--blue)", fontWeight: 800 }}>
                      {selectedRequest.requested_quantity}
                    </span>
                  </div>
                  <div className="restock-info-item">
                    <span className="restock-info-label">Requested By</span>
                    <span className="restock-info-value">{selectedRequest.requested_by_name}</span>
                  </div>
                  <div className="restock-info-item">
                    <span className="restock-info-label">Requested At</span>
                    <span className="restock-info-value">{new Date(selectedRequest.requested_at).toLocaleString()}</span>
                  </div>
                  <div className="restock-info-item" style={{ gridColumn: "span 2" }}>
                    <span className="restock-info-label">Current Status</span>
                    <div>
                      <span className={`rest-badge rest-badge-${selectedRequest.status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {selectedRequest.status === "Passed to Supplier" ? "Sent to Supplier" : selectedRequest.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="restock-info-item">
                  <span className="restock-info-label">Reason for Request</span>
                  <p className="restock-reason-text">{selectedRequest.reason}</p>
                </div>

                {selectedRequest.status === "Passed to Supplier" ? (
                  <div className="restock-action-buttons">
                    <button
                      className="restock-btn-approve"
                      style={{ background: "var(--blue)" }}
                      disabled={submitting}
                      onClick={handleShipRequest}
                    >
                      <i className="fa-solid fa-truck-fast" /> Process & Ship Request
                    </button>
                  </div>
                ) : (
                  <div className="restock-resolution-summary">
                    <h4 className="restock-resolution-title">Dispatch Status</h4>
                    <div className="restock-resolution-grid">
                      <div className="restock-resolution-col">
                        <span className="restock-info-label">Status Summary</span>
                        <strong className={`restock-resolution-status-val ${selectedRequest.status.toLowerCase().replace(/\s+/g, "-")}`}>
                          {selectedRequest.status}
                        </strong>
                      </div>
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
