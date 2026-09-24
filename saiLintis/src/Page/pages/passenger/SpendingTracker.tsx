import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "../../../SpendingTracker.css";

interface SpendingTrackerProps {
  passengerId: string;
  onboardSpendSummary: any;
  spendingHistoryList: any[];
  fetchSpendingData: () => Promise<void>;
  isUpdating: boolean;
  setIsUpdating: (val: boolean) => void;
  setOperationError: (val: string) => void;
  setOperationSuccess: (val: string) => void;
}

export function SpendingTracker({
  passengerId,
  onboardSpendSummary,
  spendingHistoryList,
  fetchSpendingData,
  isUpdating,
  setIsUpdating,
  setOperationError,
  setOperationSuccess
}: SpendingTrackerProps) {
  const [spendingDescriptionInput, setSpendingDescriptionInput] = useState("");
  const [spendingAmountInput, setSpendingAmountInput] = useState("");
  const [refundRequests, setRefundRequests] = useState<any[]>([]);
  const [showRefundModal, setShowRefundModal] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState("");

  const fetchRefundRequests = async () => {
    try {
      const list = await invoke<any[]>("list_refund_requests");
      const filtered = list.filter(r => r.passenger_id === passengerId);
      setRefundRequests(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (passengerId) {
      fetchRefundRequests();
    }
  }, [passengerId, spendingHistoryList]);

  const handlePostSpendingEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationError("");
    setOperationSuccess("");
    if (!spendingDescriptionInput || !spendingAmountInput) {
      setOperationError("Description and spending amount are required.");
      return;
    }
    setIsUpdating(true);
    try {
      await invoke("add_spending_entry", {
        payload: {
          passenger_id: passengerId,
          description: spendingDescriptionInput.trim(),
          amount: parseFloat(spendingAmountInput).toFixed(2)
        }
      });
      setSpendingDescriptionInput("");
      setSpendingAmountInput("");
      setOperationSuccess("New spending entry added successfully!");
      await fetchSpendingData();
    } catch (error) {
      setOperationError("Failed to add spending entry: " + String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationError("");
    setOperationSuccess("");
    if (!refundReason.trim()) {
      alert("Please enter a reason for the refund request.");
      return;
    }
    setIsUpdating(true);
    try {
      await invoke("submit_refund_request", {
        payload: {
          entry_id: showRefundModal.entry_id,
          passenger_id: passengerId,
          reason: refundReason.trim()
        }
      });
      setShowRefundModal(null);
      setRefundReason("");
      setOperationSuccess("Refund request submitted successfully!");
      await fetchSpendingData();
      await fetchRefundRequests();
    } catch (error) {
      setOperationError("Failed to submit refund request: " + String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const spendingTotalNumber = parseFloat(onboardSpendSummary.total_spent) || 0;

  return (
    <div className="ps-spending-card">
      <div className="ps-spending-header">
        <h2 className="hp-block-header">Voyage Onboard Spending Tracker</h2>
        <div className="hp-flex-gap-8">
          <span className="ps-vip-badge">Ship Account</span>
        </div>
      </div>

      <div className="ps-spending-metrics">
        <div className="ps-metric-item">
          <span className="ps-metric-label">Total Spent</span>
          <span className="ps-metric-value spent">Rp {spendingTotalNumber.toLocaleString("id-ID")}</span>
        </div>
      </div>

      <div className="ps-spending-split">
        <form onSubmit={handlePostSpendingEntry} className="ps-spending-form">
          <h3>Record New Spending Charge</h3>
          <div className="hp-field">
            <label className="ps-field-label">Charge Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Souvenir Shop, Spa Massage"
              value={spendingDescriptionInput}
              onChange={(e) => setSpendingDescriptionInput(e.target.value)}
              className="it-input"
            />
          </div>
          <div className="hp-field">
            <label className="ps-field-label">Amount (Rupiah)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={spendingAmountInput}
              onChange={(e) => setSpendingAmountInput(e.target.value)}
              className="it-input"
            />
          </div>
          <button type="submit" disabled={isUpdating} className="hp-btn-primary-sharp">
            Post Charge
          </button>
        </form>

        <div>
          <h3>Recent Spending Records</h3>
          <div className="ps-spending-list">
            {spendingHistoryList.map((entry: any) => {
              const amountNum = parseFloat(entry.amount);
              const isRefundCredit = amountNum < 0;
              const req = refundRequests.find(r => r.entry_id === entry.entry_id);

              return (
                <div key={entry.entry_id} className="ps-spending-item" style={{
                  borderLeft: isRefundCredit ? "4px solid #10b981" : "none",
                  paddingLeft: isRefundCredit ? "8px" : "12px"
                }}>
                  <div className="ps-spending-item-left">
                    <span className="ps-spending-item-desc" style={{
                      color: isRefundCredit ? "#10b981" : "inherit",
                      fontWeight: isRefundCredit ? "600" : "normal"
                    }}>
                      {entry.description}
                    </span>
                    <span className="ps-spending-item-date">{new Date(entry.date).toLocaleString()}</span>
                    
                    {!isRefundCredit && req && (
                      <span className={`ps-refund-badge ${req.status.toLowerCase()}`} style={{
                        fontSize: "11px",
                        marginLeft: "8px",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontWeight: "600",
                        display: "inline-block",
                        backgroundColor: req.status === "Pending" ? "#fef3c7" : (req.status === "Approved" ? "#d1fae5" : "#fee2e2"),
                        color: req.status === "Pending" ? "#d97706" : (req.status === "Approved" ? "#059669" : "#dc2626")
                      }}>
                        Refund: {req.status}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                    <span className="ps-spending-item-amount" style={{
                      color: isRefundCredit ? "#10b981" : "inherit"
                    }}>
                      {isRefundCredit ? `+Rp ${Math.abs(amountNum).toLocaleString("id-ID")}` : `-Rp ${amountNum.toLocaleString("id-ID")}`}
                    </span>
                    
                    {!isRefundCredit && !req && !entry.description.startsWith("Refund:") && (
                      <button 
                        onClick={() => {
                          setRefundReason("");
                          setShowRefundModal(entry);
                        }} 
                        className="ps-refund-btn"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#3b82f6",
                          fontSize: "11px",
                          textDecoration: "underline",
                          cursor: "pointer",
                          padding: 0
                        }}
                      >
                        Request Refund
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {spendingHistoryList.length === 0 && (
              <p className="ps-text-muted-medium">No spending logs recorded for this voyage yet.</p>
            )}
          </div>
        </div>
      </div>

      {showRefundModal && (
        <div className="ps-modal-overlay">
          <div className="ps-modal-card">
            <div className="ps-modal-header">
              <div>
                <span className="ps-modal-subtitle">
                  Onboard Transaction Ledger
                </span>
                <h2 className="ps-modal-title">
                  Request Refund for Service
                </h2>
              </div>
              <button 
                onClick={() => setShowRefundModal(null)}
                className="ps-modal-close-btn"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="ps-modal-body">
              <div className="ps-modal-detail-card">
                <div>
                  <span className="ps-detail-label">
                    Selected Transaction
                  </span>
                  <h3 className="ps-detail-title">
                    {showRefundModal.description}
                  </h3>
                </div>

                <div className="ps-detail-grid">
                  <div>
                    <span className="ps-detail-grid-label">
                      Charged Amount
                    </span>
                    <strong className="ps-detail-amount">
                      -Rp {parseFloat(showRefundModal.amount).toLocaleString("id-ID")}
                    </strong>
                  </div>
                  <div>
                    <span className="ps-detail-grid-label">
                      Transaction Date
                    </span>
                    <span className="ps-detail-date">
                      {new Date(showRefundModal.date).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="ps-warning-box">
                  <strong className="ps-warning-title">
                    <i className="fa-solid fa-circle-info" /> Cancellation Window Warning
                  </strong>
                  All standard requests are evaluated against our 24-hour window from the date and time of the charge. Please submit the exact reason to prevent denial.
                </div>
              </div>

              <div className="ps-modal-form-card">
                <form onSubmit={handleSubmitRefund} className="ps-modal-form">
                  <div>
                    <h3 className="ps-form-title">
                      Submit Claim Details
                    </h3>
                    <p className="ps-form-desc">
                      Please enter a clear explanation for the Finance Manager to evaluate.
                    </p>
                  </div>

                  <div className="hp-field">
                    <label className="ps-field-label">
                      Reason for Refund Claim
                    </label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Enter details here (e.g., booked show cancellation, incorrect charge, missed excursion because of tender delay)..."
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      className="ps-textarea"
                    />
                  </div>

                  <div className="ps-modal-actions">
                    <button
                      type="button"
                      onClick={() => setShowRefundModal(null)}
                      className="hp-btn-primary-sharp hp-btn-secondary-sharp"
                    >
                      Cancel Claim
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="hp-btn-primary-sharp"
                    >
                      Submit Refund Claim
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

