import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import "../../../PayrollPage.css";

interface CrewContractInfo {
  user_id: string;
  username: string;
  display_name: string;
  role_name: string;
  department: string;
  employee_id: string;
  contract_type: string;
  duration_months: number;
  monthly_base_salary: number | string;
  is_complete: boolean;
}

interface PayrollRecordResponse {
  payroll_id: string;
  cycle_date: string;
  total_amount: number | string;
  submitted_by_name: string;
  crew_count: number;
  details: string;
}

export function PayrollPage() {
  const [activeItem, setActiveItem] = useState("Payroll Management");
  const [activeSection, setActiveSection] = useState("Overview");

  const [crewRoster, setCrewRoster] = useState<CrewContractInfo[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecordResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"roster" | "history">("roster");

  const [editingCrew, setEditingCrew] = useState<CrewContractInfo | null>(null);
  const [selectedContractType, setSelectedContractType] = useState("Full-Time");
  const [selectedDuration, setSelectedDuration] = useState(12);
  const [selectedBaseSalary, setSelectedBaseSalary] = useState(3000);

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");

  const getFactor = (type: string): number => {
    switch (type) {
      case "Full-Time":
        return 1.0;
      case "Part-Time":
        return 0.5;
      case "Contractor":
        return 1.2;
      case "Temporary":
        return 0.8;
      default:
        return 1.0;
    }
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const roster = await invoke<CrewContractInfo[]>("get_crew_payroll_data");
      setCrewRoster(roster);
      const history = await invoke<PayrollRecordResponse[]>("list_payroll_records");
      setPayrollHistory(history);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEditModal = (crew: CrewContractInfo) => {
    setEditingCrew(crew);
    setSelectedContractType(crew.contract_type || "Full-Time");
    setSelectedDuration(crew.duration_months || 12);
    
    const baseVal = typeof crew.monthly_base_salary === "number" 
      ? crew.monthly_base_salary 
      : parseFloat(crew.monthly_base_salary || "0");
    setSelectedBaseSalary(baseVal > 0 ? baseVal : 3000);
  };

  const handleSaveContract = async () => {
    if (!editingCrew) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const payload = {
        user_id: editingCrew.user_id,
        contract_type: selectedContractType,
        duration_months: selectedDuration,
        monthly_base_salary: selectedBaseSalary,
      };
      await invoke("save_crew_contract", { payload });
      setSuccessMsg(`Successfully saved contract settings for ${editingCrew.display_name}.`);
      setEditingCrew(null);
      await loadData();
    } catch (err) {
      setErrorMsg(String(err));
    }
  };

  const handleSubmitPayroll = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      const detailsList = crewRoster.map((c) => {
        const baseSal = typeof c.monthly_base_salary === "number"
          ? c.monthly_base_salary
          : parseFloat(c.monthly_base_salary || "0");
        const factor = getFactor(c.contract_type);
        const calculatedPay = baseSal * factor;
        return {
          user_id: c.user_id,
          employee_id: c.employee_id,
          username: c.username,
          display_name: c.display_name,
          role_name: c.role_name,
          department: c.department,
          contract_type: c.contract_type,
          duration_months: c.duration_months,
          monthly_base_salary: baseSal,
          factor: factor,
          calculated_salary: calculatedPay,
        };
      });

      const totalAmount = detailsList.reduce((acc, curr) => acc + curr.calculated_salary, 0);

      const payload = {
        total_amount: totalAmount,
        submitted_by: loggedInUser.user_id,
        crew_count: detailsList.length,
        details: JSON.stringify(detailsList),
      };

      const resultId = await invoke<string>("submit_crew_payroll", { payload });
      setSuccessMsg(`Payroll processed successfully! Record ID: ${resultId}`);
      await loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = async (payrollId: string, filename: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const base64Data = await invoke<string>("export_payroll_csv", { payrollId });
      const binaryString = window.atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSuccessMsg(`Successfully downloaded ${filename}`);
    } catch (err) {
      setErrorMsg("Export failed: " + String(err));
    }
  };

  const totalBaseSalary = crewRoster.reduce((acc, curr) => {
    const baseSal = typeof curr.monthly_base_salary === "number"
      ? curr.monthly_base_salary
      : parseFloat(curr.monthly_base_salary || "0");
    return acc + baseSal;
  }, 0);

  const totalAdjustedSalary = crewRoster.reduce((acc, curr) => {
    const baseSal = typeof curr.monthly_base_salary === "number"
      ? curr.monthly_base_salary
      : parseFloat(curr.monthly_base_salary || "0");
    const factor = getFactor(curr.contract_type);
    return acc + (baseSal * factor);
  }, 0);

  const missingOrExpiredCount = crewRoster.filter(
    (c) => !c.is_complete || c.duration_months <= 0
  ).length;

  const hasMissingOrExpired = missingOrExpiredCount > 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <Dashboard
      activeItem={activeItem}
      activeSection={activeSection}
      setActiveItem={setActiveItem}
      setActiveSection={setActiveSection}
    >
      <div className="payroll-container">
        <div className="payroll-header">
          <h1 className="payroll-title">Crew Payroll Console</h1>
          <p className="payroll-desc">
            Manage crew member contract durations, adjust monthly wage rates, and execute monthly payroll runs.
          </p>
        </div>

        {errorMsg && <div className="it-error-message">{errorMsg}</div>}
        {successMsg && <div className="it-success-message">{successMsg}</div>}

        <div className="payroll-tabs">
          <button
            className={`payroll-tab-btn ${activeTab === "roster" ? "active" : ""}`}
            onClick={() => setActiveTab("roster")}
          >
            <i className="fa-solid fa-users" /> Crew Roster & Calculation
          </button>
          <button
            className={`payroll-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <i className="fa-solid fa-clock-rotate-left" /> Execution History
          </button>
        </div>

        {activeTab === "roster" && (
          <div>
            <div className="payroll-summary-grid">
              <div className="payroll-stat-card">
                <span className="payroll-stat-label">Total Crew Members</span>
                <span className="payroll-stat-value">{crewRoster.length}</span>
              </div>
              <div className="payroll-stat-card">
                <span className="payroll-stat-label">Base Monthly Salary Run</span>
                <span className="payroll-stat-value">{formatCurrency(totalBaseSalary)}</span>
              </div>
              <div className="payroll-stat-card">
                <span className="payroll-stat-label">Adjusted Salary Run</span>
                <span className="payroll-stat-value">{formatCurrency(totalAdjustedSalary)}</span>
              </div>
              <div className="payroll-stat-card">
                <span className="payroll-stat-label">Missing/Expired Contracts</span>
                <span className="payroll-stat-value" style={{ color: hasMissingOrExpired ? "#dc2626" : "#059669" }}>
                  {missingOrExpiredCount}
                </span>
              </div>
            </div>

            {hasMissingOrExpired && (
              <div className="payroll-alert-banner warning">
                <i className="payroll-alert-icon fa-solid fa-triangle-exclamation" />
                <div>
                  <strong>Action Required:</strong> You have {missingOrExpiredCount} crew member(s) with missing or expired contracts. Payroll runs are disabled until all roster configuration setups are resolved.
                </div>
              </div>
            )}

            {!hasMissingOrExpired && crewRoster.length > 0 && (
              <div className="payroll-alert-banner success">
                <i className="payroll-alert-icon fa-solid fa-circle-check" />
                <div>
                  All active crew members have complete contract details. Ready to submit payroll.
                </div>
              </div>
            )}

            <div className="payroll-action-row">
              <h2 className="hp-font-18-bold">Active Crew Payroll Roster</h2>
              <button
                className="payroll-btn payroll-btn-primary"
                disabled={hasMissingOrExpired || crewRoster.length === 0 || submitting}
                onClick={handleSubmitPayroll}
              >
                <i className="fa-solid fa-calculator" />
                {submitting ? "Processing Run..." : "Process Monthly Payroll"}
              </button>
            </div>

            <div className="payroll-table-container">
              <table className="payroll-table">
                <thead>
                  <tr>
                    <th>Crew Info</th>
                    <th>Role & Dept</th>
                    <th>Status</th>
                    <th>Contract Type</th>
                    <th>Months Left</th>
                    <th>Base Rate</th>
                    <th>Adjusted Rate</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "32px" }}>
                        <i className="fa-solid fa-spinner fa-spin" /> Loading crew roster...
                      </td>
                    </tr>
                  ) : crewRoster.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "32px", opacity: 0.5 }}>
                        No crew members found.
                      </td>
                    </tr>
                  ) : (
                    crewRoster.map((crew) => {
                      const baseSal = typeof crew.monthly_base_salary === "number"
                        ? crew.monthly_base_salary
                        : parseFloat(crew.monthly_base_salary || "0");
                      const factor = getFactor(crew.contract_type);
                      const adjustedSal = baseSal * factor;

                      let statusBadgeClass = "payroll-badge active";
                      let statusText = "Active";

                      if (!crew.is_complete) {
                        statusBadgeClass = "payroll-badge missing";
                        statusText = "Missing Contract";
                      } else if (crew.duration_months <= 0) {
                        statusBadgeClass = "payroll-badge expired";
                        statusText = "Expired";
                      }

                      return (
                        <tr key={crew.user_id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{crew.display_name}</div>
                            <div style={{ fontSize: "11px", opacity: 0.6 }}>
                              ID: {crew.employee_id} | @{crew.username}
                            </div>
                          </td>
                          <td>
                            <div>{crew.role_name}</div>
                            <div style={{ fontSize: "11px", opacity: 0.6 }}>{crew.department}</div>
                          </td>
                          <td>
                            <span className={statusBadgeClass}>{statusText}</span>
                          </td>
                          <td>
                            {crew.is_complete ? (
                              <div>
                                {crew.contract_type} <span style={{ fontSize: "11px", opacity: 0.6 }}>({factor}x)</span>
                              </div>
                            ) : (
                              <span style={{ opacity: 0.4 }}>—</span>
                            )}
                          </td>
                          <td>
                            {crew.is_complete ? (
                              <div style={{ fontWeight: crew.duration_months <= 1 ? 700 : "normal" }}>
                                {crew.duration_months} mo
                              </div>
                            ) : (
                              <span style={{ opacity: 0.4 }}>—</span>
                            )}
                          </td>
                          <td>{formatCurrency(baseSal)}</td>
                          <td>
                            <div style={{ fontWeight: 700, color: "var(--blue-dark)" }}>
                              {formatCurrency(adjustedSal)}
                            </div>
                          </td>
                          <td>
                            <button
                              className="payroll-btn"
                              onClick={() => handleOpenEditModal(crew)}
                            >
                              <i className="fa-solid fa-pen-to-square" /> Edit Contract
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <div className="payroll-action-row">
              <h2 className="hp-font-18-bold">Payroll Submission Runs Ledger</h2>
              <button className="payroll-btn" onClick={loadData}>
                <i className="fa-solid fa-arrows-rotate" /> Refresh Logs
              </button>
            </div>

            <div className="payroll-table-container">
              <table className="payroll-table">
                <thead>
                  <tr>
                    <th>Execution Timestamp</th>
                    <th>Record ID</th>
                    <th>Recipient Crew Count</th>
                    <th>Total Disbursed</th>
                    <th>Processed By</th>
                    <th>Roster Data Details</th>
                    <th>Export Report</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>
                        <i className="fa-solid fa-spinner fa-spin" /> Loading execution history...
                      </td>
                    </tr>
                  ) : payrollHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "32px", opacity: 0.5 }}>
                        No historic payroll submissions registered.
                      </td>
                    </tr>
                  ) : (
                    payrollHistory.map((record) => {
                      const totalAmt = typeof record.total_amount === "number"
                        ? record.total_amount
                        : parseFloat(record.total_amount || "0");
                      return (
                        <tr key={record.payroll_id}>
                          <td>{new Date(record.cycle_date).toLocaleString()}</td>
                          <td style={{ fontSize: "12px", fontFamily: "monospace" }}>{record.payroll_id}</td>
                          <td>{record.crew_count} employees</td>
                          <td style={{ fontWeight: 700, color: "#059669" }}>{formatCurrency(totalAmt)}</td>
                          <td>{record.submitted_by_name}</td>
                          <td>
                            <div className="payroll-details-text">{record.details}</div>
                          </td>
                          <td>
                            <button
                              className="payroll-btn"
                              onClick={() =>
                                handleExportCSV(
                                  record.payroll_id,
                                  `Payroll_Run_${record.payroll_id.slice(0, 8)}_${new Date(record.cycle_date)
                                    .toISOString()
                                    .slice(0, 10)}.csv`
                                )
                              }
                            >
                              <i className="fa-solid fa-file-csv" style={{ color: "#059669" }} /> Export CSV
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {editingCrew && (
          <div className="payroll-modal-overlay" onClick={() => setEditingCrew(null)}>
            <div className="payroll-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="payroll-modal-header">
                Configure Crew Contract settings: {editingCrew.display_name}
              </div>
              <div className="payroll-modal-body">
                <div className="payroll-form-field">
                  <span className="payroll-label">Employee ID</span>
                  <input
                    type="text"
                    className="payroll-input"
                    disabled
                    value={editingCrew.employee_id}
                  />
                </div>

                <div className="payroll-form-field">
                  <span className="payroll-label">Rank / Position Role</span>
                  <input
                    type="text"
                    className="payroll-input"
                    disabled
                    value={editingCrew.role_name}
                  />
                </div>

                <div className="payroll-form-field">
                  <span className="payroll-label">Contract Type Allocation</span>
                  <select
                    className="payroll-select"
                    value={selectedContractType}
                    onChange={(e) => setSelectedContractType(e.target.value)}
                  >
                    <option value="Full-Time">Full-Time (1.0x Factor)</option>
                    <option value="Part-Time">Part-Time (0.5x Factor)</option>
                    <option value="Contractor">Contractor (1.2x Factor)</option>
                    <option value="Temporary">Temporary (0.8x Factor)</option>
                  </select>
                </div>

                <div className="payroll-form-field">
                  <span className="payroll-label">Contract Validity Duration (Months)</span>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    className="payroll-input"
                    value={selectedDuration}
                    onChange={(e) => setSelectedDuration(parseInt(e.target.value) || 12)}
                  />
                </div>

                <div className="payroll-form-field">
                  <span className="payroll-label">Base Monthly Salary Allocation (Rp)</span>
                  <input
                    type="number"
                    min={1}
                    max={50000}
                    className="payroll-input"
                    value={selectedBaseSalary}
                    onChange={(e) => setSelectedBaseSalary(parseFloat(e.target.value) || 3000)}
                  />
                </div>

                <div className="payroll-form-field" style={{ padding: "12px", background: "var(--bg)", borderRadius: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                    <span>Contract Type Adjustment Factor:</span>
                    <strong>{getFactor(selectedContractType)}x</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "14px", fontWeight: 700 }}>
                    <span>Adjusted Monthly Payment preview:</span>
                    <span style={{ color: "var(--blue-dark)" }}>{formatCurrency(selectedBaseSalary * getFactor(selectedContractType))}</span>
                  </div>
                </div>
              </div>
              <div className="payroll-modal-footer">
                <button className="payroll-btn" onClick={() => setEditingCrew(null)}>
                  Cancel
                </button>
                <button className="payroll-btn payroll-btn-primary" onClick={handleSaveContract}>
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Dashboard>
  );
}
