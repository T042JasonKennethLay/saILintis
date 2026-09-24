import { useState, useEffect } from "react";
import "../../../Home.css";
import "../../../MedicalIncidentLogging.css";
import { Dashboard } from "../../components/Dashboard";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

export function MedicalClearancePage() {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("Medical Clearance");
  const [activeSection, setActiveSection] = useState("Overview");

  const [incidents, setIncidents] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<any | null>(null);
  const [passengerProfile, setPassengerProfile] = useState<any | null>(null);

  const [fitToContinue, setFitToContinue] = useState(true);
  const [assessmentNotes, setAssessmentNotes] = useState("");
  const [clearanceId, setClearanceId] = useState<string | null>(null);

  const [searchPassengerQuery, setSearchPassengerQuery] = useState("");
  const [searchIncidentQuery, setSearchIncidentQuery] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [saveDir, setSaveDir] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const incData = await invoke<any[]>("get_overnight_incidents");
      setIncidents(incData.filter(i => i.incident_type === "MEDICAL"));

      const passData = await invoke<any[]>("list_passengers");
      setPassengers(passData);

      const dir = await invoke<string>("get_default_download_dir");
      setSaveDir(dir);
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  };

  const handleSelectIncident = (inc: any) => {
    setSelectedIncident(inc);
    setErrorMsg(null);
    setSuccessMsg(null);
    setClearanceId(null);
    setAssessmentNotes("");

    const matchedPassenger = passengers.find(p => 
      inc.description.toLowerCase().includes(p.display_name.toLowerCase()) ||
      (inc.submitting_officer_name && inc.submitting_officer_name.toLowerCase() === p.display_name.toLowerCase())
    );

    if (matchedPassenger) {
      handleSelectPassenger(matchedPassenger);
    } else {
      setSelectedPassenger(null);
      setPassengerProfile(null);
    }
  };

  const handleSelectPassenger = async (passenger: any) => {
    setSelectedPassenger(passenger);
    try {
      const profile = await invoke<any>("get_passenger_medical_profile", { passengerId: passenger.passenger_id });
      setPassengerProfile(profile);
    } catch (err: any) {
      setErrorMsg("Failed to load passenger profile: " + err.toString());
    }
  };

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

  const handleRefuseAssessment = async () => {
    if (!selectedIncident) {
      setErrorMsg("Please select an incident first.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const desc = `Assessment refused by Medical Officer ${user.display_name} for incident ${selectedIncident.incident_id}`;
      await invoke("record_action", {
        accountId: user.user_id,
        action: "Refuse Assessment",
        description: desc,
      });

      if (selectedPassenger) {
        await invoke("update_passenger_status", {
          passengerId: selectedPassenger.passenger_id,
          status: "Disembarked",
        });
      }

      const key = `employee_notifications_Safety Officer`;
      const notifs = JSON.parse(localStorage.getItem(key) || "[]");
      const newNotif = {
        id: `refusal-${selectedIncident.incident_id}-${Date.now()}`,
        title: "Assessment Refused",
        body: `Medical Officer refused assessment for incident ${selectedIncident.incident_id.slice(0, 8)}.`,
        time: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify([newNotif, ...notifs]));

      setErrorMsg("Assessment refused - clearance cannot be issued.");
      setSelectedIncident(null);
      setSelectedPassenger(null);
      setPassengerProfile(null);
      await loadInitialData();
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClearance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) {
      setErrorMsg("Please select an incident first.");
      return;
    }
    if (!assessmentNotes.trim()) {
      setErrorMsg("Assessment notes are required before decision can be confirmed.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const newClearanceId = await invoke<string>("save_medical_clearance", {
        payload: {
          incident_id: selectedIncident.incident_id,
          fit_to_continue: fitToContinue,
          assessment_notes: assessmentNotes.trim(),
          issued_by: user.user_id,
        }
      });

      if (selectedPassenger) {
        await invoke("update_passenger_status", {
          passengerId: selectedPassenger.passenger_id,
          status: fitToContinue ? "Fit to Continue" : "Disembarked",
        });
      }

      setClearanceId(newClearanceId);
      setSuccessMsg("Medical Clearance document generated and passenger status updated successfully.");
      
      const passName = selectedPassenger ? selectedPassenger.display_name : "Passenger";
      const outcomeText = fitToContinue ? "Fit to Continue" : "Disembarked";
      
      const key = `employee_notifications_Safety Officer`;
      const notifs = JSON.parse(localStorage.getItem(key) || "[]");
      const newNotif = {
        id: `clearance-${newClearanceId}-${Date.now()}`,
        title: "Clearance Decision",
        body: `${passName} has been cleared as '${outcomeText}' by Medical Officer.`,
        time: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify([newNotif, ...notifs]));

      await loadInitialData();
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!clearanceId) {
      setErrorMsg("No clearance document generated yet.");
      return;
    }
    if (!saveDir) {
      setErrorMsg("Please select a save directory first.");
      return;
    }

    setPdfLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const base64 = await invoke<string>("generate_clearance_pdf", { clearanceId });
      const filename = `medical_clearance_${clearanceId.slice(0, 8)}.pdf`;
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

  const filteredIncidents = incidents.filter(inc => 
    inc.description.toLowerCase().includes(searchIncidentQuery.toLowerCase()) ||
    inc.location.toLowerCase().includes(searchIncidentQuery.toLowerCase())
  );

  const filteredPassengers = passengers.filter(p => 
    p.display_name.toLowerCase().includes(searchPassengerQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchPassengerQuery.toLowerCase())
  );

  return (
    <Dashboard activeItem={activeItem} activeSection={activeSection} setActiveItem={setActiveItem} setActiveSection={setActiveSection}>
      <div className="hp-page-header-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="hp-title-giant">Medical Clearance Console</h1>
          <p className="hp-subtitle-clean">Assess passenger condition post-incident and issue fit-to-sail voyage clearances.</p>
        </div>
        <button onClick={() => navigate("/home")} className="hp-btn-primary-sharp hp-btn-secondary-sharp">
          Back to Dashboard
        </button>
      </div>

      {errorMsg && (
        <div className="hp-error-banner">
          <i className="fa-solid fa-circle-exclamation" />
          <span>{errorMsg}</span>
        </div>
      )}

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
        <button type="button" onClick={handleChangeDirectory} className="mil-dest-btn">
          Change Folder
        </button>
      </div>

      <div className="hp-grid-2">
        <div className="hp-form-card-sharp">
          <h2>Select Prior Medical Incident</h2>
          <div className="mil-search-wrapper">
            <i className="fa-solid fa-magnifying-glass mil-search-icon" />
            <input
              type="text"
              placeholder="Search by location or description..."
              value={searchIncidentQuery}
              onChange={(e) => setSearchIncidentQuery(e.target.value)}
              className="mil-search-input"
            />
          </div>
          <div className="mil-list-scroll">
            {filteredIncidents.map(inc => (
              <div
                key={inc.incident_id}
                onClick={() => handleSelectIncident(inc)}
                className={`mil-list-item ${selectedIncident?.incident_id === inc.incident_id ? "mil-active" : ""}`}
              >
                <div className="mil-list-item-header">
                  <span className="mil-list-item-title">
                    <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6, color: "#f59e0b" }} />
                    Medical — {inc.severity}
                  </span>
                  <span className="mil-list-item-date">{new Date(inc.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mil-list-item-desc">{inc.description.slice(0, 85)}...</p>
                <span className="mil-list-item-loc">
                  <i className="fa-solid fa-location-dot" />
                  {inc.location}
                </span>
              </div>
            ))}
            {filteredIncidents.length === 0 && (
              <div className="mil-empty-state">
                <i className="fa-regular fa-folder-open" />
                <p>No medical incidents found.</p>
              </div>
            )}
          </div>

          <h2 style={{ marginTop: 24 }}>Select Passenger Profile</h2>
          <div className="mil-search-wrapper">
            <i className="fa-solid fa-magnifying-glass mil-search-icon" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchPassengerQuery}
              onChange={(e) => setSearchPassengerQuery(e.target.value)}
              className="mil-search-input"
            />
          </div>
          <div className="mil-list-scroll">
            {filteredPassengers.map(p => (
              <div
                key={p.passenger_id}
                onClick={() => handleSelectPassenger(p)}
                className={`mil-passenger-item ${selectedPassenger?.passenger_id === p.passenger_id ? "mil-active" : ""}`}
              >
                <div className="mil-passenger-avatar" style={{ overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.profile_picture ? (
                    <img
                      src={p.profile_picture}
                      alt="Avatar"
                      className="mil-passenger-avatar-img"
                    />
                  ) : (
                    p.display_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
                  )}
                </div>
                <div className="mil-passenger-info">
                  <div className="mil-passenger-name">{p.display_name}</div>
                  <div className="mil-passenger-meta">{p.email}</div>
                </div>
                <span className={`mil-passenger-status-badge ${p.status?.toLowerCase().replace(/\s+/g, '-')}`}>{p.status}</span>
              </div>
            ))}
            {filteredPassengers.length === 0 && (
              <div className="mil-empty-state">
                <i className="fa-regular fa-user" />
                <p>No passengers found.</p>
              </div>
            )}
          </div>
        </div>

        <div className="hp-form-card-sharp">
          <h2>Clearance Details & Manifest Profile</h2>
          
          {selectedIncident && (
            <div className="hp-report-card" style={{ margin: "0 0 16px 0", padding: "12px", background: "#fdfdfd" }}>
              <h4>Selected Incident Record</h4>
              <p className="hp-text-muted-12"><strong>Location:</strong> {selectedIncident.location}</p>
              <p className="hp-text-muted-12"><strong>Details:</strong> {selectedIncident.description}</p>
              {selectedIncident.medical_details && (
                <>
                  <p className="hp-text-muted-12"><strong>Treatment:</strong> {selectedIncident.medical_details.treatment_given || "None"}</p>
                  <p className="hp-text-muted-12"><strong>Outcome:</strong> {selectedIncident.medical_details.outcome || "None"}</p>
                </>
              )}
            </div>
          )}

          {passengerProfile ? (
            <div className="hp-report-card" style={{ margin: "0 0 16px 0", padding: "12px", background: "#f8f9fa" }}>
              <h4>Passenger Manifest Profile</h4>
              <p className="hp-text-muted-12"><strong>Name:</strong> {passengerProfile.display_name}</p>
              <p className="hp-text-muted-12"><strong>Email:</strong> {passengerProfile.email}</p>
              <p className="hp-text-muted-12"><strong>Status Tier:</strong> {passengerProfile.status}</p>
              <p className="hp-text-muted-12"><strong>Cabin Preference:</strong> {passengerProfile.cabin_preference || "None"}</p>
              <p className="hp-text-muted-12"><strong>Dietary Notes:</strong> {passengerProfile.dietary_notes || "None"}</p>
              <p className="hp-text-muted-12"><strong>Special Requests:</strong> {passengerProfile.special_requests || "None"}</p>
            </div>
          ) : (
            <p className="hp-text-empty-announcement">No passenger selected or loaded.</p>
          )}

          {selectedIncident && (
            <form onSubmit={handleSubmitClearance} className="hp-margin-top-12">
              <div className="hp-field">
                <label>Voyage Fitness Decision</label>
                <select 
                  className="hp-select-sharp" 
                  value={fitToContinue ? "Fit" : "NotFit"} 
                  onChange={(e) => setFitToContinue(e.target.value === "Fit")}
                >
                  <option value="Fit">Fit to Continue Voyage (Clearance Issued)</option>
                  <option value="NotFit">Not Fit (Disembarkation Recommended)</option>
                </select>
              </div>

              <div className="hp-field hp-margin-top-12">
                <label>Written Assessment Notes</label>
                <textarea
                  placeholder="Enter detailed clinical assessment findings and reasoning..."
                  className="hp-textarea-field"
                  value={assessmentNotes}
                  onChange={(e) => setAssessmentNotes(e.target.value)}
                  required
                />
              </div>

              <div className="hp-form-buttons-row hp-margin-top-16">
                <button type="submit" className="hp-btn-primary-sharp" disabled={submitting}>
                  {submitting ? "Processing..." : "Confirm Clearance"}
                </button>
                <button type="button" onClick={handleRefuseAssessment} className="hp-btn-primary-sharp hp-btn-secondary-sharp" disabled={submitting}>
                  Refuse Assessment
                </button>
              </div>
            </form>
          )}

          {clearanceId && (
            <div className="hp-margin-top-20">
              <button 
                type="button" 
                onClick={handleDownloadPdf} 
                className="hp-btn-primary-sharp hp-btn-pdf"
                disabled={pdfLoading}
              >
                <i className="fa-solid fa-file-pdf" />
                {pdfLoading ? "Downloading..." : "Download Clearance Certificate"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Dashboard>
  );
}
