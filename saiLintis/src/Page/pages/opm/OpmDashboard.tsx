import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import "../../../OpmDashboard.css";

interface Passenger {
  passenger_id: string;
  display_name: string;
  email: string;
  status: string;
  cabin_number: string | null;
  checkin_status: string;
  checkin_time: string | null;
}

interface TimelineEvent {
  id: number;
  passenger_id: string;
  display_name: string;
  checkin_status: string;
  created_at: string;
}

interface StaffSchedule {
  id: number;
  employee_name: string;
  role_name: string;
  shift_date: string;
  shift_hours: string;
  position: string;
  status: string;
  requested_by: string;
  created_at: string;
}

interface EscalatedIncident {
  incident_id: string;
  incident_type: string;
  description: string;
  location: string;
  severity: string;
  status: string;
  created_at: string;
}

export function OpmDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [activeTab, setActiveTab] = useState("passengers");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [escalatedList, setEscalatedList] = useState<EscalatedIncident[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [escalateDesc, setEscalateDesc] = useState("");
  const [escalateLoc, setEscalateLoc] = useState("");
  const [escalateSev, setEscalateSev] = useState("Medium");
  const [submittingEscalation, setSubmittingEscalation] = useState(false);

  const [selectedRole, setSelectedRole] = useState("Housekeeping Staff");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [staffList, setStaffList] = useState<string[]>([]);
  const [shiftDate, setShiftDate] = useState("");
  const [shiftHours, setShiftHours] = useState("08:00 - 16:00");
  const [assignedPosition, setAssignedPosition] = useState("");
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPassengers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<Passenger[]>("opm_get_passenger_checkin_status");
      setPassengers(data);
    } catch (e) {
      showToast("error", String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<TimelineEvent[]>("opm_get_boarding_timeline");
      setTimeline(data);
    } catch (e) {
      showToast("error", String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<StaffSchedule[]>("opm_get_staff_schedules");
      setSchedules(data);
    } catch (e) {
      showToast("error", String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async (roleName: string) => {
    try {
      const list = await invoke<string[]>("opm_get_employees_by_role", { roleName });
      if (list && list.length > 0) {
        setStaffList(list);
        setSelectedStaff(list[0]);
      } else {
        const fallbacks: Record<string, string[]> = {
          "Housekeeping Staff": ["John Doe", "Alice Clean", "David Sweep"],
          "Entertainment Staff": ["Bob Miller", "Clara Singer", "Ethan Dancer"],
        };
        const fb = fallbacks[roleName] || [];
        setStaffList(fb);
        if (fb.length > 0) {
          setSelectedStaff(fb[0]);
        }
      }
    } catch (e) {
      const fallbacks: Record<string, string[]> = {
        "Housekeeping Staff": ["John Doe", "Alice Clean", "David Sweep"],
        "Entertainment Staff": ["Bob Miller", "Clara Singer", "Ethan Dancer"],
      };
      const fb = fallbacks[roleName] || [];
      setStaffList(fb);
      if (fb.length > 0) {
        setSelectedStaff(fb[0]);
      }
    }
  }, []);

  const loadEscalatedIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const all = await invoke<EscalatedIncident[]>("get_overnight_incidents");
      const filtered = all.filter(inc => inc.incident_type === "Operational Escalation");
      setEscalatedList(filtered);
    } catch (e) {
      showToast("error", String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "passengers") {
      loadPassengers();
    } else if (activeTab === "timeline") {
      loadTimeline();
    } else if (activeTab === "schedules") {
      loadSchedules();
      loadEmployees(selectedRole);
    } else if (activeTab === "escalations") {
      loadEscalatedIncidents();
    }
  }, [activeTab, loadPassengers, loadTimeline, loadSchedules, loadEscalatedIncidents, selectedRole, loadEmployees]);

  const handleCreateStaffShiftDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !shiftDate || !assignedPosition.trim()) {
      showToast("error", "All fields are required");
      return;
    }
    setIsSubmittingShift(true);
    try {
      const msg = await invoke<string>("opm_create_staff_schedule", {
        payload: {
          employee_name: selectedStaff,
          role_name: selectedRole,
          shift_date: shiftDate,
          shift_hours: shiftHours,
          position: assignedPosition.trim(),
          requested_by: "Operations Manager",
        }
      });
      showToast("success", msg);
      setAssignedPosition("");
      loadSchedules();
    } catch (err) {
      showToast("error", String(err));
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const handleMakeFinalCall = async () => {
    setLoading(true);
    try {
      const msg = await invoke<string>("opm_make_final_call_announcement", { senderId: user.account_id || user.user_id });
      showToast("success", msg);
    } catch (e) {
      showToast("error", String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateScheduleStatus = async (id: number, status: string) => {
    setLoading(true);
    try {
      const msg = await invoke<string>("opm_update_staff_schedule_status", { id, status });
      showToast("success", msg);
      loadSchedules();
    } catch (e) {
      showToast("error", String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleEscalateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateDesc.trim() || !escalateLoc.trim()) {
      showToast("error", "Description and location are required");
      return;
    }
    setSubmittingEscalation(true);
    try {
      const msg = await invoke<string>("opm_escalate_operational_issue", {
        payload: {
          description: escalateDesc.trim(),
          location: escalateLoc.trim(),
          severity: escalateSev,
          submitted_by: user.account_id || user.user_id,
        }
      });
      showToast("success", msg);
      setEscalateDesc("");
      setEscalateLoc("");
      setEscalateSev("Medium");
      loadEscalatedIncidents();
    } catch (err) {
      showToast("error", String(err));
    } finally {
      setSubmittingEscalation(false);
    }
  };

  const filteredPassengers = passengers.filter(p =>
    p.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.cabin_number && p.cabin_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dashboard activeItem="Operations Console" activeSection="Overview" setActiveItem={() => {}} setActiveSection={() => {}}>
      <div className="opm-dashboard-container">
        {toast && (
          <div className={`opm-toast ${toast.type === "success" ? "opm-toast-success" : "opm-toast-error"}`}>
            <i className={toast.type === "success" ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"} />
            <span>{toast.msg}</span>
          </div>
        )}

        <div className="opm-header-card">
          <div className="opm-header-details">
            <h1 className="opm-dashboard-title">Operations Management Console</h1>
            <p className="opm-dashboard-subtitle">Monitor passenger boarding status, check-in timelines, staff schedule schedules, and escalate operational alerts.</p>
          </div>
          <div className="opm-header-actions">
            <button className="opm-btn opm-btn-danger" onClick={handleMakeFinalCall} disabled={loading}>
              <i className="fa-solid fa-bullhorn" /> Make Final Call
            </button>
          </div>
        </div>

        <div className="opm-tabs-row">
          <button className={`opm-tab-btn ${activeTab === "passengers" ? "active" : ""}`} onClick={() => setActiveTab("passengers")}>
            <i className="fa-solid fa-users" /> Passenger Status
          </button>
          <button className={`opm-tab-btn ${activeTab === "timeline" ? "active" : ""}`} onClick={() => setActiveTab("timeline")}>
            <i className="fa-solid fa-clock-rotate-left" /> Boarding Timeline
          </button>
          <button className={`opm-tab-btn ${activeTab === "schedules" ? "active" : ""}`} onClick={() => setActiveTab("schedules")}>
            <i className="fa-solid fa-calendar-check" /> Staff Schedules
          </button>
          <button className={`opm-tab-btn ${activeTab === "escalations" ? "active" : ""}`} onClick={() => setActiveTab("escalations")}>
            <i className="fa-solid fa-triangle-exclamation" /> Operational Escalations
          </button>
        </div>

        <div className="opm-tab-content">
          {activeTab === "passengers" && (
            <div className="opm-card">
              <div className="opm-card-header">
                <div className="opm-search-wrapper">
                  <i className="fa-solid fa-magnifying-glass search-icon" />
                  <input
                    type="text"
                    placeholder="Search passenger name, email, or cabin..."
                    className="opm-search-input"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <button className="opm-btn opm-btn-outline" onClick={loadPassengers} disabled={loading}>
                  <i className="fa-solid fa-rotate" /> Refresh
                </button>
              </div>

              <div className="opm-table-responsive">
                <table className="opm-table">
                  <thead>
                    <tr>
                      <th>Passenger Name</th>
                      <th>Email Address</th>
                      <th>Cabin</th>
                      <th>Class Status</th>
                      <th>Check-in Status</th>
                      <th>Last Checked At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPassengers.map(p => (
                      <tr key={p.passenger_id}>
                        <td>
                          <div className="opm-passenger-name-cell">
                            <i className="fa-solid fa-user passenger-avatar-icon" />
                            <span>{p.display_name}</span>
                          </div>
                        </td>
                        <td>{p.email}</td>
                        <td>{p.cabin_number || <span className="opm-text-muted">Unassigned</span>}</td>
                        <td>
                          <span className={`opm-badge ${p.status.toLowerCase() === "vip" ? "opm-badge-vip" : "opm-badge-normal"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td>
                          <span className={`opm-badge ${
                            p.checkin_status === "Checked In" ? "opm-badge-checkin" :
                            p.checkin_status === "Checked Out" ? "opm-badge-checkout" :
                            "opm-badge-notcheckin"
                          }`}>
                            {p.checkin_status}
                          </span>
                        </td>
                        <td>{p.checkin_time ? formatDate(p.checkin_time) : <span className="opm-text-muted">—</span>}</td>
                      </tr>
                    ))}
                    {filteredPassengers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="opm-table-empty">
                          No passengers found matching search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="opm-card">
              <div className="opm-card-header">
                <h3 className="opm-card-title">Real-time Passenger Boarding Logs</h3>
                <button className="opm-btn opm-btn-outline" onClick={loadTimeline} disabled={loading}>
                  <i className="fa-solid fa-rotate" /> Refresh
                </button>
              </div>
              <div className="opm-timeline">
                {timeline.map(event => (
                  <div key={event.id} className="opm-timeline-item">
                    <div className={`opm-timeline-marker ${event.checkin_status === "Checked In" ? "checkin" : "checkout"}`} />
                    <div className="opm-timeline-content">
                      <div className="opm-timeline-header">
                        <span className="opm-timeline-user">{event.display_name}</span>
                        <span className="opm-timeline-time">{formatDate(event.created_at)}</span>
                      </div>
                      <p className="opm-timeline-desc">
                        Passenger successfully <strong>{event.checkin_status.toLowerCase()}</strong> the vessel.
                      </p>
                    </div>
                  </div>
                ))}
                {timeline.length === 0 && (
                  <div className="opm-empty-state">
                    <i className="fa-solid fa-timeline" />
                    <p>No boarding events recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "schedules" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr", gap: "24px" }}>
              <div className="opm-card">
                <h3 className="opm-card-title" style={{ marginBottom: "15px" }}>Direct Shift Assignment</h3>
                <p className="opm-card-subtitle" style={{ margin: "4px 0 16px 0" }}>Schedule and assign a shift directly for an employee.</p>
                <form onSubmit={handleCreateStaffShiftDirect} className="opm-form">
                  <div className="opm-form-group">
                    <label className="opm-label">Department Role</label>
                    <select
                      className="opm-select-box"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      required
                    >
                      <option value="Housekeeping Staff">Housekeeping Staff</option>
                      <option value="Entertainment Staff">Entertainment Staff</option>
                    </select>
                  </div>
                  <div className="opm-form-group">
                    <label className="opm-label">Employee Name</label>
                    <select
                      className="opm-select-box"
                      value={selectedStaff}
                      onChange={(e) => setSelectedStaff(e.target.value)}
                      required
                    >
                      {staffList.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="opm-form-group">
                    <label className="opm-label">Shift Date</label>
                    <input
                      type="date"
                      className="opm-input"
                      value={shiftDate}
                      onChange={(e) => setShiftDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="opm-form-group">
                    <label className="opm-label">Working Hours</label>
                    <select
                      className="opm-select-box"
                      value={shiftHours}
                      onChange={(e) => setShiftHours(e.target.value)}
                      required
                    >
                      <option value="08:00 - 16:00">08:00 - 16:00</option>
                      <option value="12:00 - 20:00">12:00 - 20:00</option>
                      <option value="16:00 - 24:00">16:00 - 24:00</option>
                      <option value="20:00 - 04:00">20:00 - 04:00</option>
                    </select>
                  </div>
                  <div className="opm-form-group">
                    <label className="opm-label">Assigned Position / Duty</label>
                    <input
                      type="text"
                      className="opm-input"
                      value={assignedPosition}
                      onChange={(e) => setAssignedPosition(e.target.value)}
                      placeholder="e.g. Lobby Cleaning / Sound Check"
                      required
                    />
                  </div>
                  <button type="submit" className="opm-btn opm-btn-primary" style={{ width: "100%", marginTop: "10px" }} disabled={isSubmittingShift}>
                    {isSubmittingShift ? "Assigning..." : "Assign Shift"}
                  </button>
                </form>
              </div>

              <div className="opm-card">
                <div className="opm-card-header">
                  <h3 className="opm-card-title">Daily Shift Schedule Requests</h3>
                  <button className="opm-btn opm-btn-outline" onClick={loadSchedules} disabled={loading}>
                    <i className="fa-solid fa-rotate" /> Refresh
                  </button>
                </div>

                <div className="opm-table-responsive">
                  <table className="opm-table">
                    <thead>
                      <tr>
                        <th>Employee Name</th>
                        <th>Department Role</th>
                        <th>Requested By</th>
                        <th>Shift Date</th>
                        <th>Working Hours</th>
                        <th>Assigned Position</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map(sch => {
                        const hasClash = sch.status === "Pending" && schedules.some(s =>
                          s.employee_name === sch.employee_name &&
                          s.shift_date === sch.shift_date &&
                          s.status === "Approved"
                        );
                        return (
                          <tr key={sch.id}>
                            <td><strong>{sch.employee_name}</strong></td>
                            <td>{sch.role_name}</td>
                            <td>{sch.requested_by}</td>
                            <td>{sch.shift_date}</td>
                            <td>{sch.shift_hours}</td>
                            <td>{sch.position}</td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                                <span className={`opm-badge ${
                                  sch.status === "Approved" ? "opm-badge-checkin" :
                                  sch.status === "Rejected" ? "opm-badge-checkout" :
                                  "opm-badge-pending"
                                }`}>
                                  {sch.status}
                                </span>
                                {hasClash && (
                                  <span className="opm-badge opm-badge-clash" title="Already scheduled on this date">
                                    <i className="fa-solid fa-triangle-exclamation" /> Clash
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {sch.status === "Pending" ? (
                                <div className="opm-actions-cell">
                                  <button className="opm-btn opm-btn-success opm-btn-xs" onClick={() => handleUpdateScheduleStatus(sch.id, "Approved")} disabled={hasClash}>
                                    <i className="fa-solid fa-check" /> Approve
                                  </button>
                                  <button className="opm-btn opm-btn-danger-outline opm-btn-xs" onClick={() => handleUpdateScheduleStatus(sch.id, "Rejected")}>
                                    <i className="fa-solid fa-xmark" /> Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="opm-text-muted">No Action Needed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {schedules.length === 0 && (
                        <tr>
                          <td colSpan={8} className="opm-table-empty">
                            No daily shift request schedules recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "escalations" && (
            <div className="opm-escalate-layout">
              <div className="opm-card opm-escalate-form-card">
                <h3 className="opm-card-title">Escalate New Operational Incident</h3>
                <p className="opm-card-subtitle">Directly escalate emergencies or unresolved operations issues to the Cruise Operations Director and Ship Captain.</p>
                <form onSubmit={handleEscalateIssue} className="opm-form">
                  <div className="opm-form-group">
                    <label className="opm-label">Issue Location / Context</label>
                    <input
                      type="text"
                      className="opm-input"
                      placeholder="e.g. Port Docking Area / Gangway B"
                      value={escalateLoc}
                      onChange={e => setEscalateLoc(e.target.value)}
                      required
                    />
                  </div>

                  <div className="opm-form-group">
                    <label className="opm-label">Severity Level</label>
                    <select className="opm-select-box" value={escalateSev} onChange={e => setEscalateSev(e.target.value)}>
                      <option value="Low">Low Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="High">High Severity</option>
                      <option value="Critical">Critical Incident</option>
                    </select>
                  </div>

                  <div className="opm-form-group">
                    <label className="opm-label">Escalation Description</label>
                    <textarea
                      rows={4}
                      className="opm-textarea"
                      placeholder="Provide detailed information regarding the delay, malfunction, or operational risk..."
                      value={escalateDesc}
                      onChange={e => setEscalateDesc(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="opm-btn opm-btn-primary" disabled={submittingEscalation}>
                    {submittingEscalation ? (
                      <><i className="fa-solid fa-spinner fa-spin" /> Submitting Escalation...</>
                    ) : (
                      <><i className="fa-solid fa-triangle-exclamation" /> Escalate Operational Issue</>
                    )}
                  </button>
                </form>
              </div>

              <div className="opm-card opm-escalate-history-card">
                <h3 className="opm-card-title">Escalated Incidents History</h3>
                <div className="opm-escalation-history-list">
                  {escalatedList.map(inc => (
                    <div key={inc.incident_id} className="opm-history-card">
                      <div className="opm-history-header">
                        <span className={`opm-badge ${
                          inc.severity === "Critical" || inc.severity === "High" ? "opm-badge-checkout" : "opm-badge-pending"
                        }`}>
                          {inc.severity}
                        </span>
                        <span className="opm-history-time">{formatDate(inc.created_at)}</span>
                      </div>
                      <p className="opm-history-loc">
                        <i className="fa-solid fa-location-dot" /> <strong>{inc.location}</strong>
                      </p>
                      <p className="opm-history-desc">{inc.description}</p>
                      <div className="opm-history-footer">
                        <span>Status: <strong>{inc.status}</strong></span>
                      </div>
                    </div>
                  ))}
                  {escalatedList.length === 0 && (
                    <div className="opm-empty-state">
                      <i className="fa-solid fa-folder-open" />
                      <p>No operational issues escalated yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dashboard>
  );
}
