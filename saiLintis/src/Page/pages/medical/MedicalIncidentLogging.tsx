import { useState, useEffect } from "react";
import "../../../Home.css";
import "../../../MedicalIncidentLogging.css";
import { Dashboard } from "../../components/Dashboard";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

export function MedicalIncidentLogging() {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("Medical Incident Logging");
  const [activeSection, setActiveSection] = useState("Overview");

  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState("Low");
  const [knownConditions, setKnownConditions] = useState("");
  const [medicationsOnFile, setMedicationsOnFile] = useState("");
  const [treatmentGiven, setTreatmentGiven] = useState("");
  const [outcome, setOutcome] = useState("");
  const [clearanceIssued, setClearanceIssued] = useState(false);

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

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    loadIncidents();
  }, []);


  const loadIncidents = async () => {
    try {
      const data = await invoke<any[]>("get_overnight_incidents");
      setIncidents(data.filter(i => i.incident_type === "MEDICAL"));
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
      await invoke("create_medical_incident", {
        payload: {
          submitted_by: user.user_id,
          description: description.trim(),
          location: location.trim(),
          severity,
          known_conditions: knownConditions.trim() || null,
          medications_on_file: medicationsOnFile.trim() || null,
          treatment_given: treatmentGiven.trim() || null,
          outcome: outcome.trim() || null,
          clearance_issued: clearanceIssued,
        }
      });
      setSuccess(true);
      setDescription("");
      setLocation("");
      setSeverity("Low");
      setKnownConditions("");
      setMedicationsOnFile("");
      setTreatmentGiven("");
      setOutcome("");
      setClearanceIssued(false);
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
      const filename = `medical_incident_${incidentId.slice(0, 8)}.pdf`;
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


  return (
    <Dashboard activeItem={activeItem} activeSection={activeSection} setActiveItem={setActiveItem} setActiveSection={setActiveSection}>
      <div className="hp-page-header-top">
        <h1 className="hp-title-giant">Log Medical Incident</h1>
        <p className="hp-subtitle-clean">File a new medical incident report to the Ship Captain's morning briefing queue.</p>
      </div>

      {successMsg && (
        <div className="mil-success-banner">
          <i className="fa-solid fa-circle-check" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="mil-destination-bar">
        <div>
          <strong className="mil-dest-label">Save Destination:</strong>
          <span className="mil-dest-path">{saveDir || "Loading default..."}</span>
        </div>
        <button
          type="button"
          onClick={handleChangeDirectory}
          className="mil-dest-btn"
        >
          Change Folder
        </button>
      </div>


      <div className="hp-form-card-sharp">
        {success && (
          <div className="hp-success-banner">
            <span>Medical report submitted successfully to the Captain's queue.</span>
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
                placeholder="e.g. Pool Deck, Deck 11"
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
                placeholder="Describe details of the medical emergency or incident..."
                className="hp-textarea-field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="hp-field">
              <label>Patient Known Medical Conditions (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Diabetes, Hypertension"
                value={knownConditions}
                onChange={(e) => setKnownConditions(e.target.value)}
              />
            </div>

            <div className="hp-field">
              <label>Patient Medications on File (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Insulin, Lisinopril"
                value={medicationsOnFile}
                onChange={(e) => setMedicationsOnFile(e.target.value)}
              />
            </div>

            <div className="hp-field hp-full">
              <label>Treatment Given</label>
              <textarea
                placeholder="Describe first aid, medications administered, or medical interventions performed..."
                className="hp-textarea-field"
                value={treatmentGiven}
                onChange={(e) => setTreatmentGiven(e.target.value)}
              />
            </div>

            <div className="hp-field hp-full">
              <label>Assessment Outcome</label>
              <textarea
                placeholder="Describe final status of passenger (e.g. sent back to cabin, hospitalized at next port)..."
                className="hp-textarea-field"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </div>

            <div className="hp-field hp-full hp-checkbox-row">
              <input
                type="checkbox"
                id="clearanceIssued"
                className="hp-checkbox-input"
                checked={clearanceIssued}
                onChange={(e) => setClearanceIssued(e.target.checked)}
              />
              <label htmlFor="clearanceIssued" className="hp-checkbox-label">Fit to Continue Voyage (Medical Clearance Issued)</label>
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
        <h2>Recent Logged Medical Reports</h2>
        {incidents.map((inc) => (
          <div key={inc.incident_id} className="hp-report-card">
            <div className="hp-report-card-header">
              <span className="hp-report-card-title">Medical Incident Report</span>
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
            {inc.medical_details && (
              <div className="hp-report-details-grid">
                <div className="hp-report-detail-item">
                  <span className="hp-report-detail-label">Known Conditions</span>
                  <span className="hp-report-detail-value">{inc.medical_details.known_conditions || "None"}</span>
                </div>
                <div className="hp-report-detail-item">
                  <span className="hp-report-detail-label">Medications on File</span>
                  <span className="hp-report-detail-value">{inc.medical_details.medications_on_file || "None"}</span>
                </div>
                <div className="hp-report-detail-item">
                  <span className="hp-report-detail-label">Treatment Given</span>
                  <span className="hp-report-detail-value">{inc.medical_details.treatment_given || "None"}</span>
                </div>
                <div className="hp-report-detail-item">
                  <span className="hp-report-detail-label">Outcome</span>
                  <span className="hp-report-detail-value">{inc.medical_details.outcome || "None"}</span>
                </div>
                <div className="hp-report-detail-item">
                  <span className="hp-report-detail-label">Clearance Issued</span>
                  <span className="hp-report-detail-value">{inc.medical_details.clearance_issued ? "Yes" : "No"}</span>
                </div>
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
          <p className="hp-text-empty-announcement">No medical reports logged yet.</p>
        )}
      </div>
    </Dashboard>
  );
}
