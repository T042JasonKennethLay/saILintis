import { useState, useEffect } from "react";
import "../../Home.css";
import "../../Passenger.css";
import { Dashboard } from "../components/Dashboard";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

import { SpendingTracker } from "./passenger/SpendingTracker";
import { TravelBooking } from "./passenger/TravelBooking";
import { RestaurantReservation } from "./passenger/RestaurantReservation";
import { PerformanceBooking } from "./passenger/PerformanceBooking";
import { CabinInfo } from "./passenger/CabinInfo";
import { NotificationsList } from "./passenger/NotificationsList";
import { Activities } from "./passenger/Activities";
import { PassengerChat } from "./passenger/PassengerChat";

export function HomePage() {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [activeSection, setActiveSection] = useState("Overview");

  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");
  const passengerId = loggedInUser.user_id;

  const [passengerProfileDetails, setPassengerProfileDetails] = useState<any>(null);
  const [onboardSpendSummary, setOnboardSpendSummary] = useState<any>({ total_spent: "0", budget_limit: "1000", remaining_budget: "1000" });
  const [spendingHistoryList, setSpendingHistoryList] = useState<any[]>([]);
  const [itineraryDetails, setItineraryDetails] = useState<any>(null);
  const hasBooking = Array.isArray(itineraryDetails?.bookings) && itineraryDetails.bookings.length > 0;
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [personalNotifications, setPersonalNotifications] = useState<any[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<string[]>([]);
  const [showEventConfirmModal, setShowEventConfirmModal] = useState<any>(null);
  const [allPendingReservations, setAllPendingReservations] = useState<{
    tables: { passengerId: string; passengerName: string; tableId: number; restaurantName: string }[];
    seats: { passengerId: string; passengerName: string; seatId: string; entertainmentId: string }[];
  }>({ tables: [], seats: [] });

  const [operationError, setOperationError] = useState("");
  const [operationSuccess, setOperationSuccess] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string } | null>(null);

  const [dailyScheduledEvents, setDailyScheduledEvents] = useState<any[]>([]);
  const [activeZoneAlerts, setActiveZoneAlerts] = useState<any[]>([]);
  const [zonesList, setZonesList] = useState<any[]>([]);
  const [employeeNotifications, setEmployeeNotifications] = useState<any[]>([]);
  const [engineeringWorkOrders, setEngineeringWorkOrders] = useState<any[]>([]);

  const [performancesList, setPerformancesList] = useState<any[]>([]);
  const [performanceReportsList, setPerformanceReportsList] = useState<any[]>([]);
  const [showReportSubmitModal, setShowReportSubmitModal] = useState<any>(null);
  const [showReportDetailsModal, setShowReportDetailsModal] = useState<any>(null);

  const [reportOccupancy, setReportOccupancy] = useState<number>(0);
  const [reportRating, setReportRating] = useState<number>(5);
  const [reportAudienceNotes, setReportAudienceNotes] = useState<string>("");
  const [reportIssues, setReportIssues] = useState<{ type: string; time: string; status: string }[]>([]);
  const [reportIssueType, setReportIssueType] = useState<string>("Audio");
  const [reportIssueTime, setReportIssueTime] = useState<string>("");
  const [reportIssueStatus, setReportIssueStatus] = useState<string>("Resolved");
  const [confirmOverCapacity, setConfirmOverCapacity] = useState<boolean>(false);

  const [selectedPassengerProfileModalId, setSelectedPassengerProfileModalId] = useState<string | null>(null);
  const [passengerProfileModalData, setPassengerProfileModalData] = useState<any>(null);
  const [loadingPassengerProfileModal, setLoadingPassengerProfileModal] = useState<boolean>(false);

  const [staffList, setStaffList] = useState<string[]>([]);
  const [myShifts, setMyShifts] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [shiftHours, setShiftHours] = useState("08:00 - 16:00");
  const [assignedPosition, setAssignedPosition] = useState("");

  useEffect(() => {
    if (passengerId) {
      if (loggedInUser.role_name === "Passenger") {
        fetchPassengerData();
        fetchSpendingData();
        fetchItineraryData();
        fetchAnnouncementsData();
        fetchScheduledActivities();
        loadNotifications();
        loadJoinedEvents();
      } else {
        fetchAnnouncementsData();
        if (
          loggedInUser.role_name === "Entertainment Staff" ||
          loggedInUser.role_name === "Entertainment Manager" ||
          loggedInUser.role_name === "Restaurant Manager"
        ) {
          loadEmployeePendingReservations();
        }
        if (
          loggedInUser.role_name === "Entertainment Staff" ||
          loggedInUser.role_name === "Entertainment Manager"
        ) {
          fetchEntertainmentData();
        }
        if (
          loggedInUser.role_name === "Engineer" ||
          loggedInUser.role_name === "Chief Engineer"
        ) {
          fetchEngineeringWorkOrders();
        }
      }
    }
  }, [passengerId, activeItem]);

  useEffect(() => {
    if (loggedInUser.role_name === "Safety Officer") {
      fetchActiveZoneAlerts();
      const interval = setInterval(fetchActiveZoneAlerts, 5000);
      return () => clearInterval(interval);
    }
  }, [loggedInUser.role_name]);

  useEffect(() => {
    if (loggedInUser.role_name && loggedInUser.role_name !== "Passenger") {
      loadEmployeeNotifications();
      if (
        loggedInUser.role_name === "Entertainment Staff" ||
        loggedInUser.role_name === "Entertainment Manager" ||
        loggedInUser.role_name === "Restaurant Manager"
      ) {
        loadEmployeePendingReservations();
      }
      if (
        loggedInUser.role_name === "Entertainment Staff" ||
        loggedInUser.role_name === "Entertainment Manager"
      ) {
        fetchEntertainmentData();
      }
      if (
        loggedInUser.role_name === "Engineer" ||
        loggedInUser.role_name === "Chief Engineer"
      ) {
        fetchEngineeringWorkOrders();
      }
    }
  }, [loggedInUser.role_name]);

  useEffect(() => {
    if (activeItem === "Staff Schedules" && loggedInUser.role_name === "Entertainment Manager") {
      loadEntertainmentShifts();
    }
  }, [activeItem]);

  useEffect(() => {
    if (!selectedPassengerProfileModalId) {
      setPassengerProfileModalData(null);
      return;
    }
    const loadProfile = async () => {
      setLoadingPassengerProfileModal(true);
      try {
        const details = await invoke("get_passenger", { passengerId: selectedPassengerProfileModalId });
        setPassengerProfileModalData(details);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPassengerProfileModal(false);
      }
    };
    loadProfile();
  }, [selectedPassengerProfileModalId]);

  const loadEmployeePendingReservations = async () => {
    try {
      const res = await invoke<any>("get_all_pending_reservations");
      const tables = res.tables.map((t: any) => ({
        passengerId: t.passenger_id,
        passengerName: t.passenger_name,
        tableId: parseInt(t.table_id),
        restaurantName: t.restaurant_name
      }));
      const seats = res.seats.map((s: any) => ({
        passengerId: s.passenger_id,
        passengerName: s.passenger_name,
        seatId: s.seat_id,
        entertainmentId: s.entertainment_id
      }));
      setAllPendingReservations({ tables, seats });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEntertainmentData = async () => {
    try {
      const perfs = await invoke<any[]>("get_all_performances");
      setPerformancesList(perfs);
      const reports = await invoke<any[]>("get_performance_reports");
      setPerformanceReportsList(reports);
    } catch (e) {
      console.error(e);
    }
  };

  const loadEntertainmentShifts = async () => {
    setIsUpdating(true);
    setOperationError("");
    try {
      const list = await invoke<any[]>("ent_get_staff_schedules");
      const filtered = list.filter(s => s.requested_by === "Entertainment Manager");
      setMyShifts(filtered);

      try {
        const staff = await invoke<string[]>("ent_get_employees");
        if (staff && staff.length > 0) {
          setStaffList(staff);
          if (!selectedStaff && staff[0]) {
            setSelectedStaff(staff[0]);
          }
        } else {
          const fallback = ["Bob Miller", "Clara Singer", "Ethan Dancer"];
          setStaffList(fallback);
          if (!selectedStaff) {
            setSelectedStaff(fallback[0]);
          }
        }
      } catch (e) {
        const fallback = ["Bob Miller", "Clara Singer", "Ethan Dancer"];
        setStaffList(fallback);
        if (!selectedStaff) {
          setSelectedStaff(fallback[0]);
        }
      }
    } catch (err) {
      setOperationError("Failed to load shift schedules: " + String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateEntertainmentShiftRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationError("");
    setOperationSuccess("");

    if (!selectedStaff || !shiftDate || !assignedPosition.trim()) {
      setOperationError("All fields are required");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await invoke<string>("ent_create_staff_schedule", {
        payload: {
          employee_name: selectedStaff,
          role_name: "Entertainment Staff",
          shift_date: shiftDate,
          shift_hours: shiftHours,
          position: assignedPosition.trim(),
          requested_by: "Entertainment Manager",
        }
      });
      setOperationSuccess(res);
      setAssignedPosition("");
      loadEntertainmentShifts();
    } catch (err) {
      setOperationError(String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitPerformanceReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReportSubmitModal) return;

    if (reportOccupancy > showReportSubmitModal.total_capacity && !confirmOverCapacity) {
      setConfirmOverCapacity(true);
      return;
    }

    try {
      const payload = {
        performance_id: showReportSubmitModal.performance_id,
        occupancy_count: reportOccupancy,
        technical_issues: JSON.stringify(reportIssues),
        audience_rating: reportRating,
        audience_notes: reportAudienceNotes,
        submitted_by: loggedInUser.user_id,
        has_unresolved_issues: reportIssues.some(issue => issue.status === "Unresolved")
      };

      const msg = await invoke<string>("submit_performance_report", { payload });
      setShowReportSubmitModal(null);
      setReportOccupancy(0);
      setReportRating(5);
      setReportAudienceNotes("");
      setReportIssues([]);
      setConfirmOverCapacity(false);
      fetchEntertainmentData();
      setCustomAlert({ title: "Report Submitted", message: msg });
    } catch (err) {
      setOperationError(String(err));
    }
  };

  const handleAddReportIssue = () => {
    if (!reportIssueTime.trim()) {
      alert("Please enter the time of occurrence");
      return;
    }
    setReportIssues([...reportIssues, { type: reportIssueType, time: reportIssueTime, status: reportIssueStatus }]);
    setReportIssueTime("");
  };

  const handleRemoveReportIssue = (idx: number) => {
    setReportIssues(reportIssues.filter((_, i) => i !== idx));
  };

  const loadEmployeeNotifications = async () => {
    const key = `employee_notifications_${loggedInUser.role_name}`;
    const localNotifs = JSON.parse(localStorage.getItem(key) || "[]");
    if (loggedInUser.role_name === "Engineer" || loggedInUser.role_name === "Chief Engineer") {
      try {
        const dbNotifs = await invoke<any[]>("get_notifications", {
          recipientRole: loggedInUser.role_name,
        });
        const mappedDb = dbNotifs.map((n) => {
          let timeVal = n.sent_at;
          if (timeVal && timeVal.includes(" ")) {
            timeVal = timeVal.replace(" ", "T");
          }
          return {
            id: n.alert_id,
            title: "Engineering Notification",
            body: n.message,
            time: timeVal,
          };
        });
        const merged = [...mappedDb, ...localNotifs];
        const unique = Array.from(new Map(merged.map((x) => [x.id, x])).values());
        setEmployeeNotifications(unique);
      } catch (err) {
        setEmployeeNotifications(localNotifs.reverse());
      }
    } else {
      setEmployeeNotifications(localNotifs.reverse());
    }
  };

  const fetchEngineeringWorkOrders = async () => {
    try {
      const list = await invoke<any[]>("eng_get_work_orders");
      setEngineeringWorkOrders(list);
    } catch (error) {
      console.error(error);
    }
  };

  const handleClearEmployeeNotifications = () => {
    const key = `employee_notifications_${loggedInUser.role_name}`;
    localStorage.removeItem(key);
    setEmployeeNotifications([]);
  };

  const fetchPassengerData = async () => {
    try {
      const details = await invoke("get_passenger", { passengerId });
      setPassengerProfileDetails(details);
    } catch (error) {
      setOperationError("Failed to load passenger profile: " + String(error));
    }
  };

  const fetchSpendingData = async () => {
    try {
      const summary = await invoke("view_daily_onboard_spending_and_budget", { passengerId });
      setOnboardSpendSummary(summary);
      const history = await invoke("list_spending_entries", { passengerId });
      setSpendingHistoryList(history as any[]);
    } catch (error) {
      setOperationError("Failed to load spending data: " + String(error));
    }
  };

  const fetchItineraryData = async () => {
    try {
      const itinerary = await invoke("view_booking_reservation_and_itinerary", { passengerId });
      setItineraryDetails(itinerary);
    } catch (error) {
      setOperationError("Failed to load itinerary data: " + String(error));
    }
  };

  const fetchAnnouncementsData = async () => {
    try {
      const announcements = await invoke("view_ship_announcement");
      setAnnouncementsList(announcements as any[]);
    } catch (error) {
      setOperationError("Failed to load announcements: " + String(error));
    }
  };

  const fetchScheduledActivities = async () => {
    try {
      const dbActivities = await invoke<any[]>("get_all_activities");
      const mapped = dbActivities.map(a => ({
        id: a.activity_id,
        title: a.title,
        time: a.schedule_time,
        location: a.location,
        price: parseFloat(a.price) || 0,
        icon: a.icon,
        description: a.description,
        category: a.category
      }));
      setDailyScheduledEvents(mapped);
    } catch (error) {
      setOperationError("Failed to load activities: " + String(error));
    }
  };

  const loadNotifications = () => {
    if (!passengerId) return;
    const notifs = JSON.parse(localStorage.getItem(`passenger_notifications_${passengerId}`) || "[]");
    setPersonalNotifications(notifs);
  };

  const fetchActiveZoneAlerts = async () => {
    try {
      const list = await invoke<any[]>("list_zone_alerts");
      const active = list.filter(a => a.status === "Active");
      setActiveZoneAlerts(active);
      const zones = await invoke<any[]>("list_zones");
      setZonesList(zones);
    } catch (error) {
      console.error(error);
    }
  };

  const loadJoinedEvents = () => {
    if (!passengerId) return;
    const events = JSON.parse(localStorage.getItem(`passenger_joined_events_${passengerId}`) || "[]");
    setJoinedEvents(events);
  };

  const handleClearNotifications = () => {
    if (!passengerId) return;
    localStorage.removeItem(`passenger_notifications_${passengerId}`);
    setPersonalNotifications([]);
  };

  const handleJoinScheduledEvent = (event: any) => {
    setShowEventConfirmModal(event);
  };

  const executeJoinScheduledEvent = async (event: any) => {
    if (!passengerId) return;
    setIsUpdating(true);
    try {
      if (event.price > 0) {
        await invoke("add_spending_entry", {
          payload: {
            passenger_id: passengerId,
            description: `Event: ${event.title}`,
            amount: event.price.toFixed(2)
          }
        });
      }

      const storageKey = `passenger_joined_events_${passengerId}`;
      const existingEvents = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const updatedEvents = [...existingEvents, event.id];
      localStorage.setItem(storageKey, JSON.stringify(updatedEvents));
      setJoinedEvents(updatedEvents);

      const notifKey = `passenger_notifications_${passengerId}`;
      const existingNotifs = JSON.parse(localStorage.getItem(notifKey) || "[]");
      const newNotif = {
        id: `event-${event.id}-${Date.now()}`,
        title: "Joined Scheduled Event",
        body: `You registered for ${event.title}. Time: ${event.time}. Venue: ${event.location}.`,
        time: new Date().toISOString(),
        icon: "fa-calendar-check"
      };
      localStorage.setItem(notifKey, JSON.stringify([newNotif, ...existingNotifs]));
      loadNotifications();

      setOperationSuccess(`Successfully registered for event: ${event.title}!`);
      await fetchSpendingData();
    } catch (error) {
      setOperationError("Failed to register for event: " + String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApproveTableForPassenger = async (pId: string, tableId: number, restaurantName: string) => {
    try {
      await invoke("approve_dining_table", {
        restaurantName,
        tableNumber: String(tableId)
      });
    } catch (err) {
      console.error(err);
    }

    const storageKey = `passenger_table_bookings_${pId}`;
    const diningStore = JSON.parse(localStorage.getItem(storageKey) || "{}");
    diningStore[tableId] = { status: "approved" };
    localStorage.setItem(storageKey, JSON.stringify(diningStore));

    const notifKey = `passenger_notifications_${pId}`;
    const existing = JSON.parse(localStorage.getItem(notifKey) || "[]");
    const newNotif = {
      id: `dining-approve-${tableId}-${Date.now()}`,
      title: "Table Booking Approved",
      body: `Your booking request for Table T-${tableId} has been approved by the Restaurant Manager.`,
      time: new Date().toISOString(),
      icon: "fa-circle-check"
    };
    localStorage.setItem(notifKey, JSON.stringify([newNotif, ...existing]));

    loadEmployeePendingReservations();
    setCustomAlert({
      title: "Table Booking Approved",
      message: `Table T-${tableId} reservation has been successfully approved!`
    });
  };

  const handleApproveSeatForPassenger = async (pId: string, seatId: string, entertainmentId: string) => {
    try {
      await invoke("approve_seat_booking", {
        performanceTitle: entertainmentId,
        seatNumber: seatId,
      });
    } catch (err) {
      console.error(err);
    }

    const storageKey = `passenger_performance_bookings_${pId}`;
    const perfStore = JSON.parse(localStorage.getItem(storageKey) || "{}");
    perfStore[seatId] = { status: "approved", entertainmentId };
    localStorage.setItem(storageKey, JSON.stringify(perfStore));

    const notifKey = `passenger_notifications_${pId}`;
    const existing = JSON.parse(localStorage.getItem(notifKey) || "[]");
    const newNotif = {
      id: `seat-approve-${seatId}-${Date.now()}`,
      title: "Seat Reservation Approved",
      body: `Your seat ${seatId} for ${entertainmentId} has been approved by the Entertainment Staff.`,
      time: new Date().toISOString(),
      icon: "fa-circle-check"
    };
    localStorage.setItem(notifKey, JSON.stringify([newNotif, ...existing]));

    loadEmployeePendingReservations();
    setCustomAlert({
      title: "Seat Reservation Approved",
      message: `Seat ${seatId} reservation for ${entertainmentId} has been successfully approved!`
    });
  };

  return (
    <Dashboard
      activeItem={activeItem}
      activeSection={activeSection}
      setActiveItem={setActiveItem}
      setActiveSection={setActiveSection}
    >
      {operationError && <div className="it-error-message">{operationError}</div>}
      {operationSuccess && <div className="it-success-message">{operationSuccess}</div>}

      {activeItem === "Dashboard" && loggedInUser.role_name === "Passenger" && (
        <div className="ps-dashboard-container">
          <div className="ps-title-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 className="hp-title-giant">Passenger Portal</h1>
              <p className="hp-subtitle-clean" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                Welcome back, {passengerProfileDetails?.display_name || loggedInUser.display_name}.
                {passengerProfileDetails?.status?.toLowerCase() === "vip" && (
                  <span className="ps-vip-badge ml-12">VIP Suite Status</span>
                )}
              </p>
            </div>
            
            {hasBooking && (
              <div className="ps-health-status-card" style={{
                background: "white",
                border: "1.5px solid #e2e8f0",
                borderRadius: "12px",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
              }}>
                <div style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: passengerProfileDetails?.status === "Emergency" ? "#ef4444" : 
                              (passengerProfileDetails?.status === "Disembarked" ? "#6b7280" : "#10b981"),
                  boxShadow: passengerProfileDetails?.status === "Emergency" ? "0 0 8px #ef4444" : "none"
                }} />
                <div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Voyage Status</div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>
                    {passengerProfileDetails?.status || "Normal"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {!hasBooking ? (
            <div className="it-card hp-flex-col" style={{ alignItems: "center", justifyContent: "center", padding: "48px", textAlign: "center", marginTop: "24px", minHeight: "350px", border: "1px dashed #cbd5e1", background: "rgba(255, 255, 255, 0.6)" }}>
              <div style={{ background: "#eff6ff", borderRadius: "50%", padding: "24px", marginBottom: "20px" }}>
                <i className="fa-solid fa-lock" style={{ color: "#2563eb", fontSize: "48px" }} />
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", margin: "0 0 12px 0" }}>Onboard Services Locked</h2>
              <p style={{ maxWidth: "550px", color: "#64748b", fontSize: "15px", lineHeight: "1.6", margin: "0 auto 24px auto", textAlign: "center" }}>
                Welcome to SaiLintis! To unlock access to restaurant dining table reservations, live performance seat bookings, passenger activities, cabin requests, and shipboard direct live support chats, you must join an active cruise voyage.
              </p>
              <button 
                onClick={() => {
                  setActiveItem("Travel Booking");
                  setActiveSection("Bookings");
                }}
                className="it-btn it-btn-primary"
                style={{ padding: "12px 28px", fontSize: "14px", borderRadius: "10px", fontWeight: "700" }}
              >
                <i className="fa-solid fa-compass" style={{ marginRight: "8px" }} /> Browse & Join Voyage
              </button>
            </div>
          ) : (
            <div className="ps-dashboard-grid">
              <div className="ps-dashboard-left-col">
                <SpendingTracker
                  passengerId={passengerId}
                  onboardSpendSummary={onboardSpendSummary}
                  spendingHistoryList={spendingHistoryList}
                  fetchSpendingData={fetchSpendingData}
                  isUpdating={isUpdating}
                  setIsUpdating={setIsUpdating}
                  setOperationError={setOperationError}
                  setOperationSuccess={setOperationSuccess}
                />

                <div className="ps-dashboard-widget ps-widget-spaced">
                  <div className="ps-widget-header">
                    <h3 className="ps-widget-title">
                      <i className="fa fa-calendar-days" /> Scheduled Cruise Events
                    </h3>
                    <span className="ps-widget-subtitle">Mini-activities happening onboard today</span>
                  </div>
                  <div className="ps-events-widget-list">
                    {dailyScheduledEvents.map((event) => {
                      const isJoined = joinedEvents.includes(event.id);
                      return (
                        <div key={event.id} className="ps-event-widget-card">
                          <div className="ps-event-icon-box">
                            <i className={`fa ${event.icon}`} />
                          </div>
                          <div className="ps-event-details">
                            <span className="ps-event-name">{event.title}</span>
                            <span className="ps-event-time-loc">
                              <i className="fa fa-clock" /> {event.time} | <i className="fa fa-map-marker-alt" /> {event.location}
                            </span>
                          </div>
                          <div className="ps-event-action-box">
                            <span className={`ps-event-price-tag ${event.price === 0 ? "free" : "paid"}`}>
                              {event.price === 0 ? "FREE" : `Rp ${event.price.toLocaleString("id-ID")}`}
                            </span>
                            <button
                              onClick={() => handleJoinScheduledEvent(event)}
                              disabled={isJoined || isUpdating}
                              className={`ps-event-join-btn ${isJoined ? "joined" : ""}`}
                            >
                              {isJoined ? (
                                <>
                                  <i className="fa fa-check" /> Registered
                                </>
                              ) : (
                                "Join Event"
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="ps-dashboard-right-col">
                <div className="ps-dashboard-widget">
                  <div className="ps-widget-header ps-dashboard-split-row">
                    <h3 className="ps-widget-title">
                      <i className="fa fa-bell" /> Personal Notifications
                    </h3>
                    {personalNotifications.length > 0 && (
                      <button onClick={handleClearNotifications} className="ps-clear-all-btn">
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="ps-notifications-widget-list">
                    {personalNotifications.map((notif) => (
                      <div key={notif.id} className="ps-notif-widget-card">
                        <div className="ps-notif-bullet">
                          <i className={`fa ${notif.icon || "fa-info-circle"}`} />
                        </div>
                        <div className="ps-notif-info">
                          <span className="ps-notif-title-text">{notif.title}</span>
                          <p className="ps-notif-body-text">{notif.body}</p>
                          <span className="ps-notif-time-text">{new Date(notif.time).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                    {personalNotifications.length === 0 && (
                      <div className="ps-widget-empty-state">
                        <i className="fa fa-envelope-open" />
                        <p>No new notifications or alerts</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ps-dashboard-widget ps-widget-spaced">
                  <div className="ps-widget-header">
                    <h3 className="ps-widget-title">
                      <i className="fa fa-bullhorn" /> Ship Announcements
                    </h3>
                  </div>
                  <div className="ps-announcements-widget-list">
                    {announcementsList.map((announcement) => (
                      <div key={announcement.id} className="ps-announcement-widget-card">
                        <span className="ps-announcement-title">{announcement.title}</span>
                        <p className="ps-announcement-body">{announcement.content}</p>
                        <span className="ps-announcement-date">
                          {new Date(announcement.date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    {announcementsList.length === 0 && (
                      <p className="ps-text-muted-small">No announcements broadcasted yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeItem === "Dashboard" && loggedInUser.role_name !== "Passenger" && (
        <div className="ps-dashboard-container">
          <div className="ps-title-section">
            <h1 className="hp-title-giant">Employee Control System</h1>
            <p className="hp-subtitle-clean">
              Welcome back, {loggedInUser.display_name} ({loggedInUser.role_name} · {loggedInUser.department}).
            </p>
          </div>

          <div className="ps-dashboard-grid">
            <div className="ps-dashboard-left-col">
              <div className="ps-dashboard-widget">
                <div className="ps-widget-header">
                  <h3 className="ps-widget-title">
                    <i className="fa-solid fa-briefcase" /> Workspace Duties
                  </h3>
                  <span className="ps-widget-subtitle">Tasks assigned to your security role clearance</span>
                </div>

                <div className="ps-events-widget-list hp-margin-top-20">
                  {loggedInUser.role_name === "IT Admin" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">System Management Console</h4>
                        <p className="hp-text-muted-14">
                          As an IT Administrator, you have complete control over roles, employee registration, audit trail logs, and daily backups.
                        </p>
                        <div className="hp-form-buttons-row">
                          <button onClick={() => { setActiveItem("Register Account"); setActiveSection("IT Administration"); }} className="hp-btn-primary-sharp">
                            Register User
                          </button>
                          <button onClick={() => { setActiveItem("User Management"); setActiveSection("IT Administration"); }} className="hp-btn-primary-sharp hp-btn-secondary-sharp">
                            Manage Users
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                   {(loggedInUser.role_name === "Security Officer" || loggedInUser.role_name === "Safety Officer") && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">Security & Safety Duty Desk</h4>
                        <p className="hp-text-muted-14">
                          Dispatch localized alerts, view deck activity density, log safety incidents, and flag blacklist recommendations directly to the Captain.
                        </p>
                        <div className="hp-security-desk-actions">
                          {loggedInUser.role_name === "Safety Officer" && (
                            <>
                              <button onClick={() => navigate("/security-report")} className="hp-btn-primary-sharp">
                                Submit Security Incident Report
                              </button>
                              {activeZoneAlerts.length > 0 ? (
                                <div className="hp-safety-alerts-box">
                                  <h5 className="hp-safety-alerts-title">
                                    <i className="fa-solid fa-triangle-exclamation" /> Active Security Dispatch Alerts
                                  </h5>
                                  <div className="hp-safety-alerts-list">
                                    {activeZoneAlerts.map(alert => (
                                      <div key={alert.alert_id} className="hp-safety-alert-item">
                                        <div className="hp-safety-alert-header">
                                          <span className="hp-safety-alert-zone">
                                            {zonesList.find(z => z.zone_id === alert.zone_id)?.zone_name || alert.zone_id}
                                          </span>
                                          <span className="hp-safety-alert-time">
                                            {new Date(alert.sent_at).toLocaleTimeString()}
                                          </span>
                                        </div>
                                        <div className="hp-safety-alert-message">{alert.message}</div>
                                        <div className="hp-safety-alert-sender">Dispatched by: {alert.sent_by_name}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="hp-safety-no-alerts">
                                  <i className="fa-solid fa-circle-check" /> No active security dispatch alerts.
                                </div>
                              )}
                            </>
                          )}
                          {loggedInUser.role_name === "Security Officer" && (
                            <>
                              <button onClick={() => navigate("/zone-alerts")} className="hp-btn-primary-sharp">
                                Zone Security Alerts
                              </button>
                              <button onClick={() => navigate("/review-incidents")} className="hp-btn-primary-sharp hp-btn-secondary-sharp">
                                Review Incident Reports
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {loggedInUser.role_name === "Medical Officer" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">Medical Officer Desk</h4>
                        <p className="hp-text-muted-14">
                          Log shipboard medical incidents, treatments, and clearance updates to ensure passengers' health and safety standards are documented.
                        </p>
                        <div className="hp-form-buttons-row">
                          <button onClick={() => navigate("/medical-report")} className="hp-btn-primary-sharp">
                            Log Medical Incident
                          </button>
                          <button onClick={() => navigate("/medical-clearance")} className="hp-btn-primary-sharp hp-btn-secondary-sharp">
                            Voyage Clearance
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {loggedInUser.role_name === "Finance Manager" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">Finance Manager Desk</h4>
                        <p className="hp-text-muted-14">
                          Review crew ranks, contract durations, calculate payroll variables, manage active monthly cycle processing, and resolve passenger refund requests.
                        </p>
                        <div className="hp-form-buttons-row" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                          <button onClick={() => navigate("/payroll")} className="hp-btn-primary-sharp">
                            Open Payroll Module
                          </button>
                          <button onClick={() => navigate("/refunds")} className="hp-btn-primary-sharp hp-btn-secondary-sharp">
                            Open Refund Console
                          </button>
                          <button onClick={() => navigate("/restocks")} className="hp-btn-primary-sharp" style={{ background: "#475569" }}>
                            Open Restock Approvals
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {loggedInUser.role_name === "Supplier" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">Supplier Dispatch Desk</h4>
                        <p className="hp-text-muted-14">
                          Review incoming food inventory restock orders, confirm shipping details, and dispatch supplies to the ship's galley.
                        </p>
                        <div className="hp-form-buttons-row" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                          <button onClick={() => navigate("/supplier-dashboard")} className="hp-btn-primary-sharp">
                            Open Supplier Console
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {loggedInUser.role_name === "Operations Manager" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">Operations Manager Console</h4>
                        <p className="hp-text-muted-14">
                          Monitor passenger check-in statuses, review staff shift schedules, escalate operational issues, and dispatch final call announcements.
                        </p>
                        <div className="hp-form-buttons-row" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                          <button onClick={() => navigate("/opm-dashboard")} className="hp-btn-primary-sharp">
                            Open Operations Console
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {loggedInUser.role_name === "Ship Captain" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">Captain Review Desk</h4>
                        <p className="hp-text-muted-14">
                          Review medical and security incidents logged by officers. Confirm warnings, clear medical flags, or escalate critical incidents.
                        </p>
                        <button onClick={() => navigate("/review-incidents")} className="hp-btn-primary-sharp">
                          Review Incidents Queue
                        </button>
                      </div>
                    </div>
                  )}

                  {(loggedInUser.role_name === "Cruise Operations Director" || loggedInUser.role_name === "Cruise Director") && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">Cruise Operations Dashboard Console</h4>
                        <p className="hp-text-muted-14">
                          Schedule voyages, allocate vessels, view occupancy rates, assign crew members, and broadcast real-time announcements.
                        </p>
                        <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                          <button onClick={() => navigate("/voyages")} className="hp-btn-primary-sharp">
                            Open Voyage Management
                          </button>
                          {loggedInUser.role_name === "Cruise Operations Director" && (
                            <button onClick={() => navigate("/review-incidents")} className="hp-btn-primary-sharp" style={{ background: "#475569" }}>
                              Review Incident Reports
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {loggedInUser.role_name === "HR Manager" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">HR Recruitment & Screening Desk</h4>
                        <p className="hp-text-muted-14">
                          Publish new job vacancy listings, manage application intakes, review candidate CVs, shortlist and assign accepted applicants to active voyages.
                        </p>
                        <button onClick={() => navigate("/hr-dashboard")} className="hp-btn-primary-sharp">
                          Open Recruitment Console
                        </button>
                      </div>
                    </div>
                  )}

                  {loggedInUser.role_name === "Housekeeping Supervisor" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">Housekeeping Linen Management Console</h4>
                        <p className="hp-text-muted-14">
                          Manage linen inventory stocks, track thresholds, and report linen shortages directly to Provisions or Maintenance.
                        </p>
                        <button onClick={() => navigate("/housekeeping-dashboard")} className="hp-btn-primary-sharp">
                          Open Housekeeping Console
                        </button>
                      </div>
                    </div>
                  )}

                  {(loggedInUser.role_name === "Entertainment Staff" || loggedInUser.role_name === "Entertainment Manager") && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">Entertainment Seat Booking Approvals</h4>
                        <p className="hp-text-muted-14">
                          Review and approve pending seat reservation requests submitted by passengers.
                        </p>
                        <div className="ps-events-widget-list hp-margin-top-12">
                          {allPendingReservations.seats.map((s) => (
                            <div key={`seat-${s.passengerId}-${s.seatId}`} className="ps-event-widget-card ps-event-pending-alert hp-margin-bottom-8">
                              <div className="ps-event-icon-box ps-event-pending-icon">
                                <i className="fa fa-chair" />
                              </div>
                              <div className="ps-event-details">
                                <span className="ps-event-name">Seat {s.seatId} ({s.entertainmentId})</span>
                                <span className="ps-event-time-loc">
                                  Passenger:{" "}
                                  <span
                                    onClick={() => setSelectedPassengerProfileModalId(s.passengerId)}
                                    className="hp-pointer"
                                    style={{ textDecoration: "underline", color: "var(--blue)" }}
                                  >
                                    {s.passengerName}
                                  </span>
                                </span>
                              </div>
                              <button
                                onClick={() => handleApproveSeatForPassenger(s.passengerId, s.seatId, s.entertainmentId)}
                                className="ps-event-join-btn ps-btn-approve"
                              >
                                Approve
                              </button>
                            </div>
                          ))}
                          {allPendingReservations.seats.length === 0 && (
                            <p className="hp-text-muted-14">No pending seat reservations.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {loggedInUser.role_name === "Restaurant Manager" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div>
                        <h4 className="hp-font-16-bold">Restaurant Table Booking Approvals</h4>
                        <p className="hp-text-muted-14">
                          Review and approve pending dining table reservation requests submitted by passengers.
                        </p>
                        <div className="ps-events-widget-list hp-margin-top-12">
                          {allPendingReservations.tables.map((t) => (
                            <div key={`table-${t.passengerId}-${t.tableId}`} className="ps-event-widget-card ps-event-pending-alert hp-margin-bottom-8">
                              <div className="ps-event-icon-box ps-event-pending-icon">
                                  <i className="fa fa-utensils" />
                              </div>
                              <div className="ps-event-details">
                                <span className="ps-event-name">Table T-{t.tableId}</span>
                                <span className="ps-event-time-loc">
                                  Passenger:{" "}
                                  <span
                                    onClick={() => setSelectedPassengerProfileModalId(t.passengerId)}
                                    className="hp-pointer"
                                    style={{ textDecoration: "underline", color: "var(--blue)" }}
                                  >
                                    {t.passengerName}
                                  </span>
                                </span>
                              </div>
                              <button
                                onClick={() => handleApproveTableForPassenger(t.passengerId, t.tableId, t.restaurantName)}
                                className="ps-event-join-btn ps-btn-approve"
                              >
                                Approve
                              </button>
                            </div>
                          ))}
                          {allPendingReservations.tables.length === 0 && (
                            <p className="hp-text-muted-14">No pending table reservations.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {loggedInUser.role_name === "Chief Engineer" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div className="hp-eng-duties-container">
                        <h4 className="hp-font-16-bold">Chief Engineer Workspace Desk</h4>
                        <p className="hp-text-muted-14">
                          Monitor all equipment malfunctions, review stats, and assign pending/unassigned work orders to available engineers.
                        </p>
                        <div className="hp-margin-top-12">
                          <h5 className="hp-font-14-bold hp-eng-duties-title">Unassigned Malfunction Reports</h5>
                          <div className="hp-eng-list-wrapper">
                            {engineeringWorkOrders.filter((wo) => !wo.assigned_to && wo.status !== "Completed" && wo.status !== "Closed").map((wo) => (
                              <div key={wo.work_order_id} className="hp-eng-duty-card">
                                <div className="hp-eng-card-info">
                                  <span className="hp-eng-card-title">{wo.title}</span>
                                  <span className="hp-eng-card-meta">{wo.equipment} · {wo.location} · Priority: {wo.priority}</span>
                                </div>
                                <button onClick={() => navigate("/engineering")} className="hp-btn-primary-sharp hp-eng-card-btn">
                                  Assign
                                </button>
                              </div>
                            ))}
                            {engineeringWorkOrders.filter((wo) => !wo.assigned_to && wo.status !== "Completed" && wo.status !== "Closed").length === 0 && (
                              <p className="hp-text-muted-14">No unassigned malfunction reports.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {loggedInUser.role_name === "Engineer" && (
                    <div className="ps-event-widget-card hp-padding-20">
                      <div className="hp-eng-duties-container">
                        <h4 className="hp-font-16-bold">Engineer Workspace Desk</h4>
                        <p className="hp-text-muted-14">
                          View and complete your assigned work orders. Ensure maintenance logs are submitted for compliance.
                        </p>
                        <div className="hp-margin-top-12">
                          <h5 className="hp-font-14-bold hp-eng-duties-title">My Active Assigned Work Orders</h5>
                          <div className="hp-eng-list-wrapper">
                            {engineeringWorkOrders.filter((wo) => wo.assigned_to === loggedInUser.account_id && wo.status !== "Completed" && wo.status !== "Closed").map((wo) => (
                              <div key={wo.work_order_id} className="hp-eng-duty-card">
                                <div className="hp-eng-card-info">
                                  <span className="hp-eng-card-title">{wo.title}</span>
                                  <span className="hp-eng-card-meta">{wo.equipment} · {wo.location} · Status: {wo.status}</span>
                                </div>
                                <button onClick={() => navigate("/engineering")} className="hp-btn-primary-sharp hp-eng-card-btn">
                                  Open
                                </button>
                              </div>
                            ))}
                            {engineeringWorkOrders.filter((wo) => wo.assigned_to === loggedInUser.account_id && wo.status !== "Completed" && wo.status !== "Closed").length === 0 && (
                              <p className="hp-text-muted-14">No active work orders assigned to you.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="ps-dashboard-right-col">
              <div className="ps-dashboard-widget hp-margin-bottom-20">
                <div className="ps-widget-header hp-flex-space-between">
                  <div>
                    <h3 className="ps-widget-title">
                      <i className="fa-solid fa-bell" /> Duty Alerts
                    </h3>
                    <span className="ps-widget-subtitle">Escalated emergency alerts</span>
                  </div>
                  {employeeNotifications.length > 0 && (
                    <button
                      onClick={handleClearEmployeeNotifications}
                      className="rir-dest-btn hp-font-12"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="ps-announcements-widget-list hp-margin-top-16">
                  {employeeNotifications.map((notif: any) => (
                    <div key={notif.id} className="hp-employee-notif-card">
                      <div className="hp-employee-notif-header">
                        <span className="hp-employee-notif-title">{notif.title}</span>
                        <span className="hp-employee-notif-time">
                          {new Date(notif.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="hp-employee-notif-body">{notif.body}</p>
                    </div>
                  ))}
                  {employeeNotifications.length === 0 && (
                    <div className="hp-employee-no-alerts">
                      <i className="fa-solid fa-envelope-open" /> No active duty alerts.
                    </div>
                  )}
                </div>
              </div>

              <div className="ps-dashboard-widget">
                <div className="ps-widget-header">
                  <h3 className="ps-widget-title">
                    <i className="fa-solid fa-bullhorn" /> Ship Announcements
                  </h3>
                </div>
                <div className="ps-announcements-widget-list hp-margin-top-16">
                  {announcementsList.map((announcement) => (
                    <div key={announcement.id} className="ps-announcement-widget-card">
                      <span className="ps-announcement-title">{announcement.title}</span>
                      <p className="ps-announcement-body">{announcement.content}</p>
                      <span className="ps-announcement-date">
                        {new Date(announcement.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {announcementsList.length === 0 && (
                    <p className="hp-text-empty-announcement">No announcements broadcasted yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeItem === "Travel Booking" && (
        <TravelBooking 
          itineraryDetails={itineraryDetails} 
          passengerProfileDetails={passengerProfileDetails}
        />
      )}

      {(activeItem === "Restaurant Reservation" || activeItem === "Dining") && (
        <RestaurantReservation
          passengerId={passengerId}
          passengerProfileDetails={passengerProfileDetails}
          isUpdating={isUpdating}
          setIsUpdating={setIsUpdating}
          setOperationError={setOperationError}
          setOperationSuccess={setOperationSuccess}
          onNotificationAdded={() => {
            loadNotifications();
          }}
        />
      )}

      {(activeItem === "Performance Booking" || activeItem === "Performances") && (
        <PerformanceBooking
          passengerId={passengerId}
          passengerProfileDetails={passengerProfileDetails}
          isUpdating={isUpdating}
          setIsUpdating={setIsUpdating}
          setOperationError={setOperationError}
          setOperationSuccess={setOperationSuccess}
          onNotificationAdded={() => {
            loadNotifications();
          }}
        />
      )}

      {activeItem === "Activities" && (
        <Activities
          passengerId={passengerId}
          isUpdating={isUpdating}
          setIsUpdating={setIsUpdating}
          setOperationError={setOperationError}
          setOperationSuccess={setOperationSuccess}
          fetchSpendingData={fetchSpendingData}
          onNotificationAdded={() => {
            loadNotifications();
          }}
        />
      )}

      {activeItem === "Cabin Info" && (
        <CabinInfo
          passengerId={passengerId}
          passengerProfileDetails={passengerProfileDetails}
          fetchSpendingData={fetchSpendingData}
          isUpdating={isUpdating}
          setIsUpdating={setIsUpdating}
          setOperationError={setOperationError}
          setOperationSuccess={setOperationSuccess}
          onNotificationAdded={loadNotifications}
        />
      )}

      {activeItem === "Live Chat" && (
        <PassengerChat
          passengerId={passengerId}
          passengerProfileDetails={passengerProfileDetails}
        />
      )}

      {activeItem === "Notifications" && (
        <NotificationsList announcementsList={announcementsList} />
      )}

      {activeItem === "Staff Schedules" && (
        <div className="it-container">
          <div className="ps-title-section">
            <h1 className="hp-title-giant">Staff Shift Scheduling</h1>
            <p className="hp-subtitle-clean">Assign duties, select shift timings, and request daily schedules for Entertainment Staff.</p>
          </div>

          {operationError && (
            <div className="hk-alert error" style={{ marginTop: "15px" }}>
              <i className="fa-solid fa-triangle-exclamation hk-mr-10" />
              {operationError}
            </div>
          )}
          {operationSuccess && (
            <div className="hk-alert success" style={{ marginTop: "15px" }}>
              <i className="fa-solid fa-circle-check hk-mr-10" />
              {operationSuccess}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", marginTop: "20px" }}>
            <div className="it-card" style={{ padding: "20px" }}>
              <h2 className="it-section-title" style={{ marginBottom: "15px" }}>Request Shift Assignment</h2>
              <form onSubmit={handleCreateEntertainmentShiftRequest} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div>
                  <label className="hp-form-label" style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Employee Name</label>
                  <select className="hk-form-input" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }} value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} required>
                    {staffList.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="hp-form-label" style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Department Role</label>
                  <input type="text" className="hk-form-input hk-disabled-opacity" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }} value="Entertainment Staff" disabled />
                </div>
                <div>
                  <label className="hp-form-label" style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Shift Date</label>
                  <input type="date" className="hp-form-input" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }} value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} required />
                </div>
                <div>
                  <label className="hp-form-label" style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Working Hours</label>
                  <select className="hk-form-input" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }} value={shiftHours} onChange={(e) => setShiftHours(e.target.value)}>
                    <option value="08:00 - 16:00">08:00 - 16:00</option>
                    <option value="12:00 - 20:00">12:00 - 20:00</option>
                    <option value="16:00 - 24:00">16:00 - 24:00</option>
                    <option value="20:00 - 04:00">20:00 - 04:00</option>
                  </select>
                </div>
                <div>
                  <label className="hp-form-label" style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Assigned Position / Duty</label>
                  <input type="text" className="hk-form-input" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }} value={assignedPosition} onChange={(e) => setAssignedPosition(e.target.value)} placeholder="e.g. Main Stage Sound" required />
                </div>
                <button type="submit" className="hp-btn-primary-sharp" style={{ width: "100%", padding: "10px", marginTop: "10px" }} disabled={isUpdating}>
                  {isUpdating ? "Submitting..." : "Submit Shift Request"}
                </button>
              </form>
            </div>

            <div className="it-card" style={{ padding: "20px" }}>
              <h2 className="it-section-title" style={{ marginBottom: "15px" }}>My Requested Staff Shifts</h2>
              <table className="hk-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
                    <th style={{ padding: "10px 5px" }}>Employee</th>
                    <th style={{ padding: "10px 5px" }}>Date</th>
                    <th style={{ padding: "10px 5px" }}>Hours</th>
                    <th style={{ padding: "10px 5px" }}>Position</th>
                    <th style={{ padding: "10px 5px" }}>Status</th>
                    <th style={{ padding: "10px 5px" }}>Requested At</th>
                  </tr>
                </thead>
                <tbody>
                  {myShifts.map((sch) => (
                    <tr key={sch.id} style={{ borderBottom: "1px solid #f9f9f9" }}>
                      <td style={{ padding: "10px 5px", fontWeight: "bold" }}>{sch.employee_name}</td>
                      <td style={{ padding: "10px 5px" }}>{sch.shift_date}</td>
                      <td style={{ padding: "10px 5px" }}>{sch.shift_hours}</td>
                      <td style={{ padding: "10px 5px" }}>{sch.position}</td>
                      <td style={{ padding: "10px 5px" }}>
                        <span className={`hk-status-badge ${sch.status === "Approved" ? "normal" : sch.status === "Rejected" ? "shortage" : ""}`} style={{
                          backgroundColor: sch.status === "Pending" ? "#fef3c7" : undefined,
                          color: sch.status === "Pending" ? "#d97706" : undefined,
                          border: sch.status === "Pending" ? "1px solid #fcd34d" : undefined
                        }}>
                          {sch.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 5px", fontSize: "12px", color: "#666" }}>
                        {new Date(sch.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  ))}
                  {myShifts.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: "20px 5px", textAlign: "center", color: "#999" }}>No shift requests submitted yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeItem === "Performance Reports" && (
        <div className="it-container">
          <div className="ps-title-section">
            <h1 className="hp-title-giant">Post-Show Performance Reports</h1>
            <p className="hp-subtitle-clean">
              {loggedInUser.role_name === "Entertainment Staff" 
                ? "Submit post-show verification reports including occupancy counts and technical issues log."
                : "Analyze submitted performance reports, examine technical issue logs, and review ratings."}
            </p>
          </div>
          
          <div className="hr-grid split" style={{ marginTop: "20px", display: "grid", gridTemplateColumns: loggedInUser.role_name === "Entertainment Staff" ? "1fr 1fr" : "1fr", gap: "20px" }}>
            {loggedInUser.role_name === "Entertainment Staff" && (
              <div className="it-card">
                <h2 className="it-section-title">Select Completed Performance</h2>
                <p className="it-section-desc">Create verification reports for recently concluded entertainment events.</p>
                <div className="ps-events-widget-list hp-margin-top-12">
                  {performancesList.filter(p => p.status !== "COMPLETED").map((p) => (
                    <div key={`perf-${p.performance_id}`} className="ps-event-widget-card ps-event-pending-alert hp-margin-bottom-8">
                      <div className="ps-event-icon-box ps-event-pending-icon">
                        <i className="fa fa-music" />
                      </div>
                      <div className="ps-event-details">
                        <span className="ps-event-name">{p.title}</span>
                        <span className="ps-event-time-loc">{p.schedule_date} · {p.schedule_time}</span>
                      </div>
                      <button
                        onClick={() => {
                          setShowReportSubmitModal(p);
                          setReportOccupancy(p.current_occupancy || 0);
                        }}
                        className="ps-event-join-btn ps-btn-approve"
                      >
                        Report
                      </button>
                    </div>
                  ))}
                  {performancesList.filter(p => p.status !== "COMPLETED").length === 0 && (
                    <p className="hp-text-muted-14">All performances reported.</p>
                  )}
                </div>
              </div>
            )}

            <div className="it-card">
              <h2 className="it-section-title">Submitted Reports Queue</h2>
              <p className="it-section-desc">Review rating metrics and priority alerts for unresolved issues.</p>
              <div className="ps-events-widget-list hp-margin-top-12">
                {performanceReportsList.map((r) => (
                  <div 
                    key={`report-${r.report_id}`} 
                    className={`ps-event-widget-card hp-margin-bottom-8 hp-pointer ${r.priority_review ? "ps-event-pending-alert" : ""}`}
                    onClick={() => setShowReportDetailsModal(r)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div className={`ps-event-icon-box ${r.priority_review ? "ps-event-pending-icon" : "ps-event-success-icon"}`}>
                        <i className={r.priority_review ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-check"} />
                      </div>
                      <div className="ps-event-details">
                        <span className="ps-event-name" style={{ fontWeight: "bold" }}>{r.performance_title}</span>
                        <span className="ps-event-time-loc">Submitted by: {r.submitted_by_name}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <span className={`it-status ${r.is_late ? "inactive" : r.priority_review ? "pending" : "active"}`} style={{ fontSize: "11px", padding: "2px 6px" }}>
                        {r.status}
                      </span>
                      <span style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>
                        {new Date(r.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
                {performanceReportsList.length === 0 && (
                  <p className="hp-text-muted-14">No performance reports submitted yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEventConfirmModal && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card ps-modal-confirm hp-premium-modal-card">
            <div className="hp-premium-modal-header">
              <div className="hp-premium-modal-icon-container success-blue">
                <i className="fa-solid fa-calendar-check" />
              </div>
              <h3 className="hp-premium-modal-title">
                Confirm Registration
              </h3>
            </div>
            <div className="it-modal-body hp-premium-modal-body-text">
              <p className="ps-modal-body-text" style={{ margin: 0 }}>
                Are you sure you want to register for show/activity: <strong>{showEventConfirmModal.title}</strong>?
              </p>
              {showEventConfirmModal.price > 0 && (
                <div className="hp-premium-modal-charge-alert">
                  <i className="fa fa-info-circle" />
                  <span>A charge of <strong>${showEventConfirmModal.price.toFixed(2)}</strong> will be added to your onboard account.</span>
                </div>
              )}
            </div>
            <div className="it-modal-footer" style={{ justifyContent: "center", gap: "12px", padding: 0 }}>
              <button
                type="button"
                className="it-btn hp-premium-modal-btn-cancel"
                onClick={() => setShowEventConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                className="it-btn ps-btn-modal-confirm hp-premium-modal-btn-confirm"
                onClick={() => {
                  const eventToJoin = showEventConfirmModal;
                  setShowEventConfirmModal(null);
                  executeJoinScheduledEvent(eventToJoin);
                }}
              >
                Confirm Register
              </button>
            </div>
          </div>
        </div>
      )}
      {customAlert && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card ps-modal-confirm hp-premium-modal-card">
            <div className="hp-premium-modal-header">
              <div className="hp-premium-modal-icon-container success-green">
                <i className="fa-solid fa-circle-check" />
              </div>
              <h3 className="hp-premium-modal-title">
                {customAlert.title}
              </h3>
            </div>
            <div className="it-modal-body hp-premium-modal-body-text">
              <p className="ps-modal-body-text" style={{ margin: 0 }}>{customAlert.message}</p>
            </div>
            <div className="it-modal-footer" style={{ justifyContent: "center", padding: 0 }}>
              <button
                type="button"
                className="it-btn ps-btn-modal-confirm hp-premium-modal-btn-done"
                onClick={() => setCustomAlert(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportSubmitModal && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card hp-premium-modal-card" style={{ maxWidth: "600px", width: "90%" }}>
            <div className="hp-premium-modal-header">
              <div className="hp-premium-modal-icon-container success-blue">
                <i className="fa-solid fa-file-contract" />
              </div>
              <h3 className="hp-premium-modal-title">
                Submit Post-Show Report
              </h3>
            </div>
            <form onSubmit={handleSubmitPerformanceReport} style={{ textAlign: "left" }}>
              <div className="it-modal-body hp-premium-modal-body-text" style={{ maxHeight: "70vh", overflowY: "auto", padding: "20px" }}>
                <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#888" }}>
                  Event: <strong>{showReportSubmitModal.title}</strong>
                </p>

                <div className="hp-field hp-margin-bottom-16">
                  <label className="it-input-label" style={{ fontWeight: "bold" }}>Actual Occupancy Count</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={reportOccupancy}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setReportOccupancy(val);
                      if (val <= showReportSubmitModal.total_capacity) {
                        setConfirmOverCapacity(false);
                      }
                    }}
                    className="it-input"
                    placeholder="e.g. 150"
                  />
                  {reportOccupancy > showReportSubmitModal.total_capacity && (
                    <div style={{ marginTop: "8px", color: "#dc2626", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
                      <span style={{ fontWeight: "bold" }}>⚠️ Warning: Occupancy exceeds total capacity of {showReportSubmitModal.total_capacity}!</span>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#475569", cursor: "pointer", opacity: 1, marginTop: "4px" }}>
                        <input
                          type="checkbox"
                          checked={confirmOverCapacity}
                          onChange={(e) => setConfirmOverCapacity(e.target.checked)}
                          style={{ width: "16px", height: "16px", margin: 0, padding: 0, cursor: "pointer", flexShrink: 0 }}
                          required
                        />
                        <span style={{ fontSize: "13px", fontWeight: "500", color: "#475569" }}>
                          I confirm and verify this occupancy count is correct
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <div style={{ border: "1px solid #333", borderRadius: "6px", padding: "12px", marginBottom: "16px" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "bold" }}>Log Technical Issues</h4>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px", alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <label className="it-input-label">Type</label>
                      <select value={reportIssueType} onChange={e => setReportIssueType(e.target.value)} className="it-select">
                        <option value="Audio">Audio</option>
                        <option value="Lighting">Lighting</option>
                        <option value="Stage">Stage</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="it-input-label">Time</label>
                      <input
                        type="text"
                        value={reportIssueTime}
                        onChange={e => setReportIssueTime(e.target.value)}
                        placeholder="e.g. 20:30"
                        className="it-input"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="it-input-label">Status</label>
                      <select value={reportIssueStatus} onChange={e => setReportIssueStatus(e.target.value)} className="it-select">
                        <option value="Resolved">Resolved</option>
                        <option value="Unresolved">Unresolved</option>
                      </select>
                    </div>
                    <button type="button" onClick={handleAddReportIssue} className="it-btn" style={{ padding: "8px 12px" }}>
                      Add
                    </button>
                  </div>

                  {reportIssues.length > 0 && (
                    <table className="it-table" style={{ fontSize: "12px", width: "100%" }}>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Time</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportIssues.map((issue, idx) => (
                          <tr key={`issue-${idx}`}>
                            <td>{issue.type}</td>
                            <td>{issue.time}</td>
                            <td>
                              <span className={`it-status ${issue.status === "Resolved" ? "active" : "pending"}`}>
                                {issue.status}
                              </span>
                            </td>
                            <td>
                              <button type="button" onClick={() => handleRemoveReportIssue(idx)} className="it-btn it-btn-danger" style={{ padding: "2px 6px", fontSize: "11px" }}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="hp-field hp-margin-bottom-16">
                  <label className="it-input-label" style={{ fontWeight: "bold" }}>Audience Rating (1-5)</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <i
                        key={num}
                        className={num <= reportRating ? "fa-solid fa-star" : "fa-regular fa-star"}
                        style={{ color: "#fbbf24", cursor: "pointer", fontSize: "20px" }}
                        onClick={() => setReportRating(num)}
                      />
                    ))}
                    <span style={{ fontSize: "13px", marginLeft: "10px", color: "#ccc", fontWeight: "normal" }}>
                      {reportRating === 5 && "(Excellent)"}
                      {reportRating === 4 && "(Very Good)"}
                      {reportRating === 3 && "(Good)"}
                      {reportRating === 2 && "(Fair)"}
                      {reportRating === 1 && "(Poor)"}
                    </span>
                  </div>
                </div>

                <div className="hp-field hp-margin-bottom-16">
                  <label className="it-input-label" style={{ fontWeight: "bold" }}>Audience Notes & Feedback</label>
                  <textarea
                    rows={3}
                    value={reportAudienceNotes}
                    onChange={e => setReportAudienceNotes(e.target.value)}
                    placeholder="Enter observations on crowd reactions, feedback..."
                    className="it-input"
                    style={{ resize: "none" }}
                  />
                </div>
              </div>
              <div className="it-modal-footer" style={{ justifyContent: "flex-end", gap: "12px", padding: "20px" }}>
                <button
                  type="button"
                  className="it-btn hp-premium-modal-btn-cancel"
                  onClick={() => {
                    setShowReportSubmitModal(null);
                    setReportOccupancy(0);
                    setReportIssues([]);
                    setConfirmOverCapacity(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="it-btn ps-btn-modal-confirm hp-premium-modal-btn-confirm"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReportDetailsModal && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card hp-premium-modal-card" style={{ maxWidth: "600px", width: "90%" }}>
            <div className="hp-premium-modal-header">
              <div className="hp-premium-modal-icon-container success-blue">
                <i className="fa-solid fa-chart-pie" />
              </div>
              <h3 className="hp-premium-modal-title">
                Performance Report Details
              </h3>
            </div>
            <div className="it-modal-body hp-premium-modal-body-text" style={{ maxHeight: "70vh", overflowY: "auto", padding: "20px" }}>
              <div className="hp-margin-bottom-16">
                <table className="it-table" style={{ width: "100%", fontSize: "13px" }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Performance:</td>
                      <td>{showReportDetailsModal.performance_title}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Submitted By:</td>
                      <td>{showReportDetailsModal.submitted_by_name}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Submitted At:</td>
                      <td>{new Date(showReportDetailsModal.submitted_at).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Occupancy:</td>
                      <td>{showReportDetailsModal.occupancy_count} seats</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Rating:</td>
                      <td>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {[1, 2, 3, 4, 5].map((num) => (
                            <i
                              key={num}
                              className={num <= showReportDetailsModal.audience_rating ? "fa-solid fa-star" : "fa-regular fa-star"}
                              style={{ color: "#fbbf24", fontSize: "14px" }}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Status:</td>
                      <td>
                        <span className={`it-status ${showReportDetailsModal.is_late ? "inactive" : showReportDetailsModal.priority_review ? "pending" : "active"}`}>
                          {showReportDetailsModal.status}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Notes:</td>
                      <td style={{ whiteSpace: "pre-wrap" }}>{showReportDetailsModal.audience_notes || "-"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ border: "1px solid #333", borderRadius: "6px", padding: "12px" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "bold" }}>Technical Issues Log</h4>
                {(() => {
                  try {
                    const parsed = JSON.parse(showReportDetailsModal.technical_issues);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      return (
                        <table className="it-table" style={{ fontSize: "12px", width: "100%" }}>
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Time</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsed.map((issue: any, idx: number) => (
                              <tr key={`log-${idx}`}>
                                <td>{issue.type}</td>
                                <td>{issue.time}</td>
                                <td>
                                  <span className={`it-status ${issue.status === "Resolved" ? "active" : "pending"}`}>
                                    {issue.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    }
                  } catch (e) {}
                  return <p style={{ margin: 0, fontSize: "12px", color: "#888" }}>No technical issues reported during this performance.</p>;
                })()}
              </div>
            </div>
            <div className="it-modal-footer" style={{ justifyContent: "center", padding: "20px" }}>
              <button
                type="button"
                className="it-btn ps-btn-modal-confirm hp-premium-modal-btn-done"
                onClick={() => setShowReportDetailsModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPassengerProfileModalId && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card hp-premium-modal-card" style={{ maxWidth: "600px", width: "90%", textAlign: "left" }}>
            <div className="hp-premium-modal-header" style={{ alignItems: "center" }}>
              <div className="hp-premium-modal-icon-container success-blue">
                <i className="fa-solid fa-user-shield" />
              </div>
              <h3 className="hp-premium-modal-title">
                Passenger Profile Details
              </h3>
            </div>
            
            <div className="it-modal-body hp-premium-modal-body-text" style={{ maxHeight: "70vh", overflowY: "auto", padding: "20px" }}>
              {loadingPassengerProfileModal && (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: "28px", color: "var(--blue)" }} />
                  <p style={{ marginTop: "12px", color: "#64748b" }}>Loading passenger profile...</p>
                </div>
              )}
              
              {!loadingPassengerProfileModal && passengerProfileModalData && (
                <div>
                  <div style={{ marginBottom: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#94a3b8" }}>Full Name</span>
                      <p style={{ fontSize: "15px", fontWeight: "bold", margin: "4px 0 0 0", color: "#1e293b" }}>{passengerProfileModalData.display_name}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#94a3b8" }}>Membership Status</span>
                      <p style={{ margin: "4px 0 0 0" }}>
                        <span className={`hp-tag-sharp ${passengerProfileModalData.status?.toLowerCase() === "vip" ? "s-current" : "s-upcoming"}`} style={{ fontSize: "10px", padding: "2px 8px" }}>
                          {passengerProfileModalData.status}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#94a3b8" }}>Email Address</span>
                      <p style={{ fontSize: "14px", margin: "4px 0 0 0", color: "#334155" }}>{passengerProfileModalData.email}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#94a3b8" }}>Spending Balance</span>
                      <p style={{ fontSize: "14px", margin: "4px 0 0 0", color: "#059669", fontWeight: "bold" }}>${parseFloat(passengerProfileModalData.spending_balance).toFixed(2)}</p>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", color: "#475569" }}>Travel Preferences</h4>
                    
                    {passengerProfileModalData.preferences ? (
                      <table className="it-table" style={{ width: "100%", fontSize: "13px" }}>
                        <tbody>
                          <tr>
                            <td style={{ fontWeight: "bold", padding: "6px 0", width: "40%" }}>Cabin Preference:</td>
                            <td style={{ padding: "6px 0" }}>{passengerProfileModalData.preferences.cabin_preference || "Not Specified"}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: "bold", padding: "6px 0" }}>Room Temperature:</td>
                            <td style={{ padding: "6px 0" }}>{passengerProfileModalData.preferences.temperature ? `${passengerProfileModalData.preferences.temperature}°C` : "Not Specified"}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: "bold", padding: "6px 0" }}>Pillow Type:</td>
                            <td style={{ padding: "6px 0" }}>{passengerProfileModalData.preferences.pillow_type || "Not Specified"}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: "bold", padding: "6px 0" }}>Dietary Notes:</td>
                            <td style={{ padding: "6px 0" }}>{passengerProfileModalData.preferences.dietary_notes || "None"}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: "bold", padding: "6px 0" }}>Preferred Newspaper:</td>
                            <td style={{ padding: "6px 0" }}>{passengerProfileModalData.preferences.preferred_newspaper || "None"}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: "bold", padding: "6px 0" }}>Minibar Stocking:</td>
                            <td style={{ padding: "6px 0" }}>{passengerProfileModalData.preferences.minibar_preference || "Standard"}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: "bold", padding: "6px 0" }}>Special Requests:</td>
                            <td style={{ padding: "6px 0", whiteSpace: "pre-wrap" }}>{passengerProfileModalData.preferences.special_requests || "None"}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ margin: 0, fontSize: "13px", color: "#64748b", fontStyle: "italic" }}>No preferences logged on file.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="it-modal-footer" style={{ justifyContent: "center", padding: "20px" }}>
              <button
                type="button"
                className="it-btn ps-btn-modal-confirm hp-premium-modal-btn-done"
                onClick={() => setSelectedPassengerProfileModalId(null)}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </Dashboard>
  );
}
