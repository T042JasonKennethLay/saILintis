import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import { LoadingScreen } from "../../components/LoadingScreen";
import "../../../ItDashboard.css";

const AVAILABLE_MODULES = [
  "self_registration",
  "profile_management",
  "performance_booking",
  "restaurant_reservation",
  "medical_request_submission",
  "onboard_spending_view",
  "complaint_submission",
  "in_app_chat_passenger",
  "notification_management",
  "cabin_service_request"
];

export function ItDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isITAdmin = user.role_name === "IT Admin";

  const [activeItem, setActiveItem] = useState<string>(
    (location.state as any)?.activeItem || "User Management"
  );
  const [activeSection, setActiveSection] = useState("IT Administration");

  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [backupLogs, setBackupLogs] = useState<any[]>([]);
  const [shortlistedCandidates, setShortlistedCandidates] = useState<any[]>([]);
  const [processingCandidateId, setProcessingCandidateId] = useState<string | null>(null);

  const [regDisplayName, setRegDisplayName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmployeeId, setRegEmployeeId] = useState("");
  const [regRoleId, setRegRoleId] = useState("");

  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleId, setNewRoleId] = useState("");

  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [accessibleModules, setAccessibleModules] = useState<string[]>([]);
  const [readOnlyModules, setReadOnlyModules] = useState<string[]>([]);
  const [restrictedModules, setRestrictedModules] = useState<string[]>([]);

  const [investigatedLog, setInvestigatedLog] = useState<any>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveDir, setSaveDir] = useState<string>("");

  useEffect(() => {
    const fetchDefaultDir = async () => {
      try {
        const dir = await invoke<string>("get_default_download_dir");
        setSaveDir(dir);
      } catch (err) {
        console.error("Failed to get default download dir:", err);
      }
    };
    fetchDefaultDir();
  }, []);

  const handleChangeDirectory = async () => {
    try {
      const selected = await invoke<string | null>("select_directory", { defaultDir: saveDir || null });
      if (selected) {
        setSaveDir(selected);
      }
    } catch (err) {
      setErrorMsg("Failed to select directory: " + String(err));
    }
  };


  useEffect(() => {
    if (!isITAdmin) {
      const timer = setTimeout(() => {
        navigate("/home");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isITAdmin, navigate]);

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  useEffect(() => {
    if (isITAdmin) {
      loadInitialData();
      if (activeItem === "Register Account") {
        setRegPassword(generateRandomPassword());
      }
    }
  }, [isITAdmin, activeItem]);

  const loadInitialData = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      if (activeItem === "User Management") {
        const empList = await invoke<any[]>("list_employee_accounts");
        setEmployees(empList);
        const roleList = await invoke<any[]>("get_roles");
        setRoles(roleList);
      } else if (activeItem === "Register Account") {
        const roleList = await invoke<any[]>("get_roles");
        const employeeRoles = roleList.filter((r) => r.role_name !== "Passenger");
        setRoles(employeeRoles);
        if (employeeRoles.length > 0 && !regRoleId) {
          setRegRoleId(employeeRoles[0].role_id);
        }
        const candidateList = await invoke<any[]>("list_candidates", { vacancyId: null });
        const shortlisted = candidateList.filter((c: any) => c.status === "Shortlisted");
        setShortlistedCandidates(shortlisted);
      } else if (activeItem === "Role Management") {
        const roleList = await invoke<any[]>("get_roles");
        setRoles(roleList);
        if (roleList.length > 0) {
          if (!selectedRole) {
            setSelectedRole(roleList[0]);
            loadRoleConfig(roleList[0]);
          } else {
            const found = roleList.find(r => r.role_id === selectedRole.role_id);
            if (found) {
              setSelectedRole(found);
            }
          }
        }
      } else if (activeItem === "System Logs") {
        const sysLogs = await invoke<any[]>("list_system_logs");
        setLogs(sysLogs);
        const pendingResets = await invoke<any[]>("list_password_reset_requests");
        setResetRequests(pendingResets);
      } else if (activeItem === "Backup System") {
        const dbBackupLogs = await invoke<any[]>("list_backup_logs");
        setBackupLogs(dbBackupLogs);
      }
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadRoleConfig = (role: any) => {
    const modulesAccess = Array.isArray(role.accessible_modules) ? role.accessible_modules : [];
    setAccessibleModules(modulesAccess);
    setReadOnlyModules([]);
    setRestrictedModules([]);
  };

  const handleProcessCandidateRegistration = (candidate: any) => {
    setRegDisplayName(candidate.full_name);
    setRegEmail(candidate.email);
    const matchingRole = roles.find(
      (r) => r.role_name.toLowerCase() === candidate.assigned_capacity?.toLowerCase()
    );
    if (matchingRole) {
      setRegRoleId(matchingRole.role_id);
    }
    setProcessingCandidateId(candidate.candidate_id);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    
    const selectedRole = roles.find((r) => r.role_id === regRoleId);
    if (selectedRole && selectedRole.role_name === "Passenger") {
      setErrorMsg("Cannot register passenger accounts through IT dashboard");
      setLoading(false);
      return;
    }

    try {
      await invoke("create_employee_account", {
        payload: {
          display_name: regDisplayName,
          email: regEmail,
          password: regPassword,
          username: regUsername,
          employee_id: regEmployeeId,
          role_id: regRoleId,
        },
      });

      if (processingCandidateId) {
        await invoke("screen_candidate", {
          payload: {
            candidate_id: processingCandidateId,
            status: "Account Created",
            assigned_voyage: null,
            assigned_capacity: null,
            user_id: user.user_id,
          },
        });
        setProcessingCandidateId(null);
      }

      setSuccessMsg("Account successfully registered!");
      setRegDisplayName("");
      setRegEmail("");
      setRegUsername("");
      setRegPassword(generateRandomPassword());
      setRegEmployeeId("");
      await loadInitialData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (accountId: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("deactivate_employee_account", {
        payload: { account_id: accountId },
      });
      setSuccessMsg("Account deactivated successfully!");
      await loadInitialData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async (accountId: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("reactivate_employee_account", { accountId });
      setSuccessMsg("Account reactivated successfully!");
      await loadInitialData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const openRoleEdit = (emp: any) => {
    setSelectedEmployee(emp);
    setNewRoleId(emp.role_id || "");
    setShowRoleModal(true);
  };

  const handleUpdateRole = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("update_employee_role", {
        payload: {
          account_id: selectedEmployee.account_id,
          role_id: newRoleId,
        },
      });
      setSuccessMsg("Employee role updated successfully!");
      setShowRoleModal(false);
      await loadInitialData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (roleId: string) => {
    const role = roles.find((r) => r.role_id === roleId);
    if (role) {
      setSelectedRole(role);
      loadRoleConfig(role);
    }
  };

  const handleModuleToggle = (moduleName: string) => {
    if (accessibleModules.includes(moduleName)) {
      setAccessibleModules(accessibleModules.filter((m) => m !== moduleName));
    } else {
      setAccessibleModules([...accessibleModules, moduleName]);
    }
  };

  const handleSaveRoleSettings = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("configure_role_settings", {
        payload: {
          role_id: selectedRole.role_id,
          accessible_modules: accessibleModules,
          read_only_modules: readOnlyModules,
          restricted_modules: restrictedModules,
        },
      });
      setSuccessMsg("Role configuration saved successfully!");
      const loggedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (loggedUser.role_id === selectedRole.role_id) {
        loggedUser.accessible_modules = accessibleModules;
        localStorage.setItem("user", JSON.stringify(loggedUser));
      }
      await loadInitialData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleInvestigateLog = async (logId: string) => {
    setErrorMsg("");
    setLoading(true);
    try {
      const details = await invoke("investigate_suspicious_activity", { logId });
      setInvestigatedLog(details);
      setShowLogModal(true);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const res = await invoke<any>("confirm_daily_backup", {
        confirmedBy: user.user_id,
      });
      setSuccessMsg(`Backup successfully confirmed! ID: ${res.log_id}`);
      await loadInitialData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = async (base64: string, filename: string) => {
    if (!saveDir) {
      setErrorMsg("Please select a save directory first.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const finalPath = await invoke<string>("save_file_to_directory", {
        directory: saveDir,
        filename,
        base64Content: base64,
      });
      setSuccessMsg(`File successfully saved to: ${finalPath}`);
    } catch (err) {
      setErrorMsg("Failed to save file: " + String(err));
    }
  };

  const handleExportSystemLogsCsv = async () => {
    setErrorMsg("");
    try {
      const base64 = await invoke<string>("export_system_logs_csv");
      await handleDownloadCsv(base64, `system_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      setErrorMsg("Failed to export system logs: " + String(err));
    }
  };

  const handleExportBackupLogsCsv = async () => {
    setErrorMsg("");
    try {
      const base64 = await invoke<string>("export_backup_logs_csv");
      await handleDownloadCsv(base64, `backup_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      setErrorMsg("Failed to export backup logs: " + String(err));
    }
  };

  if (!isITAdmin) {
    return (
      <div className="it-access-denied">
        <div className="it-access-denied-icon">
          <i className="fa fa-triangle-exclamation" />
        </div>
        <h1>Access Denied</h1>
        <p>You do not have the required permissions to view this dashboard. Only IT Administrators are permitted to enter. You will be redirected to the Homepage shortly.</p>
        <button className="hp-btn-primary-sharp" onClick={() => navigate("/home")}>
          Return Home
        </button>
      </div>
    );
  }

  return (
    <Dashboard
      activeItem={activeItem}
      activeSection={activeSection}
      setActiveItem={setActiveItem}
      setActiveSection={setActiveSection}
    >
      <div className="it-container">
        {errorMsg && <div className="it-error-message">{errorMsg}</div>}
        {successMsg && <div className="it-success-message">{successMsg}</div>}

        <div className="it-destination-bar">
          <div>
            <strong className="it-dest-label">Save Destination:</strong>
            <span className="it-dest-path">{saveDir || "Loading default..."}</span>
          </div>
          <button
            type="button"
            onClick={handleChangeDirectory}
            className="it-dest-btn"
          >
            Change Folder
          </button>
        </div>


        {activeItem === "User Management" && (
          <div className="it-card">
            <h2 className="it-section-title">User Management</h2>
            <p className="it-section-desc">Manage system accounts, update roles, and enable or disable access control.</p>

            <div className="it-table-container">
              <table className="it-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Employee ID</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.account_id}>
                      <td>
                        <div className="it-emp-name">{emp.display_name}</div>
                        <div className="it-emp-username">@{emp.username}</div>
                      </td>
                      <td>{emp.employee_id || "-"}</td>
                      <td>{emp.email}</td>
                      <td>
                        <span className="it-badge">{emp.role_name}</span>
                      </td>
                      <td>
                        <span className={`it-status ${emp.is_active ? "active" : "inactive"}`}>
                          {emp.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="it-actions">
                        <button className="it-btn" onClick={() => openRoleEdit(emp)}>
                          <i className="fa fa-user-gear" /> Role
                        </button>
                        {emp.is_active ? (
                          <button className="it-btn it-btn-danger" onClick={() => handleDeactivate(emp.account_id)}>
                            Deactivate
                          </button>
                        ) : (
                          <button className="it-btn it-btn-success" onClick={() => handleReactivate(emp.account_id)}>
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeItem === "Register Account" && (
          <div className="it-flex-col-gap24">
            {shortlistedCandidates.length > 0 && (
              <div className="it-card">
                <h3 className="it-section-title">
                  <i className="fa-solid fa-bell it-mr10" />
                  Pending Account Requests (Shortlisted Recruits)
                </h3>
                <p className="it-section-desc">The following candidates have been shortlisted by the HR Manager and are waiting for account creation.</p>
                <div className="it-table-container">
                  <table className="it-table">
                    <thead>
                      <tr>
                        <th>Candidate Name</th>
                        <th>Email</th>
                        <th>Assigned Capacity</th>
                        <th>Assigned Voyage</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shortlistedCandidates.map((candidate) => (
                        <tr key={candidate.candidate_id}>
                          <td><strong>{candidate.full_name}</strong></td>
                          <td>{candidate.email}</td>
                          <td><span className="it-badge">{candidate.assigned_capacity}</span></td>
                          <td>{candidate.assigned_voyage}</td>
                          <td>
                            <button
                              type="button"
                              className="it-btn it-btn-process"
                              onClick={() => handleProcessCandidateRegistration(candidate)}
                            >
                              Process Registration
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="it-card">
              <h2 className="it-section-title">
                {processingCandidateId ? "Register Account for Recruit" : "Register Account"}
              </h2>
              <p className="it-section-desc">
                {processingCandidateId
                  ? "Pre-filled details from HR shortlisted recruit. Set their username and Employee ID to activate account."
                  : "Create credentials for a new system administrator or employee."}
              </p>

              <form onSubmit={handleRegister} className="hp-grid-2">
                <div className="hp-field">
                  <label>Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jason Kenneth"
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    className="it-input"
                  />
                </div>

                <div className="hp-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jason@sailintis.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="it-input"
                  />
                </div>

                <div className="hp-field">
                  <label>Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. jason123"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="it-input"
                  />
                </div>

                <div className="hp-field">
                  <label>Password (Auto-generated)</label>
                  <div className="it-input-group">
                    <input
                      type="text"
                      readOnly
                      value={regPassword}
                      className="it-input it-input-group-field"
                    />
                    <button
                      type="button"
                      className="it-btn"
                      onClick={() => setRegPassword(generateRandomPassword())}
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                <div className="hp-field">
                  <label>Employee ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-1092"
                    value={regEmployeeId}
                    onChange={(e) => setRegEmployeeId(e.target.value)}
                    className="it-input"
                  />
                </div>

                <div className="hp-field">
                  <label>Account Role</label>
                  <select
                    value={regRoleId}
                    onChange={(e) => setRegRoleId(e.target.value)}
                    className="it-select"
                  >
                    {roles.map((r) => (
                      <option key={r.role_id} value={r.role_id}>
                        {r.role_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hp-field hp-full">
                  <button type="submit" className="hp-btn-primary-sharp">
                    {processingCandidateId ? "Activate Account & Finalize Recruitment" : "Create Employee Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeItem === "Role Management" && (
          <div className="it-card">
            <h2 className="it-section-title">Role Management</h2>
            <p className="it-section-desc">Configure security modules and workspace access permissions for user roles.</p>

            <div className="it-roles-grid">
              <div>
                <label className="it-input-label">Select Role</label>
                <select
                  value={selectedRole?.role_id || ""}
                  onChange={(e) => handleRoleSelect(e.target.value)}
                  className="it-select"
                >
                  {roles.map((r) => (
                    <option key={r.role_id} value={r.role_id}>
                      {r.role_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRole && (
                <div>
                  <h3 className="it-roles-title">
                    Configure Permissions for {selectedRole.role_name}
                  </h3>

                  <div className="it-modules-list">
                    {AVAILABLE_MODULES.map((moduleName) => (
                      <div
                        key={moduleName}
                        className="it-module-item"
                        onClick={() => handleModuleToggle(moduleName)}
                      >
                        <input
                          type="checkbox"
                          checked={accessibleModules.includes(moduleName)}
                          onChange={() => {}}
                        />
                        <span className="it-module-name">
                          {moduleName.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    className="hp-btn-primary-sharp it-roles-save-btn"
                    onClick={handleSaveRoleSettings}
                  >
                    Save Configuration
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeItem === "System Logs" && (
          <div className="it-card">
            <div className="it-section-header-row">
              <div>
                <h2 className="it-section-title">System Logs</h2>
                <p className="it-section-desc">Audit trail of transactions, administrative interventions, and security alerts.</p>
              </div>
              <button className="hp-btn-primary-sharp hp-btn-csv" onClick={handleExportSystemLogsCsv}>
                <i className="fa-solid fa-file-csv" />
                Export CSV
              </button>
            </div>

            <div className="it-logs-list">
              {logs.map((log) => (
                <div key={log.log_id} className={`it-log-row ${log.is_flagged ? "flagged" : ""}`}>
                  <span className={`it-log-badge ${log.is_flagged ? "flagged" : "normal"}`}>
                    {log.is_flagged ? "Alert" : "Info"}
                  </span>
                  <div className="it-log-content">
                    <div className="it-log-title">{log.action}</div>
                    <div className="it-log-desc">{log.description}</div>
                    <div className="it-log-time">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : "Unknown date"}
                    </div>
                  </div>
                  {log.is_flagged && (
                    <button className="it-btn it-btn-danger" onClick={() => handleInvestigateLog(log.log_id)}>
                      Investigate
                    </button>
                  )}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="it-logs-empty">
                  No system logs available.
                </div>
              )}
            </div>

            {resetRequests && resetRequests.length > 0 && (
              <div className="it-reset-requests-section">
                <h3 className="it-reset-requests-title">Pending Password Reset Requests</h3>
                <div className="it-logs-list">
                  {resetRequests.map((req: any, index: number) => (
                    <div key={index} className="it-log-row">
                      <span className="it-log-badge normal">Reset</span>
                      <div className="it-log-content">
                        <div className="it-log-title">Forgot Password Request</div>
                        <div className="it-log-desc">Email: {req.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeItem === "Backup System" && (
          <div className="it-card">
            <div className="it-section-header-row">
              <div>
                <h2 className="it-section-title">Backup System</h2>
                <p className="it-section-desc">Manage system checkpoints, recover data snapshots, and audit local daily backups.</p>
              </div>
              <button className="hp-btn-primary-sharp hp-btn-csv" onClick={handleExportBackupLogsCsv}>
                <i className="fa-solid fa-file-csv" />
                Export CSV
              </button>
            </div>

            <div className="it-backup-status">
              <div className="it-backup-info">
                <h3>Daily System Backup</h3>
                <p>Ensure database continuity by saving current snapshots. Verification requires IT Admin authentication.</p>
              </div>
              <button className="hp-btn-primary-sharp" onClick={handleBackup}>
                Start & Confirm Backup
              </button>
            </div>

            <div className="it-table-container">
              <table className="it-table">
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Confirmed At</th>
                    <th>Confirmed By</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {backupLogs.map((b) => (
                    <tr key={b.log_id}>
                      <td>{b.log_id}</td>
                      <td>{new Date(b.confirmed_at).toLocaleString()}</td>
                      <td>{b.confirmed_by}</td>
                      <td>
                        <span className="it-badge it-badge-success-flat">
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showRoleModal && selectedEmployee && createPortal(
        <div className="it-modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="it-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="it-modal-header">Edit Employee Role</div>
            <div className="it-modal-body">
              <div className="it-modal-field-large">
                <strong>User:</strong> {selectedEmployee.display_name} (@{selectedEmployee.username})
              </div>
              <div>
                <label className="it-input-label">Select New Role</label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="it-select"
                >
                  {roles.map((r) => (
                    <option key={r.role_id} value={r.role_id}>
                      {r.role_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="it-modal-footer">
              <button className="it-btn" onClick={() => setShowRoleModal(false)}>
                Cancel
              </button>
              <button className="it-btn it-btn-primary" onClick={handleUpdateRole}>
                Save Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showLogModal && investigatedLog && createPortal(
        <div className="it-modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="it-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="it-modal-header it-modal-header-alert">Suspicious Activity Investigation</div>
            <div className="it-modal-body">
              <div className="it-modal-field">
                <strong>Log ID:</strong> {investigatedLog.log_id}
              </div>
              <div className="it-modal-field">
                <strong>Action:</strong> {investigatedLog.action}
              </div>
              <div className="it-modal-field">
                <strong>Timestamp:</strong> {investigatedLog.timestamp ? new Date(investigatedLog.timestamp).toLocaleString() : "Unknown"}
              </div>
              <div className="it-modal-field-large">
                <strong>Description:</strong>
                <p className="it-modal-log-desc">
                  {investigatedLog.description}
                </p>
              </div>
              <div>
                <span className="it-badge it-badge-danger-flat">
                  Flagged Suspicious
                </span>
              </div>
            </div>
            <div className="it-modal-footer">
              <button className="it-btn" onClick={() => setShowLogModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {loading && createPortal(
        <LoadingScreen visible={loading} />,
        document.body
      )}
    </Dashboard>
  );
}
