import { useState, useEffect } from "react";
import "../../../Home.css";
import "../../../SecurityIncidentReport.css";
import { Dashboard } from "../../components/Dashboard";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

export function SecurityIncidentReport() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isSafetyOfficer = user.role_name === "Safety Officer";

  const [activeItem, setActiveItem] = useState("Security Incident Report");
  const [activeSection, setActiveSection] = useState("Overview");

  useEffect(() => {
    if (!isSafetyOfficer) {
      const timer = setTimeout(() => {
        navigate("/home");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSafetyOfficer, navigate]);

  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState("Low");
  const [cctvReviewed, setCctvReviewed] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [escalatedToBlacklist, setEscalatedToBlacklist] = useState(false);
  const [evidenceLog, setEvidenceLog] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [saveDir, setSaveDir] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    } catch (err: any) {
      setErrorMsg("Failed to select directory: " + err.toString());
    }
  };


  useEffect(() => {
    loadIncidents();
  }, []);


  const loadIncidents = async () => {
    try {
      const data = await invoke<any[]>("get_overnight_incidents");
      setIncidents(data.filter(i => i.incident_type === "SECURITY"));
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !location.trim()) {
      setErrorMsg("Description and Location are required.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await invoke("create_security_incident", {
        payload: {
          submitted_by: user.user_id,
          description: description.trim(),
          location: location.trim(),
          severity,
          cctv_reviewed: cctvReviewed,
          warning_count: Number(warningCount),
          escalated_to_blacklist: escalatedToBlacklist,
          evidence_log: evidenceLog.trim() || null,
        }
      });
      setSuccess(true);
      setDescription("");
      setLocation("");
      setSeverity("Low");
      setCctvReviewed(false);
      setWarningCount(0);
      setEscalatedToBlacklist(false);
      setEvidenceLog("");
      await loadIncidents();
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async (incidentId: string) => {
    if (!saveDir) {
      setErrorMsg("Please select a save directory first.");
      return;
    }
    setPdfLoadingId(incidentId);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const base64 = await invoke<string>("generate_incident_pdf", {
        payload: { incident_id: incidentId }
      });
      const filename = `security_incident_${incidentId.slice(0, 8)}.pdf`;
      const finalPath = await invoke<string>("save_file_to_directory", {
        directory: saveDir,
        filename,
        base64Content: base64,
      });
      setSuccessMsg(`PDF successfully saved to: ${finalPath}`);
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setPdfLoadingId(null);
    }
  };

  if (!isSafetyOfficer) {
    return (
      <Dashboard activeItem={activeItem} activeSection={activeSection} setActiveItem={setActiveItem} setActiveSection={setActiveSection}>
        <div className="zsa-access-denied">
          <i className="fa-solid fa-circle-exclamation zsa-denied-icon" />
          <h2>Access Denied</h2>
          <p>You do not have permission to view the Security Incident Logging Panel. Redirecting to home...</p>
          <div className="zsa-redirect-spinner" />
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard activeItem={activeItem} activeSection={activeSection} setActiveItem={setActiveItem} setActiveSection={setActiveSection}>
      <div className="hp-page-header-top">
        <h1 className="hp-title-giant">Log Security Incident</h1>
        <p className="hp-subtitle-clean">File a new security report to the Ship Captain's morning briefing queue.</p>
      </div>

      <div className="sir-tabs-row">
        <button
          onClick={() => navigate("/security-report")}
          className="it-btn it-btn-primary sir-tab-btn"
        >
          <i className="fa-solid fa-shield-halved sir-tab-icon" />
          Security Incident Logging
        </button>
        <button
          onClick={() => navigate("/zone-alerts")}
          className="it-btn sir-tab-btn"
        >
          <i className="fa-solid fa-satellite-dish sir-tab-icon" />
          Zone Security Alerts
        </button>
      </div>

      {successMsg && (
        <div className="sir-success-banner">
          <i className="fa-solid fa-circle-check" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="sir-destination-bar">
        <div>
          <strong className="sir-dest-label">Save Destination:</strong>
          <span className="sir-dest-path">{saveDir || "Loading default..."}</span>
        </div>
        <button
          type="button"
          onClick={handleChangeDirectory}
          className="sir-dest-btn"
        >
          Change Folder
        </button>
      </div>


      <div className="hp-form-card-sharp">
        {success && (
          <div className="hp-success-banner">
            <span>Incident report submitted successfully to the Captain's queue.</span>
            <button onClick={() => setSuccess(false)} className="hp-success-banner-close">Dismiss</button>
          </div>
        )}

        {errorMsg && (
          <div className="hp-error-banner">
            <i className="fa-solid fa-circle-exclamation" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="hp-grid-2">
            <div className="hp-field">
              <label>Location</label>
              <input
                type="text"
                placeholder="e.g. Casino Royale, Deck 6"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="hp-field">
              <label>Severity Level</label>
              <select className="hp-select-sharp" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div className="hp-field hp-full">
              <label>Incident Description</label>
              <textarea
                placeholder="Describe details of the security event..."
                className="hp-textarea-field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="hp-field hp-checkbox-row">
              <input
                type="checkbox"
                id="cctvReviewed"
                className="hp-checkbox-input"
                checked={cctvReviewed}
                onChange={(e) => setCctvReviewed(e.target.checked)}
              />
              <label htmlFor="cctvReviewed" className="hp-checkbox-label">CCTV Footage Reviewed</label>
            </div>

            <div className="hp-field">
              <label>Warning Count</label>
              <input
                type="number"
                min="0"
                value={warningCount}
                onChange={(e) => setWarningCount(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>

            <div className="hp-field hp-checkbox-row">
              <input
                type="checkbox"
                id="escalatedToBlacklist"
                className="hp-checkbox-input"
                checked={escalatedToBlacklist}
                onChange={(e) => setEscalatedToBlacklist(e.target.checked)}
              />
              <label htmlFor="escalatedToBlacklist" className="hp-checkbox-label">Escalate to Blacklist Request</label>
            </div>

            <div className="hp-field hp-full">
              <label>Evidence Log &amp; Investigation Notes (Optional)</label>
              <textarea
                placeholder="Enter evidence details, witness statement logs, or officer action summaries..."
                className="hp-textarea-field"
                value={evidenceLog}
                onChange={(e) => setEvidenceLog(e.target.value)}
              />
            </div>
          </div>

          <div className="hp-form-buttons-row">
            <button type="submit" className="hp-btn-primary-sharp" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Incident Report"}
            </button>
            <button type="button" className="hp-btn-primary-sharp hp-btn-secondary-sharp" onClick={() => navigate("/home")}>
              Cancel
            </button>
          </div>
        </form>
      </div>

      <div className="hp-report-list">
        <h2>Recent Logged Security Reports</h2>
        {incidents.map((inc) => (
          <div key={inc.incident_id} className="hp-report-card">
            <div className="hp-report-card-header">
              <span className="hp-report-card-title">Security Incident Report</span>
              <span className={`hp-severity-badge hp-sev-${inc.severity.toLowerCase()}`}>
                {inc.severity}
              </span>
            </div>
            <div className="hp-report-card-meta">
              <span><strong>Location:</strong> {inc.location}</span>
              <span> · <strong>Date:</strong> {new Date(inc.created_at).toLocaleString()}</span>
              <span> · <strong>Status:</strong> {inc.status}</span>
            </div>
            <div className="hp-report-card-description">
              {inc.description}
            </div>
            {inc.security_details && (
              <div className="hp-report-details-grid">
                <div className="hp-report-detail-item">
                  <span className="hp-report-detail-label">CCTV Reviewed</span>
                  <span className="hp-report-detail-value">{inc.security_details.cctv_reviewed ? "Yes" : "No"}</span>
                </div>
                <div className="hp-report-detail-item">
                  <span className="hp-report-detail-label">Warning Count</span>
                  <span className="hp-report-detail-value">{inc.security_details.warning_count}</span>
                </div>
                <div className="hp-report-detail-item">
                  <span className="hp-report-detail-label">Blacklist Escalated</span>
                  <span className="hp-report-detail-value">{inc.security_details.escalated_to_blacklist ? "Yes" : "No"}</span>
                </div>
                {inc.security_details.evidence_log && (
                  <div className="hp-report-detail-item">
                    <span className="hp-report-detail-label">Evidence Log</span>
                    <span className="hp-report-detail-value">{inc.security_details.evidence_log}</span>
                  </div>
                )}
              </div>
            )}
            <div className="hp-report-card-actions">
              <button
                className="hp-btn-primary-sharp hp-btn-pdf"
                disabled={pdfLoadingId === inc.incident_id}
                onClick={() => handleDownloadPdf(inc.incident_id)}
              >
                <i className="fa-solid fa-file-pdf" />
                {pdfLoadingId === inc.incident_id ? "Generating..." : "Download PDF"}
              </button>
            </div>
          </div>
        ))}
        {incidents.length === 0 && (
          <p className="hp-text-empty-announcement">No security reports logged yet.</p>
        )}
      </div>
    </Dashboard>
  );
}
