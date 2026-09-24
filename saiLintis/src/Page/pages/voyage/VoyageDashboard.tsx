import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import "../../../Home.css";

interface Ship {
  ship_id: string;
  ship_name: string;
  capacity: number;
}

interface Voyage {
  voyage_id: string;
  destination: string;
  departure_date: string;
  turnaround_buffer: number;
  port_dwell_time: number;
  contingency_margin: number;
  ship_id: string | null;
  ship_name: string | null;
  status: string;
  created_by: string;
  created_at: string;
  occupancy_count: number;
  capacity: number;
}

interface OccupancyStats {
  historical_occupancy: number;
  current_occupancy: number;
  future_occupancy: number;
}

export function VoyageDashboard() {
  const [activeItem, setActiveItem] = useState("Voyage Management");
  const [activeSection, setActiveSection] = useState("Overview");

  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [stats, setStats] = useState<OccupancyStats>({
    historical_occupancy: 0.0,
    current_occupancy: 0.0,
    future_occupancy: 0.0,
  });

  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [turnaroundBuffer, setTurnaroundBuffer] = useState<number>(12);
  const [portDwellTime, setPortDwellTime] = useState<number>(6);
  const [contingencyMargin, setContingencyMargin] = useState<number>(4);
  const [shipId, setShipId] = useState<string>("");

  const [editingVoyage, setEditingVoyage] = useState<Voyage | null>(null);
  const [editDestination, setEditDestination] = useState("");
  const [editDepartureDate, setEditDepartureDate] = useState("");
  const [editTurnaroundBuffer, setEditTurnaroundBuffer] = useState<number>(12);
  const [editPortDwellTime, setEditPortDwellTime] = useState<number>(6);
  const [editContingencyMargin, setEditContingencyMargin] = useState<number>(4);
  const [editStatus, setEditStatus] = useState("Upcoming");

  const [assigningVoyage, setAssigningVoyage] = useState<Voyage | null>(null);
  const [assignShipId, setAssignShipId] = useState<string>("");

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [assigningCrewVoyage, setAssigningCrewVoyage] = useState<Voyage | null>(null);
  const [crewAssignments, setCrewAssignments] = useState<any[]>([]);
  const [showCrewModal, setShowCrewModal] = useState(false);
  const [searchCrewQuery, setSearchCrewQuery] = useState("");
  const [activeTab, setActiveTab] = useState("voyages");
  const [selectedVoyageId, setSelectedVoyageId] = useState<string>("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const loadData = async () => {
    try {
      const vList = await invoke<Voyage[]>("voyage_get_voyages");
      setVoyages(vList);

      const sList = await invoke<Ship[]>("voyage_get_ships");
      setShips(sList);

      const sData = await invoke<OccupancyStats>("voyage_get_occupancy_stats");
      setStats(sData);
    } catch (err) {
      setErrorMsg("Failed to load operations data: " + String(err));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "assignments" && selectedVoyageId) {
      const loadCrewAssignments = async () => {
        try {
          const list = await invoke<any[]>("voyage_get_crew_assignments", { voyageId: selectedVoyageId });
          setCrewAssignments(list);
        } catch (err) {
          setErrorMsg("Failed to load crew assignments: " + String(err));
        }
      };
      loadCrewAssignments();
    }
  }, [activeTab, selectedVoyageId]);

  const handleCreateVoyage = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!destination.trim()) {
      setErrorMsg("Destination is required");
      return;
    }
    if (!departureDate) {
      setErrorMsg("Departure date is required");
      return;
    }
    if (turnaroundBuffer < 0 || portDwellTime < 0 || contingencyMargin < 0) {
      setErrorMsg("Buffer times must be non-negative integers");
      return;
    }

    setIsSubmitting(true);
    try {
      const sid = shipId === "" ? null : shipId;
      await invoke("voyage_create_voyage", {
        destination,
        departureDate,
        turnaroundBuffer,
        portDwellTime,
        contingencyMargin,
        shipId: sid,
        userId: user.user_id,
      });

      setSuccessMsg("Voyage schedule successfully created!");
      setShowCreateModal(false);
      setDestination("");
      setDepartureDate("");
      setTurnaroundBuffer(12);
      setPortDwellTime(6);
      setContingencyMargin(4);
      setShipId("");
      await loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateVoyage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoyage) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!editDestination.trim()) {
      setErrorMsg("Destination is required");
      return;
    }
    if (!editDepartureDate) {
      setErrorMsg("Departure date is required");
      return;
    }
    if (editTurnaroundBuffer < 0 || editPortDwellTime < 0 || editContingencyMargin < 0) {
      setErrorMsg("Buffer values must be non-negative");
      return;
    }

    setIsSubmitting(true);
    try {
      let formattedDate = editDepartureDate;
      if (editDepartureDate.includes(" ")) {
        formattedDate = editDepartureDate.replace(" ", "T");
      }

      await invoke("voyage_update_voyage", {
        voyageId: editingVoyage.voyage_id,
        destination: editDestination,
        departureDate: formattedDate,
        turnaroundBuffer: editTurnaroundBuffer,
        portDwellTime: editPortDwellTime,
        contingencyMargin: editContingencyMargin,
        status: editStatus,
      });

      setSuccessMsg("Voyage successfully updated!");
      setEditingVoyage(null);
      await loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVoyage = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this voyage?")) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await invoke("voyage_delete_voyage", { voyageId: id });
      setSuccessMsg("Voyage successfully deleted.");
      await loadData();
    } catch (err) {
      setErrorMsg(String(err));
    }
  };

  const handleAssignShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningVoyage) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    setIsSubmitting(true);
    try {
      const sid = assignShipId === "" ? null : assignShipId;
      await invoke("voyage_assign_ship", {
        voyageId: assigningVoyage.voyage_id,
        shipId: sid,
      });

      setSuccessMsg("Vessel successfully assigned to voyage!");
      setAssigningVoyage(null);
      await loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!announcementTitle.trim() || !announcementContent.trim()) {
      setErrorMsg("Title and content are required to publish announcement");
      return;
    }

    setIsSubmitting(true);
    try {
      await invoke("publish_ship_announcement", {
        title: announcementTitle,
        content: announcementContent,
        sentBy: user.account_id || user.user_id,
      });
      setSuccessMsg("Announcement successfully broadcasted in real-time to all passengers!");
      setAnnouncementTitle("");
      setAnnouncementContent("");
    } catch (err) {
      setErrorMsg("Failed to publish: " + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCrewModal = (v: Voyage) => {
    setActiveTab("assignments");
    setSelectedVoyageId(v.voyage_id);
    setSearchCrewQuery("");
  };

  const handleSaveCrewAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningCrewVoyage) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const assignedIds = crewAssignments
        .filter((c) => c.is_assigned)
        .map((c) => c.account_id);
      await invoke("voyage_set_crew_assignments", {
        voyageId: assigningCrewVoyage.voyage_id,
        accountIds: assignedIds,
      });
      setSuccessMsg("Crew assignments successfully updated for the voyage!");
      setShowCrewModal(false);
      setAssigningCrewVoyage(null);
    } catch (err) {
      setErrorMsg("Failed to update crew assignments: " + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCrew = crewAssignments.filter(
    (c) =>
      c.display_name?.toLowerCase().includes(searchCrewQuery.toLowerCase()) ||
      c.role_name?.toLowerCase().includes(searchCrewQuery.toLowerCase()) ||
      c.username?.toLowerCase().includes(searchCrewQuery.toLowerCase())
  );

  return (
    <Dashboard
      activeItem={activeItem}
      activeSection={activeSection}
      setActiveItem={setActiveItem}
      setActiveSection={setActiveSection}
    >
      <div className="it-container">
        <div className="ps-title-section">
          <h1 className="hp-title-giant">Voyage & Ship Operations</h1>
          <p className="hp-subtitle-clean">
            Schedule itineraries, allocate cruise liners, and monitor guest capacity thresholds.
          </p>
        </div>

        {errorMsg && (
          <div className="hp-error-banner" style={{ marginTop: "16px", borderRadius: "10px" }}>
            <i className="fa-solid fa-circle-exclamation" />
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="hp-banner-dismiss">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mil-success-banner" style={{ marginTop: "16px", borderRadius: "10px" }}>
            <i className="fa-solid fa-circle-check" />
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="hp-banner-dismiss">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        <div className="hr-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginTop: "20px" }}>
          <div className="it-card hp-flex-col" style={{ alignItems: "center", justifyContent: "center", padding: "24px" }}>
            <div style={{ background: "#eff6ff", borderRadius: "50%", padding: "12px", marginBottom: "8px" }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: "#2563eb", fontSize: "24px" }} />
            </div>
            <span style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "#64748b" }}>Historical Occupancy</span>
            <h2 style={{ fontSize: "32px", fontWeight: "800", margin: "8px 0 0 0", color: "#1e293b" }}>
              {stats.historical_occupancy.toFixed(1)}%
            </h2>
          </div>

          <div className="it-card hp-flex-col" style={{ alignItems: "center", justifyContent: "center", padding: "24px" }}>
            <div style={{ background: "#ecfdf5", borderRadius: "50%", padding: "12px", marginBottom: "8px" }}>
              <i className="fa-solid fa-ship" style={{ color: "#10b981", fontSize: "24px" }} />
            </div>
            <span style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "#64748b" }}>Current Occupancy</span>
            <h2 style={{ fontSize: "32px", fontWeight: "800", margin: "8px 0 0 0", color: "#1e293b" }}>
              {stats.current_occupancy.toFixed(1)}%
            </h2>
          </div>

          <div className="it-card hp-flex-col" style={{ alignItems: "center", justifyContent: "center", padding: "24px" }}>
            <div style={{ background: "#fffbeb", borderRadius: "50%", padding: "12px", marginBottom: "8px" }}>
              <i className="fa-solid fa-calendar-days" style={{ color: "#f59e0b", fontSize: "24px" }} />
            </div>
            <span style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "#64748b" }}>Future Bookings Rate</span>
            <h2 style={{ fontSize: "32px", fontWeight: "800", margin: "8px 0 0 0", color: "#1e293b" }}>
              {stats.future_occupancy.toFixed(1)}%
            </h2>
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", gap: "24px", marginTop: "24px", marginBottom: "16px" }}>
          <button
            onClick={() => setActiveTab("voyages")}
            style={{
              padding: "12px 8px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "voyages" ? "2px solid #2563eb" : "2px solid transparent",
              color: activeTab === "voyages" ? "#2563eb" : "#64748b",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <i className="fa-solid fa-ship" style={{ marginRight: "8px" }} />
            Voyage Directory
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            style={{
              padding: "12px 8px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "assignments" ? "2px solid #2563eb" : "2px solid transparent",
              color: activeTab === "assignments" ? "#2563eb" : "#64748b",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <i className="fa-solid fa-users" style={{ marginRight: "8px" }} />
            Crew Assignments
          </button>
        </div>

        {activeTab === "voyages" && (
          <div className="hr-grid split" style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: "24px" }}>
            <div className="it-card" style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 className="it-section-title">Voyage Schedule Directory</h3>
                  <p className="it-section-desc">View, construct, and assign vessels to cruise operations.</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="it-btn it-btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <i className="fa-solid fa-plus" /> Schedule Voyage
                </button>
              </div>

            <table className="it-table" style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Departure Date</th>
                  <th>Buffers (Buffer/Dwell/Cont)</th>
                  <th>Assigned Vessel</th>
                  <th>Occupancy</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {voyages.map((v) => (
                  <tr key={v.voyage_id}>
                    <td style={{ fontWeight: "bold" }}>{v.destination}</td>
                    <td>{new Date(v.departure_date).toLocaleString()}</td>
                    <td>{v.turnaround_buffer}h / {v.port_dwell_time}h / {v.contingency_margin}h</td>
                    <td>
                      {v.ship_name ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <i className="fa-solid fa-anchor" style={{ color: "#2563eb" }} />
                          <span>{v.ship_name}</span>
                        </div>
                      ) : (
                        <span style={{ color: "#ef4444", fontWeight: "bold" }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {v.ship_name ? (
                        <span>{v.occupancy_count} / {v.capacity} ({((v.occupancy_count / v.capacity) * 100).toFixed(0)}%)</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={`hp-tag-sharp ${v.status === "Upcoming" ? "hp-tag-pending" : v.status === "Active" || v.status === "In Progress" ? "hp-tag-active" : "hp-tag-confirmed"}`}>
                        {v.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => handleOpenCrewModal(v)}
                          className="it-btn it-btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: "#6366f1", borderColor: "#6366f1", color: "#ffffff" }}
                          title="Assign Crew"
                        >
                          <i className="fa-solid fa-users" />
                        </button>
                        <button
                          onClick={() => {
                            setAssigningVoyage(v);
                            setAssignShipId(v.ship_id || "");
                          }}
                          className="it-btn it-btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          title="Assign Vessel"
                        >
                          <i className="fa-solid fa-ship" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingVoyage(v);
                            setEditDestination(v.destination);
                            setEditDepartureDate(v.departure_date.substring(0, 16));
                            setEditTurnaroundBuffer(v.turnaround_buffer);
                            setEditPortDwellTime(v.port_dwell_time);
                            setEditContingencyMargin(v.contingency_margin);
                            setEditStatus(v.status);
                          }}
                          className="it-btn it-btn-primary"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          title="Edit Voyage"
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button
                          onClick={() => handleDeleteVoyage(v.voyage_id)}
                          className="it-btn it-btn-danger"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          title="Delete Voyage"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {voyages.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: "24px" }}>
                      No voyage schedules listed. Create a new voyage schedule.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="it-card hp-flex-col" style={{ gap: "16px" }}>
            <div>
              <h3 className="it-section-title">Broadcast Announcement</h3>
              <p className="it-section-desc">Publish real-time announcements to the vessel passengers & crew.</p>
            </div>

            <form onSubmit={handlePublishAnnouncement} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="hp-field">
                <label className="it-input-label" style={{ fontWeight: "bold" }}>Announcement Title</label>
                <input
                  type="text"
                  className="it-input"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="e.g. Turnaround Schedule Buffer Alert"
                  required
                />
              </div>

              <div className="hp-field">
                <label className="it-input-label" style={{ fontWeight: "bold" }}>Message Content</label>
                <textarea
                  className="it-input"
                  rows={4}
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  placeholder="Enter details to display on guest dashboards..."
                  style={{ resize: "none" }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="it-btn it-btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
              >
                {isSubmitting ? "Broadcasting..." : "Broadcast Real-time"}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "assignments" && (
        <div className="it-card hp-flex-col" style={{ gap: "20px" }}>
          <div>
            <h3 className="it-section-title">Crew Voyage Assignment Console</h3>
            <p className="it-section-desc">Select a scheduled voyage and allocate department staff members to it.</p>
          </div>

          <div className="hp-field" style={{ maxWidth: "400px" }}>
            <label className="it-input-label" style={{ fontWeight: "bold" }}>Select Voyage Destination</label>
            <select
              className="it-input"
              value={selectedVoyageId}
              onChange={(e) => setSelectedVoyageId(e.target.value)}
            >
              <option value="">-- Choose Voyage --</option>
              {voyages.map((v) => (
                <option key={v.voyage_id} value={v.voyage_id}>
                  {v.destination} ({new Date(v.departure_date).toLocaleDateString()} - {v.status})
                </option>
              ))}
            </select>
          </div>

          {selectedVoyageId ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="hp-field">
                <label className="it-input-label" style={{ fontWeight: "bold" }}>Search Crew Members</label>
                <input
                  type="text"
                  className="it-input"
                  placeholder="Search by name, role or username..."
                  value={searchCrewQuery}
                  onChange={(e) => setSearchCrewQuery(e.target.value)}
                  style={{ maxWidth: "400px" }}
                />
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", background: "#ffffff" }}>
                <table className="it-table" style={{ width: "100%", fontSize: "13px", margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Crew Member Name</th>
                      <th>Role</th>
                      <th>Username</th>
                      <th style={{ textAlign: "center" }}>Assignment Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCrew.map((c) => (
                      <tr key={c.account_id}>
                        <td style={{ fontWeight: "bold" }}>{c.display_name}</td>
                        <td>
                          <span className="hp-tag-sharp hp-tag-pending" style={{ background: "#f1f5f9", color: "#475569", fontWeight: "600" }}>
                            {c.role_name}
                          </span>
                        </td>
                        <td>@{c.username}</td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={c.is_assigned}
                            onChange={(e) => {
                              const next = crewAssignments.map((item) =>
                                item.account_id === c.account_id ? { ...item, is_assigned: e.target.checked } : item
                              );
                              setCrewAssignments(next);
                            }}
                            style={{ width: "20px", height: "20px", cursor: "pointer" }}
                          />
                        </td>
                      </tr>
                    ))}
                    {filteredCrew.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "#94a3b8", padding: "24px" }}>
                          No crew members found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  onClick={async () => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setIsSubmitting(true);
                    try {
                      const assignedIds = crewAssignments
                        .filter((c) => c.is_assigned)
                        .map((c) => c.account_id);
                      await invoke("voyage_set_crew_assignments", {
                        voyageId: selectedVoyageId,
                        accountIds: assignedIds,
                      });
                      setSuccessMsg("Crew assignments successfully updated!");
                    } catch (err) {
                      setErrorMsg("Failed to update crew assignments: " + String(err));
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                  className="it-btn it-btn-primary"
                  style={{ padding: "10px 20px" }}
                >
                  {isSubmitting ? "Saving Assignments..." : "Save Crew Assignments"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "48px" }}>
              Please select a voyage destination to view and assign crew members.
            </div>
          )}
        </div>
      )}

      </div>

      {showCreateModal && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card hp-premium-modal-card" style={{ maxWidth: "550px", width: "90%" }}>
            <div className="hp-premium-modal-header">
              <div className="hp-premium-modal-icon-container success-blue">
                <i className="fa-solid fa-calendar-plus" />
              </div>
              <h3 className="hp-premium-modal-title">Schedule Voyage</h3>
            </div>

            <form onSubmit={handleCreateVoyage}>
              <div className="it-modal-body hp-premium-modal-body-text" style={{ padding: "20px" }}>
                <div className="hp-field hp-margin-bottom-16">
                  <label className="it-input-label" style={{ fontWeight: "bold" }}>Destination Port</label>
                  <input
                    type="text"
                    className="it-input"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Singapore Harbor"
                    required
                  />
                </div>

                <div className="hp-field hp-margin-bottom-16">
                  <label className="it-input-label" style={{ fontWeight: "bold" }}>Departure Date & Time</label>
                  <input
                    type="datetime-local"
                    className="it-input"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    required
                  />
                </div>

                <div className="hr-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
                  <div className="hp-field">
                    <label className="it-input-label" style={{ fontWeight: "bold" }}>Turnaround (hrs)</label>
                    <input
                      type="number"
                      className="it-input"
                      value={turnaroundBuffer}
                      onChange={(e) => setTurnaroundBuffer(parseInt(e.target.value) || 0)}
                      min={0}
                      required
                    />
                  </div>

                  <div className="hp-field">
                    <label className="it-input-label" style={{ fontWeight: "bold" }}>Dwell Time (hrs)</label>
                    <input
                      type="number"
                      className="it-input"
                      value={portDwellTime}
                      onChange={(e) => setPortDwellTime(parseInt(e.target.value) || 0)}
                      min={0}
                      required
                    />
                  </div>

                  <div className="hp-field">
                    <label className="it-input-label" style={{ fontWeight: "bold" }}>Margin (hrs)</label>
                    <input
                      type="number"
                      className="it-input"
                      value={contingencyMargin}
                      onChange={(e) => setContingencyMargin(parseInt(e.target.value) || 0)}
                      min={0}
                      required
                    />
                  </div>
                </div>

                <div className="hp-field">
                  <label className="it-input-label" style={{ fontWeight: "bold" }}>Assign Vessel</label>
                  <select
                    className="it-input"
                    value={shipId}
                    onChange={(e) => setShipId(e.target.value)}
                  >
                    <option value="">No Vessel Allocated (Unassigned)</option>
                    {ships.map((s) => (
                      <option key={s.ship_id} value={s.ship_id}>
                        {s.ship_name} (Capacity: {s.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="it-modal-footer" style={{ padding: "20px", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="it-btn hp-premium-modal-btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="it-btn hp-premium-modal-btn-confirm"
                >
                  {isSubmitting ? "Scheduling..." : "Schedule Voyage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingVoyage && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card hp-premium-modal-card" style={{ maxWidth: "550px", width: "90%" }}>
            <div className="hp-premium-modal-header">
              <div className="hp-premium-modal-icon-container success-blue">
                <i className="fa-solid fa-pen" />
              </div>
              <h3 className="hp-premium-modal-title">Edit Voyage Schedule</h3>
            </div>

            <form onSubmit={handleUpdateVoyage}>
              <div className="it-modal-body hp-premium-modal-body-text" style={{ padding: "20px" }}>
                <div className="hp-field hp-margin-bottom-16">
                  <label className="it-input-label" style={{ fontWeight: "bold" }}>Destination Port</label>
                  <input
                    type="text"
                    className="it-input"
                    value={editDestination}
                    onChange={(e) => setEditDestination(e.target.value)}
                    required
                  />
                </div>

                <div className="hp-field hp-margin-bottom-16">
                  <label className="it-input-label" style={{ fontWeight: "bold" }}>Departure Date & Time</label>
                  <input
                    type="datetime-local"
                    className="it-input"
                    value={editDepartureDate}
                    onChange={(e) => setEditDepartureDate(e.target.value)}
                    required
                  />
                </div>

                <div className="hr-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
                  <div className="hp-field">
                    <label className="it-input-label" style={{ fontWeight: "bold" }}>Turnaround (hrs)</label>
                    <input
                      type="number"
                      className="it-input"
                      value={editTurnaroundBuffer}
                      onChange={(e) => setEditTurnaroundBuffer(parseInt(e.target.value) || 0)}
                      min={0}
                      required
                    />
                  </div>

                  <div className="hp-field">
                    <label className="it-input-label" style={{ fontWeight: "bold" }}>Dwell Time (hrs)</label>
                    <input
                      type="number"
                      className="it-input"
                      value={editPortDwellTime}
                      onChange={(e) => setEditPortDwellTime(parseInt(e.target.value) || 0)}
                      min={0}
                      required
                    />
                  </div>

                  <div className="hp-field">
                    <label className="it-input-label" style={{ fontWeight: "bold" }}>Margin (hrs)</label>
                    <input
                      type="number"
                      className="it-input"
                      value={editContingencyMargin}
                      onChange={(e) => setEditContingencyMargin(parseInt(e.target.value) || 0)}
                      min={0}
                      required
                    />
                  </div>
                </div>

                <div className="hp-field">
                  <label className="it-input-label" style={{ fontWeight: "bold" }}>Voyage Status</label>
                  <select
                    className="it-input"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Active">Active</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="it-modal-footer" style={{ padding: "20px", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setEditingVoyage(null)}
                  className="it-btn hp-premium-modal-btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="it-btn hp-premium-modal-btn-confirm"
                >
                  {isSubmitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assigningVoyage && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card hp-premium-modal-card" style={{ maxWidth: "450px", width: "90%" }}>
            <div className="hp-premium-modal-header">
              <div className="hp-premium-modal-icon-container success-blue">
                <i className="fa-solid fa-ship" />
              </div>
              <h3 className="hp-premium-modal-title">Assign Vessel</h3>
            </div>

            <form onSubmit={handleAssignShipSubmit}>
              <div className="it-modal-body hp-premium-modal-body-text" style={{ padding: "20px" }}>
                <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#64748b" }}>
                  Select vessel allocated for the voyage to <strong>{assigningVoyage.destination}</strong>.
                </p>

                <div className="hp-field">
                  <label className="it-input-label" style={{ fontWeight: "bold" }}>Allocated Vessel</label>
                  <select
                    className="it-input"
                    value={assignShipId}
                    onChange={(e) => setAssignShipId(e.target.value)}
                  >
                    <option value="">No Vessel Allocated (Unassigned)</option>
                    {ships.map((s) => (
                      <option key={s.ship_id} value={s.ship_id}>
                        {s.ship_name} (Capacity: {s.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="it-modal-footer" style={{ padding: "20px", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setAssigningVoyage(null)}
                  className="it-btn hp-premium-modal-btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="it-btn hp-premium-modal-btn-confirm"
                >
                  {isSubmitting ? "Allocating..." : "Allocate Vessel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCrewModal && assigningCrewVoyage && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card hp-premium-modal-card" style={{ maxWidth: "500px", width: "90%" }}>
            <div className="hp-premium-modal-header">
              <div className="hp-premium-modal-icon-container success-blue" style={{ background: "#e0e7ff" }}>
                <i className="fa-solid fa-users" style={{ color: "#4f46e5" }} />
              </div>
              <h3 className="hp-premium-modal-title">Assign Crew Members</h3>
            </div>

            <form onSubmit={handleSaveCrewAssignments}>
              <div className="it-modal-body hp-premium-modal-body-text" style={{ padding: "20px" }}>
                <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>
                  Select crew members to assign to the voyage to <strong>{assigningCrewVoyage.destination}</strong>.
                </p>

                <input
                  type="text"
                  className="it-input"
                  placeholder="Search by name or role..."
                  value={searchCrewQuery}
                  onChange={(e) => setSearchCrewQuery(e.target.value)}
                  style={{ marginBottom: "12px", width: "100%" }}
                />

                <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "4px" }}>
                  {filteredCrew.map((c) => (
                    <div key={c.account_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      <div>
                        <span style={{ fontWeight: "bold", fontSize: "13px", display: "block", color: "#1e293b" }}>{c.display_name}</span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>{c.role_name} (@{c.username})</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={c.is_assigned}
                        onChange={(e) => {
                          const next = crewAssignments.map((item) =>
                            item.account_id === c.account_id ? { ...item, is_assigned: e.target.checked } : item
                          );
                          setCrewAssignments(next);
                        }}
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                    </div>
                  ))}
                  {filteredCrew.length === 0 && (
                    <div style={{ textAlign: "center", color: "#94a3b8", padding: "16px", fontSize: "13px" }}>No crew members found</div>
                  )}
                </div>
              </div>

              <div className="it-modal-footer" style={{ padding: "20px", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCrewModal(false);
                    setAssigningCrewVoyage(null);
                  }}
                  className="it-btn hp-premium-modal-btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="it-btn hp-premium-modal-btn-confirm"
                  style={{ backgroundColor: "#4f46e5", borderColor: "#4f46e5" }}
                >
                  {isSubmitting ? "Saving..." : "Save Assignments"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Dashboard>
  );
}
