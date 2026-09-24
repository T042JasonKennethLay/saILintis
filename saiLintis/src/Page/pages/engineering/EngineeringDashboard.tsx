import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import { LoadingScreen } from "../../components/LoadingScreen";
import "../../../EngineeringDashboard.css";

interface WorkOrder {
  work_order_id: string;
  title: string;
  description: string;
  equipment: string;
  location: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

interface MaintenanceLog {
  log_id: string;
  work_order_id: string;
  logged_by: string;
  logged_by_name: string;
  notes: string;
  logged_at: string;
}

interface EngineeringStaff {
  account_id: string;
  username: string;
  display_name: string;
  active_tasks: number;
}

interface EngineeringStats {
  open_count: number;
  in_progress_count: number;
  completed_count: number;
  closed_count: number;
  average_resolve_time_hours: number;
  completion_rate: number;
  compliance_rate: number;
}

export function EngineeringDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isManager = loggedInUser.role_name === "Chief Engineer";
  const isStaff = loggedInUser.role_name === "Engineer";
  const hasAccess = isManager || isStaff;

  const [activeItem, setActiveItem] = useState("Engineering Tasks");
  const [activeSection, setActiveSection] = useState("Engineering");

  const [activeTab, setActiveTab] = useState<"orders" | "diagram" | "flow" | "scorecard" | "staff">("orders");

  useEffect(() => {
    if (location.state && (location.state as any).activeTab) {
      setActiveTab((location.state as any).activeTab);
    }
    if (location.state && (location.state as any).openCreateForm) {
      setTimeout(() => {
        const formEl = document.querySelector(".eng-card form");
        if (formEl) {
          formEl.scrollIntoView({ behavior: "smooth" });
          const firstInput = formEl.querySelector("input");
          if (firstInput) firstInput.focus();
        }
      }, 150);
    }
  }, [location.state]);

  useEffect(() => {
    if (activeTab === "orders") {
      setActiveItem(location.state && (location.state as any).openCreateForm ? "Report Malfunction" : "Engineering Tasks");
    } else if (activeTab === "staff") {
      setActiveItem("Staff Directory");
    }
  }, [activeTab, location.state]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [staffList, setStaffList] = useState<EngineeringStaff[]>([]);
  const [stats, setStats] = useState<EngineeringStats>({
    open_count: 0,
    in_progress_count: 0,
    completed_count: 0,
    closed_count: 0,
    average_resolve_time_hours: 0,
    completion_rate: 100,
    compliance_rate: 100,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmAssign, setConfirmAssign] = useState<{
    workOrderId: string;
    workOrderTitle: string;
    staffId: string;
    staffName: string;
  } | null>(null);
  const [showAssignSuccess, setShowAssignSuccess] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newPriority, setNewPriority] = useState("Normal");

  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");

  const [expandedLogs, setExpandedLogs] = useState<Record<string, MaintenanceLog[]>>({});
  const [newLogNotes, setNewLogNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!hasAccess) {
      const timer = setTimeout(() => {
        navigate("/home");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [hasAccess, navigate]);

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const orders = await invoke<WorkOrder[]>("eng_get_work_orders");
      setWorkOrders(orders);

      const statistics = await invoke<EngineeringStats>("eng_get_stats");
      setStats(statistics);

      if (isManager) {
        const staff = await invoke<EngineeringStaff[]>("eng_get_engineering_staff");
        setStaffList(staff);
      }
    } catch (err) {
      setErrorMsg("Failed to load engineering data: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!newTitle.trim() || !newDescription.trim() || !newEquipment.trim() || !newLocation.trim()) {
      setErrorMsg("Please fill out all work order fields.");
      return;
    }

    setLoading(true);
    try {
      await invoke("eng_create_work_order", {
        title: newTitle,
        description: newDescription,
        equipment: newEquipment,
        location: newLocation,
        priority: newPriority,
        userId: loggedInUser.user_id,
      });

      setSuccessMsg("Work order successfully created.");
      setNewTitle("");
      setNewDescription("");
      setNewEquipment("");
      setNewLocation("");
      setNewPriority("Normal");
      await loadData();
    } catch (err) {
      setErrorMsg("Failed to create work order: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSelectChange = (workOrderId: string, workOrderTitle: string, staffId: string) => {
    if (!staffId) {
      setConfirmAssign({
        workOrderId,
        workOrderTitle,
        staffId: "",
        staffName: "None (Unassign)",
      });
      return;
    }
    const staffMember = staffList.find((s) => s.account_id === staffId);
    const staffName = staffMember ? staffMember.display_name : "selected engineer";
    setConfirmAssign({
      workOrderId,
      workOrderTitle,
      staffId,
      staffName,
    });
  };

  const executeAssignment = async (workOrderId: string, staffId: string, staffName: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("eng_assign_work_order", {
        workOrderId,
        staffId: staffId ? staffId : null,
      });
      if (staffId) {
        setShowAssignSuccess(`Work order has been successfully assigned to ${staffName}.`);
      } else {
        setShowAssignSuccess("Work order has been successfully unassigned.");
      }
      await loadData();
    } catch (err) {
      setErrorMsg("Failed to assign work order: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (workOrderId: string, status: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("eng_update_work_order_status", {
        workOrderId,
        status,
      });
      setSuccessMsg(`Work order status updated to ${status}.`);
      await loadData();
    } catch (err) {
      setErrorMsg("Failed to update status: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleLogs = async (workOrderId: string) => {
    if (expandedLogs[workOrderId]) {
      setExpandedLogs((prev) => {
        const copy = { ...prev };
        delete copy[workOrderId];
        return copy;
      });
    } else {
      try {
        const logs = await invoke<MaintenanceLog[]>("eng_get_maintenance_logs", { workOrderId });
        setExpandedLogs((prev) => ({ ...prev, [workOrderId]: logs }));
      } catch (err) {
        setErrorMsg("Failed to load maintenance logs: " + String(err));
      }
    }
  };

  const handleAddLog = async (workOrderId: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    const notes = newLogNotes[workOrderId];
    if (!notes || !notes.trim()) {
      setErrorMsg("Log notes cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      await invoke("eng_add_maintenance_log", {
        workOrderId,
        notes,
        userId: loggedInUser.user_id,
      });

      setSuccessMsg("Maintenance log successfully recorded.");
      setNewLogNotes((prev) => ({ ...prev, [workOrderId]: "" }));
      const logs = await invoke<MaintenanceLog[]>("eng_get_maintenance_logs", { workOrderId });
      setExpandedLogs((prev) => ({ ...prev, [workOrderId]: logs }));
      await loadData();
    } catch (err) {
      setErrorMsg("Failed to record maintenance log: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="eng-dashboard-container">
        <div className="eng-alert eng-alert-error">
          <i className="fa-solid fa-triangle-exclamation" />
          <span>Access Denied. You do not have the required role to view this dashboard. Redirecting to home...</span>
        </div>
      </div>
    );
  }

  const filteredOrders = workOrders.filter((wo) => {
    if (filterStatus !== "All" && wo.status !== filterStatus) return false;
    if (filterPriority !== "All" && wo.priority !== filterPriority) return false;
    if (isStaff && filterStatus === "AssignedToMe" && wo.assigned_to !== loggedInUser.account_id) return false;
    return true;
  });

  const overallPerformanceScore = Math.round((stats.completion_rate + stats.compliance_rate) / 2);

  return (
    <Dashboard
      activeItem={activeItem}
      activeSection={activeSection}
      setActiveItem={setActiveItem}
      setActiveSection={setActiveSection}
    >
      <div className="eng-dashboard-container">
        {errorMsg && (
          <div className="eng-alert eng-alert-error">
            <i className="fa-solid fa-circle-xmark" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="eng-alert eng-alert-success">
            <i className="fa-solid fa-circle-check" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="eng-header-section">
          <div className="eng-title-area">
            <h1>Engineering Division Dashboard</h1>
            <p>Monitor ship mechanics, resolve reported equipment malfunctions, and maintain logging standards.</p>
          </div>
          <div className="eng-role-badge">{loggedInUser.role_name}</div>
        </div>

        <div className="eng-stats-grid">
          <div className="eng-stat-card">
            <div className="eng-stat-icon-wrapper open">
              <i className="fa-solid fa-folder-open" />
            </div>
            <div className="eng-stat-info">
              <span className="eng-stat-value">{stats.open_count}</span>
              <span className="eng-stat-label">Open Issues</span>
            </div>
          </div>
          <div className="eng-stat-card">
            <div className="eng-stat-icon-wrapper progress">
              <i className="fa-solid fa-spinner" />
            </div>
            <div className="eng-stat-info">
              <span className="eng-stat-value">{stats.in_progress_count}</span>
              <span className="eng-stat-label">In Progress</span>
            </div>
          </div>
          <div className="eng-stat-card">
            <div className="eng-stat-icon-wrapper completed">
              <i className="fa-solid fa-check-double" />
            </div>
            <div className="eng-stat-info">
              <span className="eng-stat-value">{stats.completed_count}</span>
              <span className="eng-stat-label">Completed Repairs</span>
            </div>
          </div>
          <div className="eng-stat-card">
            <div className="eng-stat-icon-wrapper closed">
              <i className="fa-solid fa-lock" />
            </div>
            <div className="eng-stat-info">
              <span className="eng-stat-value">{stats.closed_count}</span>
              <span className="eng-stat-label">Closed Archive</span>
            </div>
          </div>
          <div className="eng-stat-card">
            <div className="eng-stat-icon-wrapper compliance">
              <i className="fa-solid fa-clipboard-check" />
            </div>
            <div className="eng-stat-info">
              <span className="eng-stat-value">{overallPerformanceScore}%</span>
              <span className="eng-stat-label">KPI Performance</span>
            </div>
          </div>
        </div>

        <div className="eng-navigation-tabs">
          <button
            className={`eng-tab-button ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            <i className="fa-solid fa-screwdriver-wrench" /> Work Orders
          </button>
          {isManager && (
            <button
              className={`eng-tab-button ${activeTab === "staff" ? "active" : ""}`}
              onClick={() => setActiveTab("staff")}
            >
              <i className="fa-solid fa-people-carry-box" /> Staff Directory
            </button>
          )}
        </div>

        {activeTab === "orders" && (
          <div className={isManager ? "eng-content-full" : "eng-content-split"}>
            <div>
              <div className="eng-card">
                <div className="eng-card-header">
                  <h2>Active Work Orders</h2>
                  <div className="eng-filter-row">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="eng-select"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Closed">Closed</option>
                      {isStaff && <option value="AssignedToMe">Assigned to Me</option>}
                    </select>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="eng-select"
                    >
                      <option value="All">All Priorities</option>
                      <option value="High">High</option>
                      <option value="Normal">Normal</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="eng-work-orders-list">
                  {filteredOrders.length === 0 ? (
                    <div className="eng-empty-state">
                      <i className="fa-solid fa-hard-drive" />
                      <p>No work orders match current filter criteria.</p>
                    </div>
                  ) : (
                    filteredOrders.map((wo) => (
                      <div key={wo.work_order_id} className="eng-work-order-item">
                        <div className="eng-wo-top">
                          <div className="eng-wo-title-box">
                            <h3>{wo.title}</h3>
                            <div className="eng-badges">
                              <span className={`eng-badge priority-${wo.priority.toLowerCase()}`}>
                                {wo.priority}
                              </span>
                              <span className={`eng-badge status-${wo.status.toLowerCase().replace(" ", "-")}`}>
                                {wo.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="eng-wo-desc">{wo.description}</p>

                        <div className="eng-wo-meta-grid">
                          <div className="eng-meta-item">
                            <i className="fa-solid fa-gears" />
                            Equipment: <span>{wo.equipment}</span>
                          </div>
                          <div className="eng-meta-item">
                            <i className="fa-solid fa-location-dot" />
                            Location: <span>{wo.location}</span>
                          </div>
                          <div className="eng-meta-item">
                            <i className="fa-solid fa-user-pen" />
                            Created By: <span>{wo.created_by_name}</span>
                          </div>
                          <div className="eng-meta-item">
                            <i className="fa-solid fa-user-check" />
                            Assigned To: <span>{wo.assigned_to_name || "Unassigned"}</span>
                          </div>
                          <div className="eng-meta-item">
                            <i className="fa-solid fa-calendar-day" />
                            Reported: <span>{new Date(wo.created_at).toLocaleString()}</span>
                          </div>
                          <div className="eng-meta-item">
                            <i className="fa-solid fa-clock-rotate-left" />
                            Updated: <span>{new Date(wo.updated_at).toLocaleString()}</span>
                          </div>
                          {wo.closed_at && (
                            <div className="eng-meta-item">
                              <i className="fa-solid fa-lock" />
                              Closed At: <span>{new Date(wo.closed_at).toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        <div className="eng-wo-actions">
                          <button
                            type="button"
                            className="eng-btn eng-btn-secondary"
                            onClick={() => toggleLogs(wo.work_order_id)}
                          >
                            <i className="fa-solid fa-receipt" />
                            {expandedLogs[wo.work_order_id] ? "Hide Logs" : "View Logs"}
                          </button>

                          {isManager && wo.status !== "Closed" && (
                            <div className="eng-assignment-box">
                              <i className="fa-solid fa-user-gear" />
                              <select
                                className="eng-staff-select"
                                value={wo.assigned_to || ""}
                                onChange={(e) => handleAssignSelectChange(wo.work_order_id, wo.title, e.target.value)}
                              >
                                <option value="">Select Assignee</option>
                                {staffList.map((s) => (
                                  <option key={s.account_id} value={s.account_id}>
                                    {s.display_name} ({s.active_tasks} active tasks)
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {isManager && wo.status === "Completed" && (
                            <button
                              type="button"
                              className="eng-btn eng-btn-primary"
                              onClick={() => handleUpdateStatus(wo.work_order_id, "Closed")}
                            >
                              <i className="fa-solid fa-box-archive" /> Close Work Order
                            </button>
                          )}

                          {isStaff && wo.assigned_to === loggedInUser.account_id && wo.status === "Open" && (
                            <button
                              type="button"
                              className="eng-btn eng-btn-primary"
                              onClick={() => handleUpdateStatus(wo.work_order_id, "In Progress")}
                            >
                              <i className="fa-solid fa-play" /> Start Repair
                            </button>
                          )}

                          {isStaff && wo.assigned_to === loggedInUser.account_id && wo.status === "In Progress" && (
                            <button
                              type="button"
                              className="eng-btn eng-btn-primary"
                              onClick={() => handleUpdateStatus(wo.work_order_id, "Completed")}
                            >
                              <i className="fa-solid fa-check" /> Mark Completed
                            </button>
                          )}
                        </div>

                        {expandedLogs[wo.work_order_id] && (
                          <div className="eng-logs-container">
                            <div className="eng-logs-title">
                              <span>Maintenance Activities</span>
                              <span>{expandedLogs[wo.work_order_id].length} Logs</span>
                            </div>
                            <div className="eng-log-list">
                              {expandedLogs[wo.work_order_id].length === 0 ? (
                                <p className="eng-empty-state" style={{ padding: "10px", fontSize: "12px" }}>
                                  No activities logged yet.
                                </p>
                              ) : (
                                expandedLogs[wo.work_order_id].map((log) => (
                                  <div key={log.log_id} className="eng-log-item">
                                    <div>{log.notes}</div>
                                    <div className="eng-log-meta">
                                      Logged by <span>{log.logged_by_name}</span> at {new Date(log.logged_at).toLocaleString()}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            {wo.status !== "Closed" && (
                              <div className="eng-add-log-box">
                                <input
                                  type="text"
                                  placeholder="Record maintenance work notes..."
                                  value={newLogNotes[wo.work_order_id] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewLogNotes((prev) => ({ ...prev, [wo.work_order_id]: val }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAddLog(wo.work_order_id);
                                  }}
                                />
                                <button
                                  type="button"
                                  className="eng-btn eng-btn-primary"
                                  style={{ padding: "6px 12px" }}
                                  onClick={() => handleAddLog(wo.work_order_id)}
                                >
                                  Add Log
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {!isManager && (
              <div>
                <div className="eng-card">
                  <div className="eng-card-header">
                    <h2>Report Equipment Malfunction</h2>
                  </div>
                  <form onSubmit={handleCreateWorkOrder}>
                    <div className="eng-form-group">
                      <label>Task Title / Subject</label>
                      <input
                        type="text"
                        className="eng-input"
                        placeholder="e.g. Engine Room #2 Generator Noise"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="eng-form-group">
                      <label>Malfunctioning Equipment</label>
                      <input
                        type="text"
                        className="eng-input"
                        placeholder="e.g. Diesel Engine Unit 2"
                        value={newEquipment}
                        onChange={(e) => setNewEquipment(e.target.value)}
                        required
                      />
                    </div>
                    <div className="eng-form-group">
                      <label>Malfunction Location</label>
                      <input
                        type="text"
                        className="eng-input"
                        placeholder="e.g. Lower Deck, Room D-4"
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        required
                      />
                    </div>
                    <div className="eng-form-group">
                      <label>Priority</label>
                      <select
                        className="eng-select"
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value)}
                      >
                        <option value="Low">Low (Routine maintenance)</option>
                        <option value="Normal">Normal (Standard repair)</option>
                        <option value="High">High (Immediate inspection needed)</option>
                      </select>
                    </div>
                    <div className="eng-form-group">
                      <label>Description of Issue</label>
                      <textarea
                        className="eng-textarea"
                        placeholder="Detail symptoms, warning lights, sound descriptors, or any preliminary troubleshooting details."
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="eng-btn eng-btn-primary" style={{ width: "100%" }}>
                      <i className="fa-solid fa-bullhorn" /> Create Work Order
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "staff" && isManager && (
          <div className="eng-card">
            <div className="eng-card-header">
              <h2>Engineering Staff Directory</h2>
            </div>
            <div className="it-table-container">
              <table className="it-table">
                <thead>
                  <tr>
                    <th>Display Name</th>
                    <th>Username</th>
                    <th>Account ID</th>
                    <th>Current Task Load</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => (
                    <tr key={s.account_id}>
                      <td><strong>{s.display_name}</strong></td>
                      <td>@{s.username}</td>
                      <td>{s.account_id}</td>
                      <td>
                        <span className={`it-badge ${s.active_tasks > 3 ? "it-badge-danger" : "it-badge-success"}`}>
                          {s.active_tasks} Active Work Orders
                        </span>
                      </td>
                    </tr>
                  ))}
                  {staffList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="eng-empty-state">
                        No active engineering staff accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <LoadingScreen visible={loading} />

        {confirmAssign && (
          <div className="it-modal-overlay ps-emergency-overlay">
            <div className="it-modal-card ps-modal-confirm hp-premium-modal-card">
              <div className="hp-premium-modal-header">
                <div className="hp-premium-modal-icon-container success-blue">
                  <i className="fa-solid fa-user-check" />
                </div>
                <h3 className="hp-premium-modal-title">Confirm Assignment</h3>
              </div>
              <div className="it-modal-body hp-premium-modal-body-text">
                <p className="ps-modal-body-text" style={{ margin: 0 }}>
                  Are you sure you want to assign work order <strong>{confirmAssign.workOrderTitle}</strong> to <strong>{confirmAssign.staffName}</strong>?
                </p>
              </div>
              <div className="it-modal-footer" style={{ justifyContent: "center", gap: "12px", padding: 0 }}>
                <button
                  type="button"
                  className="it-btn hp-premium-modal-btn-cancel"
                  onClick={() => setConfirmAssign(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="it-btn ps-btn-modal-confirm hp-premium-modal-btn-confirm"
                  onClick={() => {
                    const target = confirmAssign;
                    setConfirmAssign(null);
                    executeAssignment(target.workOrderId, target.staffId, target.staffName);
                  }}
                >
                  Confirm Assign
                </button>
              </div>
            </div>
          </div>
        )}

        {showAssignSuccess && (
          <div className="it-modal-overlay ps-emergency-overlay">
            <div className="it-modal-card ps-modal-confirm hp-premium-modal-card">
              <div className="hp-premium-modal-header">
                <div className="hp-premium-modal-icon-container success-green">
                  <i className="fa-solid fa-circle-check" />
                </div>
                <h3 className="hp-premium-modal-title">Assignment Updated</h3>
              </div>
              <div className="it-modal-body hp-premium-modal-body-text">
                <p className="ps-modal-body-text" style={{ margin: 0 }}>{showAssignSuccess}</p>
              </div>
              <div className="it-modal-footer" style={{ justifyContent: "center", padding: 0 }}>
                <button
                  type="button"
                  className="it-btn ps-btn-modal-confirm hp-premium-modal-btn-done"
                  onClick={() => setShowAssignSuccess(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Dashboard>
  );
}

