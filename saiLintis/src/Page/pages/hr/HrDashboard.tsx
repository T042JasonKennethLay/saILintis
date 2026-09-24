import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import { LoadingScreen } from "../../components/LoadingScreen";
import "../../../ItDashboard.css";
import "../../../HrDashboard.css";

export function HrDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const hasAccess = user.role_name === "HR Manager" || (Array.isArray(user.accessible_modules) && user.accessible_modules.includes("crew_recruitment"));

  const [activeItem, setActiveItem] = useState("Recruitment & Screening");
  const [activeSection, setActiveSection] = useState("Overview");

  const [tab, setTab] = useState<"vacancies" | "candidates">("vacancies");
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [vacancyFormOpen, setVacancyFormOpen] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<any>(null);
  const [vacancyTitle, setVacancyTitle] = useState("");
  const [vacancyDescription, setVacancyDescription] = useState("");
  const [vacancyRequirements, setVacancyRequirements] = useState("");
  const [vacancyDeadline, setVacancyDeadline] = useState("");
  const [vacancyStatus, setVacancyStatus] = useState("Open");

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [shortlistModalOpen, setShortlistModalOpen] = useState(false);
  const [assignedVoyage, setAssignedVoyage] = useState("");
  const [assignedCapacity, setAssignedCapacity] = useState("");

  const [candidateFilterVacancy, setCandidateFilterVacancy] = useState("");
  const [candidateFilterStatus, setCandidateFilterStatus] = useState("");

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
  }, [hasAccess, tab, candidateFilterVacancy]);

  const loadData = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      if (tab === "vacancies") {
        const list = await invoke<any[]>("list_job_vacancies");
        setVacancies(list);
      } else {
        const list = await invoke<any[]>("list_candidates", {
          vacancyId: candidateFilterVacancy || null,
        });
        setCandidates(list);
        const rolesList = await invoke<any[]>("get_available_roles");
        const filteredRoles = rolesList.filter((r) => r.role_name !== "Passenger");
        setRoles(filteredRoles);
        if (filteredRoles.length > 0 && !assignedCapacity) {
          setAssignedCapacity(filteredRoles[0].role_name);
        }
      }
      const vacList = await invoke<any[]>("list_job_vacancies");
      setVacancies(vacList);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateVacancy = () => {
    setEditingVacancy(null);
    setVacancyTitle("");
    setVacancyDescription("");
    setVacancyRequirements("");
    setVacancyDeadline("");
    setVacancyStatus("Open");
    setVacancyFormOpen(true);
  };

  const handleOpenEditVacancy = (vac: any) => {
    setEditingVacancy(vac);
    setVacancyTitle(vac.title);
    setVacancyDescription(vac.description);
    setVacancyRequirements(vac.requirements);
    
    let formattedDate = "";
    if (vac.deadline) {
      const d = new Date(vac.deadline);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      formattedDate = localISOTime;
    }
    
    setVacancyDeadline(formattedDate);
    setVacancyStatus(vac.status);
    setVacancyFormOpen(true);
  };

  const handleSaveVacancy = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      if (editingVacancy) {
        await invoke("update_job_vacancy", {
          payload: {
            vacancy_id: editingVacancy.vacancy_id,
            title: vacancyTitle,
            description: vacancyDescription,
            requirements: vacancyRequirements,
            deadline: vacancyDeadline,
            status: vacancyStatus,
            user_id: user.user_id,
          },
        });
        setSuccessMsg("Job vacancy updated successfully!");
      } else {
        await invoke("create_job_vacancy", {
          payload: {
            title: vacancyTitle,
            description: vacancyDescription,
            requirements: vacancyRequirements,
            deadline: vacancyDeadline,
            status: vacancyStatus,
            user_id: user.user_id,
          },
        });
        setSuccessMsg("Job vacancy created successfully!");
      }
      setVacancyFormOpen(false);
      loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVacancy = async (id: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("delete_job_vacancy", {
        payload: {
          vacancy_id: id,
          user_id: user.user_id,
        },
      });
      setSuccessMsg("Job vacancy deleted successfully!");
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleScreenCandidate = async (candidateId: string, status: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    if (status === "Shortlisted") {
      const cand = candidates.find((c) => c.candidate_id === candidateId);
      setSelectedCandidate(cand);
      setAssignedVoyage("Voyage V1 (Singapore - Phuket - Bali)");
      setShortlistModalOpen(true);
      return;
    }

    setLoading(true);
    try {
      await invoke("screen_candidate", {
        payload: {
          candidate_id: candidateId,
          status,
          assigned_voyage: null,
          assigned_capacity: null,
          user_id: user.user_id,
        },
      });
      setSuccessMsg(`Candidate screening updated to ${status}`);
      loadData();
      if (selectedCandidate && selectedCandidate.candidate_id === candidateId) {
        setSelectedCandidate(null);
      }
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmShortlist = async () => {
    if (!assignedVoyage.trim()) {
      setErrorMsg("Voyage assignment is required");
      return;
    }
    if (!assignedCapacity.trim()) {
      setErrorMsg("Capacity / Role assignment is required");
      return;
    }
    if (assignedCapacity.trim() === "Passenger") {
      setErrorMsg("Cannot assign Passenger capacity for recruitment");
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("screen_candidate", {
        payload: {
          candidate_id: selectedCandidate.candidate_id,
          status: "Shortlisted",
          assigned_voyage: assignedVoyage,
          assigned_capacity: assignedCapacity,
          user_id: user.user_id,
        },
      });
      setSuccessMsg("Candidate shortlisted and assigned successfully!");
      setShortlistModalOpen(false);
      loadData();
      setSelectedCandidate(null);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (candidateFilterStatus && c.status !== candidateFilterStatus) {
      return false;
    }
    return true;
  });

  if (!hasAccess) {
    return (
      <div className="it-access-denied">
        <div className="it-access-denied-icon">
          <i className="fa fa-lock" />
        </div>
        <h1>Access Restricted</h1>
        <p>This workspace is reserved for the HR Manager. You will be automatically redirected back to the Homepage shortly.</p>
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
        <div className="ps-title-section">
          <h1 className="hp-title-giant">Recruitment & Screening</h1>
          <p className="hp-subtitle-clean">Manage postings, read incoming CV applications, and assign crew to voyages.</p>
        </div>

        {errorMsg && <div className="it-error-message">{errorMsg}</div>}
        {successMsg && <div className="it-success-message">{successMsg}</div>}

        <div className="hr-tabs-row">
          <button
            onClick={() => { setTab("vacancies"); setSelectedCandidate(null); }}
            className={`it-btn ${tab === "vacancies" ? "it-btn-primary" : ""} hr-tab-btn`}
          >
            <i className="fa-solid fa-briefcase hr-tab-icon" />
            Job Postings
          </button>
          <button
            onClick={() => setTab("candidates")}
            className={`it-btn ${tab === "candidates" ? "it-btn-primary" : ""} hr-tab-btn`}
          >
            <i className="fa-solid fa-user-tie hr-tab-icon" />
            Candidates Screening
          </button>
        </div>

        {tab === "vacancies" && (
          <div className="it-card">
            <div className="hr-section-header">
              <div>
                <h2 className="it-section-title">Active Vacancies</h2>
                <p className="it-section-desc">Create and configure jobs and deadlines for crew recruitment.</p>
              </div>
              <button className="hp-btn-primary-sharp" onClick={handleOpenCreateVacancy}>
                <i className="fa fa-plus hr-tab-icon" /> Create Listing
              </button>
            </div>

            <div className="it-table-container">
              <table className="it-table">
                <thead>
                  <tr>
                    <th>Job Title</th>
                    <th>Status</th>
                    <th>Applicants</th>
                    <th>Deadline</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vacancies.map((vac) => (
                    <tr key={vac.vacancy_id}>
                      <td>
                        <strong className="it-emp-name">{vac.title}</strong>
                        <div className="it-emp-username hr-candidate-row">
                          {vac.requirements}
                        </div>
                      </td>
                      <td>
                        <span className={`it-status ${vac.status === "Open" ? "active" : vac.status === "Closed" ? "inactive" : "pending"}`}>
                          {vac.status}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setCandidateFilterVacancy(vac.vacancy_id);
                            setTab("candidates");
                          }}
                          className="hr-candidate-link"
                        >
                          {vac.candidate_count} candidates
                        </button>
                      </td>
                      <td>{new Date(vac.deadline).toLocaleDateString()}</td>
                      <td className="it-actions">
                        <button className="it-btn" onClick={() => handleOpenEditVacancy(vac)}>
                          <i className="fa fa-edit" /> Edit
                        </button>
                        <button className="it-btn it-btn-danger" onClick={() => setDeleteConfirmId(vac.vacancy_id)}>
                          <i className="fa fa-trash" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {vacancies.length === 0 && (
                    <tr>
                      <td colSpan={5} className="it-logs-empty hr-empty-cell">
                        No job postings found. Click "Create Listing" to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "candidates" && (
          <div className={`hr-grid ${selectedCandidate ? "split" : ""}`}>
            <div className="it-card">
              <h2 className="it-section-title">Applicants Screening Queue</h2>
              <p className="it-section-desc">Review inbound CV submissions, tag incomplete files, and shortlist candidates.</p>

              <div className="hr-filter-row">
                <div className="hr-flex1">
                  <label className="it-input-label">Filter by Listing</label>
                  <select
                    value={candidateFilterVacancy}
                    onChange={(e) => setCandidateFilterVacancy(e.target.value)}
                    className="it-select"
                  >
                    <option value="">All Job Openings</option>
                    {vacancies.map((v) => (
                      <option key={v.vacancy_id} value={v.vacancy_id}>{v.title}</option>
                    ))}
                  </select>
                </div>
                <div className="hr-flex1">
                  <label className="it-input-label">Filter by Status</label>
                  <select
                    value={candidateFilterStatus}
                    onChange={(e) => setCandidateFilterStatus(e.target.value)}
                    className="it-select"
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Shortlisted">Shortlisted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Incomplete">Incomplete</option>
                  </select>
                </div>
              </div>

              <div className="it-table-container">
                <table className="it-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Job Post</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.map((cand) => (
                      <tr
                        key={cand.candidate_id}
                        onClick={() => setSelectedCandidate(cand)}
                        className={`hr-candidate-row ${selectedCandidate?.candidate_id === cand.candidate_id ? "selected" : ""}`}
                      >
                        <td>
                          <strong>{cand.full_name}</strong>
                          <div className="it-emp-username">{cand.email}</div>
                        </td>
                        <td>{cand.vacancy_title || "Unknown"}</td>
                        <td>
                          <span className={`it-status ${cand.status === "Shortlisted" ? "active" : cand.status === "Rejected" ? "inactive" : cand.status === "Incomplete" ? "inactive" : "pending"}`}>
                            {cand.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredCandidates.length === 0 && (
                      <tr>
                        <td colSpan={3} className="it-logs-empty hr-empty-cell">
                          No candidates match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedCandidate && (
              <div className="it-card hr-preview-card">
                <div className="hr-preview-header">
                  <h3 className="it-section-title hr-preview-title">Candidate Profile</h3>
                  <button onClick={() => setSelectedCandidate(null)} className="it-btn hr-close-btn">Close Preview</button>
                </div>

                <div className="hr-profile-meta">
                  <div className="hr-profile-name">{selectedCandidate.full_name}</div>
                  <div className="hr-profile-email">Email: {selectedCandidate.email}</div>
                  <div className="hr-profile-job">Job: <strong>{selectedCandidate.vacancy_title}</strong></div>
                  <div className="hr-profile-status-row">
                    Status: <span className={`it-status ${selectedCandidate.status === "Shortlisted" ? "active" : selectedCandidate.status === "Rejected" ? "inactive" : selectedCandidate.status === "Incomplete" ? "inactive" : "pending"}`}>{selectedCandidate.status}</span>
                  </div>
                  {selectedCandidate.assigned_voyage && (
                    <div className="hr-profile-assigned-row">
                      <i className="fa-solid fa-ship hr-tab-icon" />
                      Assigned: {selectedCandidate.assigned_voyage} ({selectedCandidate.assigned_capacity})
                    </div>
                  )}
                </div>

                <div className="hr-cv-body">
                  <strong className="hr-cv-label">CV Document:</strong>
                  {selectedCandidate.cv_document?.startsWith("data:application/pdf;base64,") ? (
                    <div className="hr-cv-pdf-container">
                      <iframe
                        src={selectedCandidate.cv_document}
                        title="CV PDF View"
                        width="100%"
                        className="hr-cv-iframe"
                      />
                      <a
                        href={selectedCandidate.cv_document}
                        download={`${selectedCandidate.full_name}_CV.pdf`}
                        className="it-btn hr-cv-download-btn"
                      >
                        <i className="fa-solid fa-download hr-tab-icon" /> Download PDF
                      </a>
                    </div>
                  ) : (
                    <pre className="hr-cv-pre">
                      {selectedCandidate.cv_document || "No CV document content."}
                    </pre>
                  )}
                </div>

                <div className="hr-action-row">
                  <button
                    onClick={() => handleScreenCandidate(selectedCandidate.candidate_id, "Shortlisted")}
                    className="it-btn it-btn-success hr-flex1"
                  >
                    <i className="fa fa-check hr-tab-icon" /> Shortlist
                  </button>
                  <button
                    onClick={() => handleScreenCandidate(selectedCandidate.candidate_id, "Rejected")}
                    className="it-btn it-btn-danger hr-flex1"
                  >
                    <i className="fa fa-xmark hr-tab-icon" /> Reject
                  </button>
                  <button
                    onClick={() => handleScreenCandidate(selectedCandidate.candidate_id, "Incomplete")}
                    className="it-btn hr-flex1"
                  >
                    <i className="fa-solid fa-flag hr-tab-icon" /> Incomplete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {vacancyFormOpen && createPortal(
        <div className="it-modal-overlay" onClick={() => setVacancyFormOpen(false)}>
          <div className="it-modal-card hr-modal-max-width" onClick={(e) => e.stopPropagation()}>
            <div className="it-modal-header">{editingVacancy ? "Edit Job Listing" : "Create New Job Listing"}</div>
            <form onSubmit={handleSaveVacancy}>
              <div className="it-modal-body hr-modal-body-scroll">
                <div className="hp-field hr-field-row">
                  <label className="it-input-label">Job Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lead Cabin Steward"
                    value={vacancyTitle}
                    onChange={(e) => setVacancyTitle(e.target.value)}
                    className="it-input"
                  />
                </div>

                <div className="hp-field hr-field-row">
                  <label className="it-input-label">Job Description</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe roles, schedule responsibilities..."
                    value={vacancyDescription}
                    onChange={(e) => setVacancyDescription(e.target.value)}
                    className="it-input hr-textarea"
                  />
                </div>

                <div className="hp-field hr-field-row">
                  <label className="it-input-label">Job Requirements & Key Clearances</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Certifications, mandatory cruise ship experience..."
                    value={vacancyRequirements}
                    onChange={(e) => setVacancyRequirements(e.target.value)}
                    className="it-input hr-textarea"
                  />
                </div>

                <div className="hp-field hr-field-row">
                  <label className="it-input-label">Application Deadline</label>
                  <input
                    type="datetime-local"
                    required
                    value={vacancyDeadline}
                    onChange={(e) => setVacancyDeadline(e.target.value)}
                    className="it-input"
                  />
                </div>

                <div className="hp-field hr-field-row">
                  <label className="it-input-label">Publication Status</label>
                  <select
                    value={vacancyStatus}
                    onChange={(e) => setVacancyStatus(e.target.value)}
                    className="it-select"
                  >
                    <option value="Open">Open (Live Intake)</option>
                    <option value="Draft">Draft (Hidden)</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="it-modal-footer">
                <button type="button" className="it-btn" onClick={() => setVacancyFormOpen(false)}>Cancel</button>
                <button type="submit" className="it-btn it-btn-primary">Save Publication</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {deleteConfirmId && createPortal(
        <div className="it-modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="it-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="it-modal-header it-modal-header-alert">Confirm Deletion</div>
            <div className="it-modal-body">
              Are you sure you want to delete this job vacancy listing? This will permanently delete the post and cascade remove all submitted candidate files.
            </div>
            <div className="it-modal-footer">
              <button className="it-btn" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button className="it-btn it-btn-danger" onClick={() => handleDeleteVacancy(deleteConfirmId)}>Delete Permanently</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {shortlistModalOpen && selectedCandidate && createPortal(
        <div className="it-modal-overlay" onClick={() => setShortlistModalOpen(false)}>
          <div className="it-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="it-modal-header">Voyage & Role Assignment</div>
            <div className="it-modal-body">
              <p>Assign <strong>{selectedCandidate.full_name}</strong> to their active voyage duty station and system role profile.</p>

              <div className="hp-field hr-field-row">
                <label className="it-input-label">Assign Voyage Schedule</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Voyage V1 (Singapore - Phuket)"
                  value={assignedVoyage}
                  onChange={(e) => setAssignedVoyage(e.target.value)}
                  className="it-input"
                />
              </div>

              <div className="hp-field hr-field-row">
                <label className="it-input-label">Assign Capacity / Official Role</label>
                <select
                  value={assignedCapacity}
                  onChange={(e) => setAssignedCapacity(e.target.value)}
                  className="it-select"
                >
                  {roles.map((r) => (
                    <option key={r.role_id} value={r.role_name}>{r.role_name} ({r.department})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="it-modal-footer">
              <button className="it-btn" onClick={() => setShortlistModalOpen(false)}>Cancel</button>
              <button className="it-btn it-btn-primary" onClick={handleConfirmShortlist}>Shortlist Candidate</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <LoadingScreen visible={loading} />
    </Dashboard>
  );
}
