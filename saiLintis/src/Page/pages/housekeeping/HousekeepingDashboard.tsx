import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import { LoadingScreen } from "../../components/LoadingScreen";
import "../../../HousekeepingDashboard.css";

interface LinenItem {
  linen_id: string;
  item_name: string;
  stock_count: number;
  threshold: number;
  status: string;
}

interface ShortageReport {
  report_id: string;
  linen_id: string;
  item_name: string;
  description: string;
  severity: string;
  category: string;
  photo_data: string | null;
  reported_by: string | null;
  reported_by_name: string | null;
  reported_at: string;
  status: string;
}

export function HousekeepingDashboard() {
  const navigate = useNavigate();
  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isHousekeepingSupervisor = loggedInUser.role_name === "Housekeeping Supervisor";

  const [activeItem, setActiveItem] = useState("Linen Inventory");
  const [activeSection, setActiveSection] = useState("Overview");

  const [activeTab, setActiveTab] = useState<"inventory" | "shortages" | "shifts">("inventory");
  const [staffList, setStaffList] = useState<string[]>([]);
  const [myShifts, setMyShifts] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [shiftHours, setShiftHours] = useState("08:00 - 16:00");
  const [assignedPosition, setAssignedPosition] = useState("");
  const [linens, setLinens] = useState<LinenItem[]>([]);
  const [shortages, setShortages] = useState<ShortageReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShortageModal, setShowShortageModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState<string | null>(null);

  const [selectedLinen, setSelectedLinen] = useState<LinenItem | null>(null);

  const [itemName, setItemName] = useState("");
  const [stockCount, setStockCount] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(0);

  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"Low" | "Medium" | "High">("Medium");
  const [category, setCategory] = useState<"Provisions" | "Maintenance">("Provisions");
  const [photoData, setPhotoData] = useState<string | null>(null);

  useEffect(() => {
    if (!isHousekeepingSupervisor) {
      const timer = setTimeout(() => {
        navigate("/home");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isHousekeepingSupervisor, navigate]);

  useEffect(() => {
    if (isHousekeepingSupervisor) {
      loadData();
    }
  }, [isHousekeepingSupervisor, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      if (activeTab === "inventory") {
        const list = await invoke<LinenItem[]>("list_linens");
        setLinens(list);
      } else if (activeTab === "shortages") {
        const list = await invoke<ShortageReport[]>("list_shortage_reports");
        setShortages(list);
      } else if (activeTab === "shifts") {
        const list = await invoke<any[]>("hk_get_staff_schedules");
        const filtered = list.filter(s => s.requested_by === "Housekeeping Supervisor");
        setMyShifts(filtered);

        try {
          const staff = await invoke<string[]>("hk_get_employees");
          if (staff && staff.length > 0) {
            setStaffList(staff);
            if (!selectedStaff && staff[0]) {
              setSelectedStaff(staff[0]);
            }
          } else {
            const fallback = ["John Doe", "Alice Clean", "David Sweep"];
            setStaffList(fallback);
            if (!selectedStaff) {
              setSelectedStaff(fallback[0]);
            }
          }
        } catch (e) {
          const fallback = ["John Doe", "Alice Clean", "David Sweep"];
          setStaffList(fallback);
          if (!selectedStaff) {
            setSelectedStaff(fallback[0]);
          }
        }
      }
    } catch (err) {
      setErrorMsg("Failed to load housekeeping data: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShiftRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedStaff || !shiftDate || !assignedPosition.trim()) {
      setErrorMsg("All fields are required");
      return;
    }

    setLoading(true);
    try {
      const res = await invoke<string>("hk_create_staff_schedule", {
        payload: {
          employee_name: selectedStaff,
          role_name: "Housekeeping Staff",
          shift_date: shiftDate,
          shift_hours: shiftHours,
          position: assignedPosition.trim(),
          requested_by: "Housekeeping Supervisor",
        }
      });
      setSuccessMsg(res);
      setAssignedPosition("");
      loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setItemName("");
    setStockCount(0);
    setThreshold(0);
    setErrorMsg("");
    setSuccessMsg("");
    setShowAddModal(true);
  };

  const handleCreateLinen = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!itemName.trim()) {
      setErrorMsg("Item name is required");
      return;
    }

    setLoading(true);
    try {
      await invoke("create_linen", {
        payload: {
          item_name: itemName,
          stock_count: Number(stockCount),
          threshold: Number(threshold),
          user_id: loggedInUser.user_id,
        },
      });
      setSuccessMsg("Linen item created successfully!");
      setShowAddModal(false);
      loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (item: LinenItem) => {
    setSelectedLinen(item);
    setItemName(item.item_name);
    setStockCount(item.stock_count);
    setThreshold(item.threshold);
    setErrorMsg("");
    setSuccessMsg("");
    setShowEditModal(true);
  };

  const handleUpdateLinen = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedLinen) return;
    if (!itemName.trim()) {
      setErrorMsg("Item name is required");
      return;
    }

    setLoading(true);
    try {
      await invoke("update_linen", {
        payload: {
          linen_id: selectedLinen.linen_id,
          item_name: itemName,
          stock_count: Number(stockCount),
          threshold: Number(threshold),
          user_id: loggedInUser.user_id,
        },
      });
      setSuccessMsg("Linen item updated successfully!");
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLinen = async (linenId: string) => {
    if (!window.confirm("Are you sure you want to delete this linen item?")) return;
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("delete_linen", {
        payload: {
          linen_id: linenId,
          user_id: loggedInUser.user_id,
        },
      });
      setSuccessMsg("Linen item deleted successfully!");
      loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShortageModal = (item: LinenItem) => {
    setSelectedLinen(item);
    setDescription("");
    setSeverity("Medium");
    setCategory("Provisions");
    setPhotoData(null);
    setErrorMsg("");
    setSuccessMsg("");
    setShowShortageModal(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoData(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoData(reader.result as string);
    };
    reader.onerror = () => {
      setErrorMsg("Photo upload failed - please retry");
      setPhotoData(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitShortageReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedLinen) return;

    if (!description.trim()) {
      setErrorMsg("All required fields must be completed before submitting.");
      return;
    }

    if (!photoData) {
      setErrorMsg("Photo upload failed - please retry");
      return;
    }

    setLoading(true);
    try {
      const reportId = await invoke<string>("submit_shortage_report", {
        payload: {
          linen_id: selectedLinen.linen_id,
          description,
          severity,
          category,
          photo_data: photoData,
          user_id: loggedInUser.user_id,
        },
      });

      const targetRoles = category === "Provisions"
        ? ["Restaurant Manager", "Operations Manager"]
        : ["Chief Engineer", "Safety Officer", "Engineer"];

      const isMaint = category === "Maintenance";
      const notifTitle = isMaint ? "Housekeeping Maintenance Report" : `Linen Shortage Alert - ${category}`;
      const notifBody = isMaint
        ? `• Item: ${selectedLinen.item_name}\n• Severity: ${severity}\n• Reporter: ${loggedInUser.display_name} (Housekeeping)\n• Detail: ${description}`
        : `Linen Item '${selectedLinen.item_name}' has reported a stock shortage. Severity: ${severity}. Description: ${description}`;
      const notifIcon = isMaint ? "fa-solid fa-file-shield" : "fa-solid fa-triangle-exclamation";

      targetRoles.forEach(role => {
        const notifKey = `employee_notifications_${role}`;
        const existing = JSON.parse(localStorage.getItem(notifKey) || "[]");
        const newNotif = {
          id: `shortage-${reportId}-${Date.now()}`,
          title: notifTitle,
          body: notifBody,
          time: new Date().toISOString(),
          icon: notifIcon
        };
        localStorage.setItem(notifKey, JSON.stringify([newNotif, ...existing]));
      });

      setSuccessMsg("Shortage report submitted successfully!");
      setShowShortageModal(false);
      loadData();
    } catch (err) {
      setErrorMsg("Submission failed - please retry");
    } finally {
      setLoading(false);
    }
  };

  if (!isHousekeepingSupervisor) {
    return (
      <div className="hk-access-denied">
        <h2>Access Denied</h2>
        <p>You do not have permission to view the Housekeeping Supervisor Dashboard. Redirecting to home...</p>
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
      <LoadingScreen visible={loading} />

      <div className="hk-container">
        <div className="hk-header-row">
          <div>
            <h1 className="hk-title">Linen & Shortage Management</h1>
            <p className="hk-subtitle">Welcome back, {loggedInUser.display_name} (Housekeeping Supervisor)</p>
          </div>
          {activeTab === "inventory" && (
            <button className="hk-btn-add" onClick={handleOpenAddModal}>
              <i className="fa-solid fa-plus hk-mr-8" /> Add Linen Item
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="hk-alert error">
            <i className="fa-solid fa-triangle-exclamation hk-mr-10" />
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="hk-alert success">
            <i className="fa-solid fa-circle-check hk-mr-10" />
            {successMsg}
          </div>
        )}

        <div className="hk-tabs">
          <button
            className={`hk-tab ${activeTab === "inventory" ? "active" : ""}`}
            onClick={() => { setActiveTab("inventory"); setErrorMsg(""); setSuccessMsg(""); }}
          >
            <i className="fa-solid fa-box-open hk-mr-8" /> Linen Inventory
          </button>
          <button
            className={`hk-tab ${activeTab === "shortages" ? "active" : ""}`}
            onClick={() => { setActiveTab("shortages"); setErrorMsg(""); setSuccessMsg(""); }}
          >
            <i className="fa-solid fa-triangle-exclamation hk-mr-8" /> Stock Shortage Alerts
          </button>
          <button
            className={`hk-tab ${activeTab === "shifts" ? "active" : ""}`}
            onClick={() => { setActiveTab("shifts"); setErrorMsg(""); setSuccessMsg(""); }}
          >
            <i className="fa-solid fa-calendar-days hk-mr-8" /> Staff Shift Scheduling
          </button>
        </div>

        {activeTab === "inventory" && (
          <div className="hk-card">
            <table className="hk-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Stock</th>
                  <th>Threshold</th>
                  <th>Status</th>
                  <th className="hk-text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {linens.map((item) => (
                  <tr key={item.linen_id}>
                    <td className="hk-font-bold">{item.item_name}</td>
                    <td>{item.stock_count}</td>
                    <td>{item.threshold}</td>
                    <td>
                      <span className={`hk-status-badge ${item.status === "Shortage" ? "shortage" : "normal"}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="hk-text-right">
                      <button className="hk-action-btn report" onClick={() => handleOpenShortageModal(item)}>
                        <i className="fa-solid fa-triangle-exclamation hk-mr-6" /> Report Shortage
                      </button>
                      <button className="hk-action-btn edit" onClick={() => handleOpenEditModal(item)}>
                        <i className="fa-solid fa-pencil" /> Edit
                      </button>
                      <button className="hk-action-btn delete" onClick={() => handleDeleteLinen(item.linen_id)}>
                        <i className="fa-solid fa-trash" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {linens.length === 0 && (
                  <tr>
                    <td colSpan={5} className="hk-empty-cell">
                      No linen items found in inventory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "shortages" && (
          <div className="hk-card">
            <table className="hk-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Department</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Photo</th>
                  <th>Reported By</th>
                  <th>Reported At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shortages.map((report) => (
                  <tr key={report.report_id}>
                    <td className="hk-font-bold">{report.item_name}</td>
                    <td>{report.category}</td>
                    <td>
                      <span className={`hk-severity-badge ${report.severity.toLowerCase()}`}>
                        {report.severity}
                      </span>
                    </td>
                    <td className="hk-desc-cell" title={report.description}>
                      {report.description}
                    </td>
                    <td>
                      {report.photo_data ? (
                        <button onClick={() => setShowPhotoModal(report.photo_data)} className="hk-photo-btn">
                          <img src={report.photo_data} alt="Shortage attachment" className="hk-photo-thumb hk-photo-thumb-hover" />
                        </button>
                      ) : (
                        <span className="hk-text-muted">None</span>
                      )}
                    </td>
                    <td>{report.reported_by_name || "Unknown"}</td>
                    <td>{new Date(report.reported_at).toLocaleString()}</td>
                    <td>
                      <span className="hk-status-badge shortage">
                        {report.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {shortages.length === 0 && (
                  <tr>
                    <td colSpan={8} className="hk-empty-cell">
                      No stock shortage reports submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "shifts" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", marginTop: "20px" }}>
            <div className="hk-card" style={{ padding: "20px" }}>
              <h2 className="hk-font-bold" style={{ fontSize: "18px", marginBottom: "15px", color: "var(--ink)" }}>Assign Staff Shift</h2>
              <form onSubmit={handleCreateShiftRequest} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div>
                  <label className="hk-form-label">Employee Name</label>
                  <select className="hk-form-input" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} required>
                    {staffList.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="hk-form-label">Department Role</label>
                  <input type="text" className="hk-form-input hk-disabled-opacity" value="Housekeeping Staff" disabled />
                </div>
                <div>
                  <label className="hk-form-label">Shift Date</label>
                  <input type="date" className="hk-form-input" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} required />
                </div>
                <div>
                  <label className="hk-form-label">Working Hours</label>
                  <select className="hk-form-input" value={shiftHours} onChange={(e) => setShiftHours(e.target.value)}>
                    <option value="08:00 - 16:00">08:00 - 16:00</option>
                    <option value="12:00 - 20:00">12:00 - 20:00</option>
                    <option value="16:00 - 24:00">16:00 - 24:00</option>
                    <option value="20:00 - 04:00">20:00 - 04:00</option>
                  </select>
                </div>
                <div>
                  <label className="hk-form-label">Assigned Position / Duty</label>
                  <input type="text" className="hk-form-input" value={assignedPosition} onChange={(e) => setAssignedPosition(e.target.value)} placeholder="e.g. Cabin Cleaner Deck 3" required />
                </div>
                <button type="submit" className="hk-btn-add" style={{ marginTop: "10px", width: "100%" }}>
                  <i className="fa-solid fa-paper-plane hk-mr-8" /> Request Shift Approval
                </button>
              </form>
            </div>

            <div className="hk-card" style={{ padding: "20px" }}>
              <h2 className="hk-font-bold" style={{ fontSize: "18px", marginBottom: "15px", color: "var(--ink)" }}>My Shift Requests Queue</h2>
              <table className="hk-table">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Requested At</th>
                  </tr>
                </thead>
                <tbody>
                  {myShifts.map((sch) => (
                    <tr key={sch.id}>
                      <td className="hk-font-bold">{sch.employee_name}</td>
                      <td>{sch.shift_date}</td>
                      <td>{sch.shift_hours}</td>
                      <td>{sch.position}</td>
                      <td>
                        <span className={`hk-status-badge ${sch.status === "Approved" ? "normal" : sch.status === "Rejected" ? "shortage" : ""}`} style={{
                          backgroundColor: sch.status === "Pending" ? "#fef3c7" : undefined,
                          color: sch.status === "Pending" ? "#d97706" : undefined,
                          border: sch.status === "Pending" ? "1px solid #fcd34d" : undefined
                        }}>
                          {sch.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--gray-light)" }}>
                        {new Date(sch.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  ))}
                  {myShifts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="hk-empty-cell">No shift requests submitted yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="hk-modal-overlay">
            <div className="hk-modal-card">
              <div className="hk-modal-header hk-flex-between">
                <span>Add Linen Item</span>
                <button type="button" onClick={() => setShowAddModal(false)} className="hk-modal-close-btn">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <form onSubmit={handleCreateLinen}>
                <div className="hk-modal-body">
                  <div>
                    <label className="hk-form-label">Item Name</label>
                    <input type="text" className="hk-form-input" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="hk-form-label">Stock Count</label>
                    <input type="number" className="hk-form-input" value={stockCount} onChange={(e) => setStockCount(Number(e.target.value))} min={0} required />
                  </div>
                  <div>
                    <label className="hk-form-label">Threshold Count</label>
                    <input type="number" className="hk-form-input" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} min={0} required />
                  </div>
                </div>
                <div className="hk-modal-footer">
                  <button type="button" className="hk-action-btn edit" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hk-btn-add">
                    Create Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="hk-modal-overlay">
            <div className="hk-modal-card">
              <div className="hk-modal-header hk-flex-between">
                <span>Edit Linen Item</span>
                <button type="button" onClick={() => setShowEditModal(false)} className="hk-modal-close-btn">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <form onSubmit={handleUpdateLinen}>
                <div className="hk-modal-body">
                  <div>
                    <label className="hk-form-label">Item Name</label>
                    <input type="text" className="hk-form-input" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="hk-form-label">Stock Count</label>
                    <input type="number" className="hk-form-input" value={stockCount} onChange={(e) => setStockCount(Number(e.target.value))} min={0} required />
                  </div>
                  <div>
                    <label className="hk-form-label">Threshold Count</label>
                    <input type="number" className="hk-form-input" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} min={0} required />
                  </div>
                </div>
                <div className="hk-modal-footer">
                  <button type="button" className="hk-action-btn edit" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hk-btn-add">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showShortageModal && (
          <div className="hk-modal-overlay">
            <div className="hk-modal-card">
              <div className="hk-modal-header hk-flex-between">
                <span>Report Linen Stock Shortage</span>
                <button type="button" onClick={() => setShowShortageModal(false)} className="hk-modal-close-btn">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <form onSubmit={handleSubmitShortageReport}>
                <div className="hk-modal-body">
                  <div>
                    <label className="hk-form-label">Linen Item</label>
                    <input type="text" className="hk-form-input hk-disabled-opacity" value={selectedLinen?.item_name || ""} disabled />
                  </div>
                  <div>
                    <label className="hk-form-label">Category / Route to Department</label>
                    <select className="hk-form-input" value={category} onChange={(e) => setCategory(e.target.value as any)}>
                      <option value="Provisions">Provisions</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className="hk-form-label">Severity Level</label>
                    <select className="hk-form-input" value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="hk-form-label">Description</label>
                    <textarea className="hk-form-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Please detail the specific shortages and locations..." />
                  </div>
                  <div>
                    <label className="hk-form-label">Photo Attachment</label>
                    <input type="file" className="hk-form-input" accept="image/*" onChange={handlePhotoChange} />
                    {photoData && <img src={photoData} className="hk-photo-preview" alt="Preview attachment" />}
                  </div>
                </div>
                <div className="hk-modal-footer">
                  <button type="button" className="hk-action-btn edit" onClick={() => setShowShortageModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hk-btn-add">
                    Submit Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPhotoModal && (
          <div className="hk-modal-overlay" onClick={() => setShowPhotoModal(null)}>
            <div className="hk-modal-card hk-photo-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="hk-modal-header hk-flex-between">
                <span>Shortage Photo Attachment</span>
                <button onClick={() => setShowPhotoModal(null)} className="hk-modal-close-btn">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <div className="hk-photo-modal-body">
                <img src={showPhotoModal} alt="Enlarged attachment" className="hk-photo-modal-img" />
              </div>
            </div>
          </div>
        )}
      </div>
    </Dashboard>
  );
}
