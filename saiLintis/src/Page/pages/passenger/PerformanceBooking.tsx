import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface PerformanceBookingProps {
  passengerId: string;
  passengerProfileDetails: any;
  isUpdating: boolean;
  setIsUpdating: (val: boolean) => void;
  setOperationError: (val: string) => void;
  setOperationSuccess: (val: string) => void;
  onNotificationAdded?: () => void;
}

export function PerformanceBooking({
  passengerId,
  passengerProfileDetails,
  isUpdating,
  setIsUpdating,
  setOperationError,
  setOperationSuccess,
  onNotificationAdded
}: PerformanceBookingProps) {
  const [selectedPerformanceShow, setSelectedPerformanceShow] = useState("");
  const [selectedTheatreSeat, setSelectedTheatreSeat] = useState<string | null>(null);
  const [useVipEarlyAccessForSeating, setUseVipEarlyAccessForSeating] = useState(false);
  const [seatStatuses, setSeatStatuses] = useState<Record<string, { status: string; entertainmentId?: string }>>({});
  const [performancesList, setPerformancesList] = useState<{ performance_id: string; title: string; schedule_date: string; schedule_time: string; status: string }[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState<any | null>(null);

  const [newShowTitle, setNewShowTitle] = useState("");
  const [newShowDate, setNewShowDate] = useState("");
  const [newShowTime, setNewShowTime] = useState("");
  const [newShowCapacity, setNewShowCapacity] = useState(100);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isEmployee = user.role_name && user.role_name !== "Passenger";

  useEffect(() => {
    const fetchAllPerfs = async () => {
      try {
        const perfs: any[] = await invoke("get_all_performances");
        setPerformancesList(perfs);
        if (perfs.length > 0 && !selectedPerformanceShow) {
          setSelectedPerformanceShow(perfs[0].title);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAllPerfs();
  }, [isUpdating]);

  useEffect(() => {
    if (!passengerId || !selectedPerformanceShow) return;
    const fetchSeats = async () => {
      try {
        const res: Record<string, string> = await invoke("get_seats_for_performance", {
          performanceTitle: selectedPerformanceShow,
          passengerId: passengerId
        });
        const mapped: Record<string, { status: string; entertainmentId?: string }> = {};
        Object.entries(res).forEach(([seatNum, status]) => {
          mapped[seatNum] = {
            status: status.toLowerCase(),
            entertainmentId: selectedPerformanceShow,
          };
        });
        setSeatStatuses(mapped);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSeats();
  }, [passengerId, selectedPerformanceShow, isUpdating]);

  const handleBookPerformanceSeat = async () => {
    setOperationError("");
    setOperationSuccess("");
    if (!selectedTheatreSeat) {
      setOperationError("Please select a theater seat first.");
      return;
    }
    const targetSeat = selectedTheatreSeat;
    setIsUpdating(true);
    try {
      const payloadData = {
        passenger_id: passengerId,
        entertainment_id: selectedPerformanceShow,
        seat_number: targetSeat
      };
      if (useVipEarlyAccessForSeating && passengerProfileDetails?.status?.toLowerCase() === "vip") {
        await invoke("reserve_entertainment_seat_with_vip_early_access", { payload: payloadData });
      } else {
        await invoke("reserve_seat_for_entertainment", { payload: payloadData });
      }

      const notifKey = `passenger_notifications_${passengerId}`;
      const existingNotifs = JSON.parse(localStorage.getItem(notifKey) || "[]");
      const pendingNotif = {
        id: `seat-pending-${targetSeat}-${Date.now()}`,
        title: "Seat Booking Submitted",
        body: `Booking request for Seat ${targetSeat} (${selectedPerformanceShow}) submitted. Awaiting staff approval.`,
        time: new Date().toISOString(),
        icon: "fa-clock"
      };
      localStorage.setItem(notifKey, JSON.stringify([pendingNotif, ...existingNotifs]));
      if (onNotificationAdded) {
        onNotificationAdded();
      }

      setShowSuccessModal({
        showTitle: selectedPerformanceShow,
        seatNumber: targetSeat,
        passengerId: passengerId,
        status: "Pending Approval"
      });

      setOperationSuccess(`Seat ${targetSeat} for show ${selectedPerformanceShow} successfully booked! Please approve it in the Staff Approval Console.`);
      setSelectedTheatreSeat(null);
    } catch (error) {
      setOperationError("Failed to reserve seat: " + String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreatePerformance = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationError("");
    setOperationSuccess("");
    if (!newShowTitle || !newShowDate || !newShowTime) {
      setOperationError("Please fill out all show details.");
      return;
    }
    setIsUpdating(true);
    try {
      await invoke("create_performance", {
        title: newShowTitle,
        date: newShowDate,
        time: newShowTime + ":00",
        capacity: Number(newShowCapacity)
      });
      setOperationSuccess(`Performance show "${newShowTitle}" successfully created!`);
      setNewShowTitle("");
      setNewShowDate("");
      setNewShowTime("");
    } catch (err) {
      setOperationError("Failed to create performance: " + String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const getSeatClassAndProperties = (seatId: string) => {
    const seatData = seatStatuses[seatId] || { status: "available" };
    const isReserved = seatData.status === "reserved" || seatData.status === "booked";
    const isPending = seatData.status === "pending";
    const isApproved = seatData.status === "approved";
    const isSelected = selectedTheatreSeat === seatId;

    let seatClass = "";
    if (isReserved) seatClass = "reserved";
    else if (isPending) seatClass = "pending";
    else if (isApproved) seatClass = "approved";
    else if (isSelected) seatClass = "selected";

    return {
      seatClass,
      clickable: !isReserved && !isPending && !isApproved
    };
  };

  const leftBalconyColumns = ["G", "F", "E"];
  const rightBalconyColumns = ["H", "I", "J"];
  const mainFloorRows = ["A", "B", "C", "D"];
  const mainFloorColumns = [1, 2, 3, 4, 5, 6];
  const balconyRows = [1, 2, 3, 4];

  return (
    <div className="ps-dashboard-container">
      <div className="ps-title-section">
        <h1 className="hp-title-giant">Theatre & Performance Bookings</h1>
        <p className="hp-subtitle-clean">Reserve the best seats for evening shows and theater plays at the Grand Theatre.</p>
      </div>

      <div className="ps-grid-selection">
        <div className="ps-booking-card ps-booking-card-wide">
          <h3>Interactive Seating Plan</h3>
          <p className="ps-card-subtitle">Select your preferred seat from the floor layout plan below.</p>

          <div className="ps-theatre-top-info">
            <h2>{selectedPerformanceShow || "No Show Selected"}</h2>
            <p>Main Hall</p>
          </div>

          <div className="ps-theatre-stage-row">
            <div className="ps-theatre-stage">
              <span>main stage</span>
            </div>
          </div>

          <div className="ps-theatre-seating-sections">
            <div className="ps-seating-section left-balcony">
              <span className="ps-section-label">2nd Floor</span>
              <div className="ps-balcony-grid">
                {balconyRows.map((rowNum) => (
                  <div key={rowNum} className="ps-balcony-row">
                    {leftBalconyColumns.map((colName) => {
                      const seatId = `${colName}${rowNum}`;
                      const { seatClass, clickable } = getSeatClassAndProperties(seatId);
                      return (
                        <div
                          key={seatId}
                          onClick={() => clickable && setSelectedTheatreSeat(seatId)}
                          className={`ps-seat-node ${seatClass}`}
                          title={`Balcony Seat ${seatId}`}
                        >
                          {colName}{rowNum}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="ps-seating-section main-floor">
              <span className="ps-section-label">1st Floor</span>
              <div className="ps-main-floor-grid">
                {mainFloorRows.map((rowLetter) => (
                  <div key={rowLetter} className="ps-main-floor-row">
                    <span className="ps-row-letter">{rowLetter}</span>
                    {mainFloorColumns.map((colNum) => {
                      const seatId = `${rowLetter}${colNum}`;
                      const { seatClass, clickable } = getSeatClassAndProperties(seatId);
                      return (
                        <div
                          key={seatId}
                          onClick={() => clickable && setSelectedTheatreSeat(seatId)}
                          className={`ps-seat-node ${seatClass}`}
                          title={`Main Floor Seat ${seatId}`}
                        >
                          {colNum}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="ps-seating-section right-balcony">
              <span className="ps-section-label">2nd Floor</span>
              <div className="ps-balcony-grid">
                {balconyRows.map((rowNum) => (
                  <div key={rowNum} className="ps-balcony-row">
                    {rightBalconyColumns.map((colName) => {
                      const seatId = `${colName}${rowNum}`;
                      const { seatClass, clickable } = getSeatClassAndProperties(seatId);
                      return (
                        <div
                          key={seatId}
                          onClick={() => clickable && setSelectedTheatreSeat(seatId)}
                          className={`ps-seat-node ${seatClass}`}
                          title={`Balcony Seat ${seatId}`}
                        >
                          {colName}{rowNum}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ps-theatre-legend">
            <div className="ps-legend-item">
              <span className="ps-legend-box available" />
              <span>Available</span>
            </div>
            <div className="ps-legend-item">
              <span className="ps-legend-box selected" />
              <span>Selected</span>
            </div>
            <div className="ps-legend-item">
              <span className="ps-legend-box pending ps-legend-pending" />
              <span>Pending</span>
            </div>
            <div className="ps-legend-item">
              <span className="ps-legend-box approved ps-legend-approved" />
              <span>Approved</span>
            </div>
            <div className="ps-legend-item">
              <span className="ps-legend-box booked"  />
              <span>Reserved</span>
            </div>
          </div>

          {passengerProfileDetails?.status?.toLowerCase() === "vip" && (
            <div className="hp-field ps-vip-checkbox-container">
              <label className="ps-checkbox-label">
                <input
                  type="checkbox"
                  checked={useVipEarlyAccessForSeating}
                  onChange={(e) => setUseVipEarlyAccessForSeating(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                Use VIP Early Access Booking
              </label>
            </div>
          )}

          <div className="ps-book-btn-container">
            <button
              onClick={handleBookPerformanceSeat}
              disabled={isUpdating}
              className="hp-btn-primary-sharp ps-book-btn-fixed"
            >
              Confirm Seat Reservation
            </button>
          </div>
        </div>

        <div className="ps-booking-card ps-booking-card-wide">
          <h3>Show & Performance Selector</h3>
          <div className="hp-field ps-field-wrapper">
            <label className="ps-field-label">Select Performance</label>
            <select
              value={selectedPerformanceShow}
              onChange={(e) => setSelectedPerformanceShow(e.target.value)}
              className="it-select"
            >
              {performancesList.map((p) => (
                <option key={p.performance_id} value={p.title}>
                  {p.title} ({p.schedule_date} · {p.schedule_time})
                </option>
              ))}
            </select>
          </div>

          <p className="ps-show-intro">
            Enjoy high-quality original cruise productions, stand-up comedy acts, musical theater, and live symphonies.
          </p>
          <div className="ps-show-list">
            {performancesList.map((p, idx) => {
              const isLast = idx === performancesList.length - 1;
              return (
                <div key={p.performance_id} className={isLast ? "ps-show-item-last" : "ps-show-item"}>
                  <div>
                    <h4 className="ps-show-title">{p.title}</h4>
                    <span className="ps-show-meta">{p.schedule_date} · {p.schedule_time}</span>
                  </div>
                  <span className={`hp-tag-sharp s-${p.status.toLowerCase()}`}>{p.status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {isEmployee && (
          <div className="ps-booking-card ps-booking-card-wide ps-margin-top-20">
            <h3>Create Performance Event (Manager/Staff)</h3>
            <form onSubmit={handleCreatePerformance} className="it-form">
              <div className="hp-field ps-field-wrapper">
                <label className="ps-field-label">Show Title</label>
                <input
                  type="text"
                  value={newShowTitle}
                  onChange={(e) => setNewShowTitle(e.target.value)}
                  className="it-input"
                  placeholder="e.g. Broadway Dance Spectacular"
                  required
                />
              </div>
              <div className="hp-field ps-field-wrapper">
                <label className="ps-field-label">Schedule Date</label>
                <input
                  type="date"
                  value={newShowDate}
                  onChange={(e) => setNewShowDate(e.target.value)}
                  className="it-input"
                  required
                />
              </div>
              <div className="hp-field ps-field-wrapper">
                <label className="ps-field-label">Schedule Time</label>
                <input
                  type="time"
                  value={newShowTime}
                  onChange={(e) => setNewShowTime(e.target.value)}
                  className="it-input"
                  required
                />
              </div>
              <div className="hp-field ps-field-wrapper">
                <label className="ps-field-label">Total Seating Capacity</label>
                <input
                  type="number"
                  value={newShowCapacity}
                  onChange={(e) => setNewShowCapacity(Number(e.target.value))}
                  className="it-input"
                  required
                />
              </div>
              <button type="submit" disabled={isUpdating} className="hp-btn-primary-sharp">
                Create Event & Generate Seats
              </button>
            </form>
          </div>
        )}
      </div>

      {showSuccessModal && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card ps-modal-confirm hp-premium-modal-card">
            <div className="hp-premium-modal-header">
              <div className="hp-premium-modal-icon-container success-blue">
                <i className="fa-solid fa-chair" />
              </div>
              <h3 className="hp-premium-modal-title">
                Booking Submitted
              </h3>
            </div>
            <div className="it-modal-body hp-premium-modal-body-list">
              <div style={{ marginBottom: "6px" }}><strong>Show Title:</strong> <span style={{ color: "#0f172a" }}>{showSuccessModal.showTitle}</span></div>
              <div style={{ marginBottom: "6px" }}><strong>Seat Number:</strong> <span style={{ color: "#0f172a", fontWeight: "bold" }}>{showSuccessModal.seatNumber}</span></div>
              <div style={{ marginBottom: "6px" }}><strong>Passenger ID:</strong> <span style={{ color: "#0f172a" }}>{showSuccessModal.passengerId}</span></div>
              <div><strong>Status:</strong> <span style={{ color: "#ca8a04", fontWeight: "bold" }}>{showSuccessModal.status}</span></div>
            </div>
            <div className="it-modal-footer" style={{ justifyContent: "center", padding: 0 }}>
              <button
                type="button"
                className="it-btn ps-btn-modal-confirm hp-premium-modal-btn-confirm"
                onClick={() => setShowSuccessModal(null)}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
