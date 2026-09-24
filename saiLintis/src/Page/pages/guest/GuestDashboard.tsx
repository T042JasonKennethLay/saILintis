import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { LoadingScreen } from "../../components/LoadingScreen";
import "../../../GuestDashboard.css";
import "../../../ItDashboard.css";
import videoBackground from "../../../assets/Kny5Ty8J6mn9PsM1TGpXsWNtNh4.mp4";

export function GuestDashboard() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [applyVacancy, setApplyVacancy] = useState<any>(null);
  const [applyName, setApplyName] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [applyCv, setApplyCv] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const annList = await invoke<any[]>("view_ship_announcement");
      setAnnouncements(annList);

      const vacList = await invoke<any[]>("list_job_vacancies");
      const openVacancies = vacList.filter((v) => v.status === "Open");
      setVacancies(openVacancies);
    } catch (err) {
      setErrorMsg("Failed to load guest data: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = (vac: any) => {
    setApplyVacancy(vac);
    setApplyName("");
    setApplyEmail("");
    setApplyCv("");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setErrorMsg("Only PDF files are allowed");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setApplyCv(reader.result as string);
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read PDF file");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!applyName.trim()) {
      setErrorMsg("Full name is required");
      return;
    }
    if (!applyEmail.trim() || !applyEmail.includes("@")) {
      setErrorMsg("A valid email address is required");
      return;
    }
    if (!applyCv) {
      setErrorMsg("CV document file (PDF) is required");
      return;
    }

    setLoading(true);
    try {
      await invoke("apply_for_job", {
        payload: {
          vacancy_id: applyVacancy.vacancy_id,
          full_name: applyName,
          email: applyEmail,
          cv_document: applyCv,
        },
      });

      const isShortCv = applyCv.length < 4000 || applyCv.toLowerCase().includes("incomplete");
      if (isShortCv) {
        setSuccessMsg("Application registered, but flagged as INCOMPLETE by the system due to insufficient CV detail. You may need to resubmit.");
      } else {
        setSuccessMsg("Application submitted successfully! Our HR team will review your CV shortly.");
      }

      setApplyVacancy(null);
      loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gd-root">
      <LoadingScreen visible={loading} />
      <video autoPlay muted loop className="video-background gd-video-bg">
        <source src={videoBackground} type="video/mp4" />
      </video>
      <div className="gd-overlay" />

      <div className="gd-container">
        <div className="gd-header">
          <div className="gd-flex-center-gap">
            <span className="gd-brand-title">saiLintis Guest Portal</span>
          </div>
          <Link to="/login" className="it-btn gd-back-btn">
            <i className="fa-solid fa-arrow-left-long gd-mr-8" /> Back to Login
          </Link>
        </div>

        {errorMsg && <div className="it-error-message gd-error-box">{errorMsg}</div>}
        {successMsg && <div className="it-success-message gd-success-box">{successMsg}</div>}

        <div className="gd-grid">
          
          <div className="gd-col-flex">
            <div className="gd-panel">
              <h3 className="gd-panel-title">
                <i className="fa-solid fa-bullhorn gd-mr-10" /> Ship Announcements
              </h3>
              <div className="gd-ann-list">
                {announcements.map((ann) => (
                  <div key={ann.id} className="gd-ann-item">
                    <h4 className="gd-ann-title">{ann.title}</h4>
                    <p className="gd-ann-content">{ann.content}</p>
                    <span className="gd-ann-date">{new Date(ann.date).toLocaleDateString()}</span>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <p className="gd-ann-empty">No official announcements posted yet.</p>
                )}
              </div>
            </div>

            <div className="gd-panel">
              <h3 className="gd-register-title">Become a Passenger</h3>
              <p className="gd-register-desc">
                Savor fine international cuisine, luxury dining, activities, and performances onboard the magnificent salLintis floating palace.
              </p>
              <Link to="/register" className="hp-btn-primary-sharp gd-register-btn">
                Register Passenger Account
              </Link>
            </div>
          </div>

          <div className="gd-careers-panel">
            <h2 className="gd-careers-title">
              <i className="fa-solid fa-briefcase gd-mr-12" /> Open Recruitment & Careers
            </h2>
            <p className="gd-careers-desc">
              We are hiring! Join our elite cruise crew. Browse the listings below and submit your CV directly to our HR Manager clearance desk.
            </p>

            <div className="gd-vacancies-list">
              {vacancies.map((vac) => (
                <div key={vac.vacancy_id} className="gd-vacancy-card">
                  <div className="gd-flex-1">
                    <h3 className="gd-vacancy-title">{vac.title}</h3>
                    <div className="gd-vacancy-desc">
                      <strong>Description:</strong><br />{vac.description}
                    </div>
                    <div className="gd-vacancy-reqs">
                      <strong>Requirements:</strong><br />{vac.requirements}
                    </div>
                    <div className="gd-vacancy-deadline">
                      <i className="fa-regular fa-clock gd-mr-6" />
                      Apply before: {new Date(vac.deadline).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleApplyClick(vac)}
                    className="hp-btn-primary-sharp gd-apply-btn"
                  >
                    Apply Now
                  </button>
                </div>
              ))}
              {vacancies.length === 0 && (
                <div className="gd-vacancies-empty">
                  <i className="fa-solid fa-folder-open gd-empty-icon" />
                  <p>There are no active job vacancy openings at this moment. Please check back later.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {applyVacancy && createPortal(
        <div className="gd-modal-overlay" onClick={() => setApplyVacancy(null)}>
          <div className="gd-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="gd-modal-header">Apply for {applyVacancy.title}</div>
            <form onSubmit={handleSubmitApplication}>
              <div className="gd-modal-body">
                
                <div className="hp-field gd-mb-16">
                  <label className="gd-input-label">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alice Margatroid"
                    value={applyName}
                    onChange={(e) => setApplyName(e.target.value)}
                    className="it-input gd-modal-input"
                  />
                </div>

                <div className="hp-field gd-mb-16">
                  <label className="gd-input-label">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. alice@example.com"
                    value={applyEmail}
                    onChange={(e) => setApplyEmail(e.target.value)}
                    className="it-input gd-modal-input"
                  />
                </div>

                <div className="hp-field gd-mb-16">
                  <label className="gd-input-label">Upload CV Document (PDF Only)</label>
                  <input
                    type="file"
                    accept=".pdf"
                    required
                    onChange={handleFileChange}
                    className="it-input gd-modal-input"
                  />
                  <small className="gd-input-help">
                    *Only PDF files are allowed. PDF files under 3KB or marked as incomplete will be automatically flagged by the system.
                  </small>
                </div>

              </div>
              <div className="gd-modal-footer">
                <button type="button" className="it-btn gd-cancel-btn" onClick={() => setApplyVacancy(null)}>Cancel</button>
                <button type="submit" className="it-btn it-btn-primary gd-submit-btn">Submit Application</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
