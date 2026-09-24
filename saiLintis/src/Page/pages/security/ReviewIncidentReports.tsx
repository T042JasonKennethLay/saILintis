import { useState, useEffect } from "react";
import "../../../Home.css";
import "../../../ReviewIncidentReports.css";
import { Dashboard } from "../../components/Dashboard";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

interface SecurityIncidentDetails {
  cctv_reviewed: boolean;
  warning_count: number;
  escalated_to_blacklist: boolean;
  evidence_log?: string;
}

interface MedicalIncidentDetails {
  known_conditions?: string;
  medications_on_file?: string;
  treatment_given?: string;
  outcome?: string;
  clearance_issued: boolean;
}

interface Incident {
  incident_id: string;
  incident_type: string;
  description: string;
  location: string;
  severity: string;
  status: string;
  resolved_at?: string;
  created_at: string;
  submitted_by?: string;
  submitting_officer_name?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  security_details?: SecurityIncidentDetails;
  medical_details?: MedicalIncidentDetails;
}

export function ReviewIncidentReports() {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("Review Incident Reports");
  const [activeSection, setActiveSection] = useState("Overview");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saveDir, setSaveDir] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showEscalateModal, setShowEscalateModal] = useState(false);

  useEffect(() => {
    const fetchDefaultDir = async () => {
      try {
        const dir = await invoke<string>("get_default_download_dir");
        setSaveDir(dir);
      } catch (_err) {
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
    } catch (err: any) {
      setErrorMsg("Failed to select directory: " + err.toString());
    }
  };

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAuthorized = user.role_name === "Security Officer" || user.role_name === "Ship Captain" || user.role_name === "Cruise Operations Director";

  useEffect(() => {
    if (!isAuthorized) {
      const timer = setTimeout(() => {
        navigate("/home");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthorized, navigate]);


  useEffect(() => {
    if (!isAuthorized) return;
    async function loadData() {
      try {
        const data = await invoke<Incident[]>("get_overnight_incidents");
        setIncidents(data);
        if (data.length > 0) {
          setSelectedIncidentId(data[0].incident_id);
        }
      } catch (err: any) {
        setErrorMsg(err.toString());
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const selectedIncident = incidents.find(i => i.incident_id === selectedIncidentId) || null;

  const isIncidentReviewed = (inc: Incident) => {
    if (user.role_name === "Ship Captain" || user.role_name === "Cruise Operations Director") {
      return (
        inc.status === "Reviewed" ||
        inc.status === "Closed -> Reviewed" ||
        inc.status === "Emergency Broadcasted" ||
        inc.status === "Evacuation Authorized" ||
        inc.status === "Route Alteration Authorized"
      );
    } else {
      return (
        inc.status !== "OPEN" &&
        inc.status !== "Open" &&
        inc.status !== "Pending"
      );
    }
  };

  const canEscalate = (inc: Incident) => {
    if (user.role_name === "Ship Captain" || user.role_name === "Cruise Operations Director") {
      return (
        inc.severity === "Critical" &&
        inc.status !== "Emergency Broadcasted" &&
        inc.status !== "Evacuation Authorized" &&
        inc.status !== "Route Alteration Authorized"
      );
    } else {
      return (
        inc.severity === "Critical" &&
        (inc.status === "OPEN" || inc.status === "Open" || inc.status === "Pending")
      );
    }
  };

  const handleEscalateOfficer = async () => {
    if (!selectedIncident) return;
    try {
      await invoke("acknowledge_incident", {
        payload: {
          incident_id: selectedIncident.incident_id,
          status: "Escalated -> Action Pending",
          reviewed_by: user.user_id,
        }
      });
      setIncidents(prev => prev.map(inc => {
        if (inc.incident_id === selectedIncident.incident_id) {
          return { ...inc, status: "Escalated -> Action Pending", reviewed_by: user.user_id, reviewed_at: new Date().toISOString() };
        }
        return inc;
      }));

      const targetRoles = ["Cruise Operations Director", "Ship Captain"];
      targetRoles.forEach(role => {
        const notifKey = `employee_notifications_${role}`;
        const existingNotifs = JSON.parse(localStorage.getItem(notifKey) || "[]");
        existingNotifs.push({
          id: Math.random().toString(),
          title: "CRITICAL INCIDENT ESCALATION",
          body: `Incident Location: ${selectedIncident.location}. Severity: Critical. Description: ${selectedIncident.description}`,
          time: new Date().toISOString(),
        });
        localStorage.setItem(notifKey, JSON.stringify(existingNotifs));
      });

      setSuccessMsg("Incident escalated to Cruise Operations Director and Ship Captain.");
      setValidationWarning(null);
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  };

  const getUnreviewedCount = () => {
    return incidents.filter(inc => !isIncidentReviewed(inc)).length;
  };

  const handleEscalate = async (status: string) => {
    if (!selectedIncident) return;
    try {
      await invoke("acknowledge_incident", {
        payload: {
          incident_id: selectedIncident.incident_id,
          status,
          reviewed_by: user.user_id,
        }
      });

      setIncidents(prev => prev.map(inc => {
        if (inc.incident_id === selectedIncident.incident_id) {
          return { ...inc, status, reviewed_by: user.user_id, reviewed_at: new Date().toISOString() };
        }
        return inc;
      }));

      let targetRole = "Safety Officer";
      if (status === "Route Alteration Authorized") {
        targetRole = "Chief Engineer";
      }
      const notifKey = `employee_notifications_${targetRole}`;
      const existingNotifs = JSON.parse(localStorage.getItem(notifKey) || "[]");
      existingNotifs.push({
        id: Math.random().toString(),
        title: `CRITICAL ESCALATION: ${status === "Emergency Broadcasted" ? "Emergency Broadcast" : status === "Evacuation Authorized" ? "Evacuation Authorized" : "Route Alteration Authorized"}`,
        body: `Incident Location: ${selectedIncident.location}. Severity: Critical. Description: ${selectedIncident.description}`,
        time: new Date().toISOString(),
      });
      localStorage.setItem(notifKey, JSON.stringify(existingNotifs));

      setShowEscalateModal(false);
      setSuccessMsg(`Incident successfully escalated: ${status}`);
      setValidationWarning(null);
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  };

  const handleAcknowledge = async (status: string) => {
    if (!selectedIncident) return;
    if (!selectedIncident.submitting_officer_name) {
      setValidationWarning("Incomplete record - officer information missing");
      return;
    }
    try {
      await invoke("acknowledge_incident", {
        payload: {
          incident_id: selectedIncident.incident_id,
          status,
          reviewed_by: user.user_id,
        }
      });
      setIncidents(prev => prev.map(inc => {
        if (inc.incident_id === selectedIncident.incident_id) {
          return { ...inc, status, reviewed_by: user.user_id, reviewed_at: new Date().toISOString() };
        }
        return inc;
      }));
      setValidationWarning(null);
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  };

  const handleDownloadPdf = async (incidentId: string) => {
    if (!saveDir) {
      setErrorMsg("Please select a save directory first.");
      return;
    }
    setPdfLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const base64 = await invoke<string>("generate_incident_pdf", {
        payload: { incident_id: incidentId }
      });
      const filename = `incident_report_${incidentId.slice(0, 8)}.pdf`;
      const finalPath = await invoke<string>("save_file_to_directory", {
        directory: saveDir,
        filename,
        base64Content: base64,
      });
      setSuccessMsg(`PDF successfully saved to: ${finalPath}`);
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setPdfLoading(false);
    }
  };


  const handleArchiveAndExit = () => {
    const unreviewed = getUnreviewedCount();
    if (unreviewed > 0) {
      setValidationWarning("All incidents must be reviewed before closing.");
    } else {
      navigate("/home");
    }
  };

  if (!isAuthorized) {
    return (
      <Dashboard activeItem={activeItem} activeSection={activeSection} setActiveItem={setActiveItem} setActiveSection={setActiveSection}>
        <div className="zsa-access-denied">
          <i className="fa-solid fa-circle-exclamation zsa-denied-icon" />
          <h2>Access Denied</h2>
          <p>You do not have permission to view the Incident Reviews Panel. Redirecting to home...</p>
          <div className="zsa-redirect-spinner" />
        </div>
      </Dashboard>
    );
  }

  if (loading) {
    return (
      <Dashboard activeItem={activeItem} activeSection={activeSection} setActiveItem={setActiveItem} setActiveSection={setActiveSection}>
        <div className="hp-page-header-top">
          <h1 className="hp-title-giant">Review Incident Reports</h1>
          <p className="hp-subtitle-clean">Loading overnight reports...</p>
        </div>
      </Dashboard>
    );
  }

  if (incidents.length === 0) {
    return (
      <Dashboard activeItem={activeItem} activeSection={activeSection} setActiveItem={setActiveItem} setActiveSection={setActiveSection}>
        <div className="hp-page-header-top">
          <h1 className="hp-title-giant">Review Incident Reports</h1>
          <p className="hp-subtitle-clean">Overnight incident queue</p>
        </div>
        <div className="hp-empty-state-card">
          <div className="hp-empty-icon">
            <i className="fa-solid fa-folder-open" />
          </div>
          <h2>No overnight incidents recorded.</h2>
          <p className="hp-empty-text">The queue is empty. No new incidents have been filed overnight.</p>
          <button className="hp-btn-primary-sharp" onClick={() => navigate("/home")}>
            Return to Dashboard
          </button>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard activeItem={activeItem} activeSection={activeSection} setActiveItem={setActiveItem} setActiveSection={setActiveSection}>
      <div className="hp-page-header-top">
        <h1 className="hp-title-giant">Review Incident Reports</h1>
        <p className="hp-subtitle-clean">Morning Briefing and Overnight Incident Queue</p>
      </div>

      {validationWarning && (
        <div className="hp-warning-box">
          <i className="fa-solid fa-triangle-exclamation" />
          <span>{validationWarning}</span>
        </div>
      )}

      {errorMsg && (
        <div className="hp-error-banner">
          <i className="fa-solid fa-circle-exclamation" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="rir-success-banner">
          <i className="fa-solid fa-circle-check" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="rir-destination-bar">
        <div>
          <strong className="rir-dest-label">Save Destination:</strong>
          <span className="rir-dest-path">{saveDir || "Loading default..."}</span>
        </div>
        <button
          type="button"
          onClick={handleChangeDirectory}
          className="rir-dest-btn"
        >
          Change Folder
        </button>
      </div>

      <div className="hp-archive-bar">

        <div className="hp-progress-track">
          Reviewed: {incidents.length - getUnreviewedCount()} / {incidents.length} Reports
        </div>
        <button className="hp-btn-primary-sharp" onClick={handleArchiveAndExit}>
          Brief Shift &amp; Archive Batch
        </button>
      </div>

      <div className="hp-incident-container">
        <div className="hp-incident-list-panel">
          <h2 className="hp-incident-list-title">Reports Queue</h2>
          {incidents.map((inc) => {
            const isSelected = inc.incident_id === selectedIncidentId;
            const isReviewed = isIncidentReviewed(inc);
            return (
              <button
                key={inc.incident_id}
                className={`hp-incident-card ${isSelected ? "active" : ""}`}
                onClick={() => {
                  setSelectedIncidentId(inc.incident_id);
                  setValidationWarning(null);
                }}
              >
                <div className="hp-incident-card-row">
                  <span className={`hp-severity-badge hp-sev-${inc.severity.toLowerCase()}`}>
                    {inc.severity}
                  </span>
                  {isReviewed && (
                    <span className="hp-reviewed-check">
                      <i className="fa-solid fa-circle-check" />
                    </span>
                  )}
                </div>
                <div className="hp-incident-title">{inc.incident_type} Incident</div>
                <div className="rir-card-status-row">
                  <span className={`rir-card-status-badge rir-card-status-${inc.status.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                    {inc.status === "OPEN" || inc.status === "Open" ? "Open" :
                     inc.status === "Reviewed" ? "Reviewed" :
                     inc.status === "Closed -> Reviewed" ? "Closed" :
                     inc.status === "Escalated -> Action Pending" ? "Escalated" :
                     inc.status === "Emergency Broadcasted" ? "Broadcast" :
                     inc.status === "Evacuation Authorized" ? "Evacuation" :
                     inc.status === "Route Alteration Authorized" ? "Route Altered" :
                     inc.status}
                  </span>
                </div>
                <div className="hp-incident-meta">
                  <div><i className="fa-solid fa-location-dot" /> {inc.location}</div>
                  <div><i className="fa-solid fa-clock" /> {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="hp-incident-detail-panel">
          {selectedIncident ? (
            <div>
              <div className="hp-incident-detail-header">
                <div className="hp-incident-detail-title-row">
                  <h2 className="hp-incident-detail-title">{selectedIncident.incident_type} Incident</h2>
                  <span className={`hp-severity-badge hp-sev-${selectedIncident.severity.toLowerCase()}`}>
                    Severity: {selectedIncident.severity}
                  </span>
                </div>
                <p className="hp-incident-detail-description">{selectedIncident.description}</p>
              </div>

              {!selectedIncident.submitting_officer_name && (
                <div className="hp-warning-box hp-warning-amber">
                  <i className="fa-solid fa-circle-exclamation" />
                  <span>Incomplete record - officer information missing</span>
                </div>
              )}

              <div className="hp-detail-grid">
                <div className="hp-detail-item">
                  <span className="hp-detail-label">Incident ID</span>
                  <span className="hp-detail-value">{selectedIncident.incident_id}</span>
                </div>
                <div className="hp-detail-item">
                  <span className="hp-detail-label">Location</span>
                  <span className="hp-detail-value">{selectedIncident.location}</span>
                </div>
                <div className="hp-detail-item">
                  <span className="hp-detail-label">Submitting Officer</span>
                  <span className="hp-detail-value">{selectedIncident.submitting_officer_name || "Missing"}</span>
                </div>
                <div className="hp-detail-item">
                  <span className="hp-detail-label">Current Status</span>
                  <span className={`rir-status-badge rir-status-${selectedIncident.status.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                    {selectedIncident.status === "OPEN" || selectedIncident.status === "Open" ? "Open" :
                     selectedIncident.status === "Reviewed" ? "Reviewed" :
                     selectedIncident.status === "Closed -> Reviewed" ? "Closed & Reviewed" :
                     selectedIncident.status === "Escalated -> Action Pending" ? "Escalated to Captain" :
                     selectedIncident.status === "Emergency Broadcasted" ? "Emergency Broadcast Authorized" :
                     selectedIncident.status === "Evacuation Authorized" ? "Evacuation Authorized" :
                     selectedIncident.status === "Route Alteration Authorized" ? "Route Alteration Authorized" :
                     selectedIncident.status}
                  </span>
                </div>

                {selectedIncident.incident_type === "SECURITY" && selectedIncident.security_details && (
                  <div className="hp-detail-block">
                    <h3 className="hp-detail-block-title">Security Investigation</h3>
                    <div className="hp-detail-grid hp-detail-inner-grid">
                      <div className="hp-detail-item">
                        <span className="hp-detail-label">CCTV Reviewed</span>
                        <span className="hp-detail-value">{selectedIncident.security_details.cctv_reviewed ? "Yes" : "No"}</span>
                      </div>
                      <div className="hp-detail-item">
                        <span className="hp-detail-label">Warnings Issued</span>
                        <span className="hp-detail-value">{selectedIncident.security_details.warning_count}</span>
                      </div>
                      <div className="hp-detail-item">
                        <span className="hp-detail-label">Escalated to Blacklist</span>
                        <span className="hp-detail-value">{selectedIncident.security_details.escalated_to_blacklist ? "Yes" : "No"}</span>
                      </div>
                      {selectedIncident.security_details.evidence_log && (
                        <div className="hp-detail-item hp-detail-full">
                          <span className="hp-detail-label">Evidence Log</span>
                          <span className="hp-detail-value hp-evidence-value">
                            {selectedIncident.security_details.evidence_log}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedIncident.incident_type === "MEDICAL" && selectedIncident.medical_details && (
                  <div className="hp-detail-block">
                    <h3 className="hp-detail-block-title">Medical Assessment</h3>
                    <div className="hp-detail-grid hp-detail-inner-grid">
                      <div className="hp-detail-item">
                        <span className="hp-detail-label">Known Conditions</span>
                        <span className="hp-detail-value">{selectedIncident.medical_details.known_conditions || "None"}</span>
                      </div>
                      <div className="hp-detail-item">
                        <span className="hp-detail-label">Medications on File</span>
                        <span className="hp-detail-value">{selectedIncident.medical_details.medications_on_file || "None"}</span>
                      </div>
                      <div className="hp-detail-item">
                        <span className="hp-detail-label">Treatment Given</span>
                        <span className="hp-detail-value">{selectedIncident.medical_details.treatment_given || "None"}</span>
                      </div>
                      <div className="hp-detail-item">
                        <span className="hp-detail-label">Outcome</span>
                        <span className="hp-detail-value">{selectedIncident.medical_details.outcome || "None"}</span>
                      </div>
                      <div className="hp-detail-item">
                        <span className="hp-detail-label">Clearance Issued</span>
                        <span className="hp-detail-value">{selectedIncident.medical_details.clearance_issued ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="hp-action-bar">
                <button
                  className="hp-btn-primary-sharp hp-btn-green"
                  disabled={!selectedIncident.submitting_officer_name || isIncidentReviewed(selectedIncident)}
                  onClick={() => handleAcknowledge("Reviewed")}
                >
                  Mark as Reviewed
                </button>
                <button
                  className="hp-btn-primary-sharp hp-btn-slate"
                  disabled={!selectedIncident.submitting_officer_name || isIncidentReviewed(selectedIncident)}
                  onClick={() => handleAcknowledge("Closed -> Reviewed")}
                >
                  Close &amp; Acknowledge
                </button>
                {selectedIncident.severity === "Critical" && (
                  <button
                    className="hp-btn-primary-sharp hp-btn-red"
                    disabled={!canEscalate(selectedIncident)}
                    onClick={() => {
                      if (user.role_name === "Ship Captain" || user.role_name === "Cruise Operations Director") {
                        setShowEscalateModal(true);
                      } else {
                        handleEscalateOfficer();
                      }
                    }}
                  >
                    Escalate Report
                  </button>
                )}
                <button
                  className="hp-btn-primary-sharp hp-btn-pdf"
                  disabled={pdfLoading}
                  onClick={() => handleDownloadPdf(selectedIncident.incident_id)}
                >
                  <i className="fa-solid fa-file-pdf" />
                  {pdfLoading ? "Generating..." : "Download PDF"}
                </button>
              </div>
            </div>
          ) : (
            <div className="hp-empty-detail">
              <p className="hp-empty-detail-text">Select an incident to view details.</p>
            </div>
          )}
        </div>
      </div>

      {showEscalateModal && selectedIncident && (
        <div className="rir-modal-overlay" onClick={() => setShowEscalateModal(false)}>
          <div className="rir-modal-container" onClick={(e) => e.stopPropagation()}>
            <button className="rir-modal-close-btn" onClick={() => setShowEscalateModal(false)}>
              <i className="fa-solid fa-xmark" />
            </button>
            <h2 className="rir-modal-title">Incident Escalation Center</h2>
            <p className="rir-modal-description">
              Select the emergency protocol to authorize. This will dispatch high-priority notifications to duty officers.
            </p>
            <div className="rir-modal-options-grid">
              <button className="rir-modal-option-card" onClick={() => handleEscalate("Emergency Broadcasted")}>
                <div className="rir-option-icon rir-icon-broadcast">
                  <i className="fa-solid fa-bullhorn" />
                </div>
                <div className="rir-option-content">
                  <span className="rir-option-title">Authorize Emergency Broadcast</span>
                  <span className="rir-option-subtitle">Notifies: Safety Officer</span>
                  <p className="rir-option-desc">Authorize emergency announcements across ship-wide public channels.</p>
                </div>
              </button>

              <button className="rir-modal-option-card" onClick={() => handleEscalate("Evacuation Authorized")}>
                <div className="rir-option-icon rir-icon-evac">
                  <i className="fa-solid fa-person-walking-arrow-right" />
                </div>
                <div className="rir-option-content">
                  <span className="rir-option-title">Authorize Ship Evacuation</span>
                  <span className="rir-option-subtitle">Notifies: Safety Officer</span>
                  <p className="rir-option-desc">Authorize muster station mobilization and lifeboat boarding.</p>
                </div>
              </button>

              <button className="rir-modal-option-card" onClick={() => handleEscalate("Route Alteration Authorized")}>
                <div className="rir-option-icon rir-icon-route">
                  <i className="fa-solid fa-compass" />
                </div>
                <div className="rir-option-content">
                  <span className="rir-option-title">Authorize Route Alteration</span>
                  <span className="rir-option-subtitle">Notifies: Chief Engineer</span>
                  <p className="rir-option-desc">Authorize immediate navigation route deviation to the nearest safe port.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </Dashboard>
  );
}
