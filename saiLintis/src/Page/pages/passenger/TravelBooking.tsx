import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "../../../Home.css";

interface TravelBookingProps {
  itineraryDetails: any;
  passengerProfileDetails: any;
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

export function TravelBooking({ passengerProfileDetails }: TravelBookingProps) {
  const passengerId = passengerProfileDetails?.passenger_id || "default";
  const storageKey = `passenger_boarding_status_${passengerId}`;

  const [activeTab, setActiveTab] = useState<"my-bookings" | "browse">("my-bookings");
  const [bookings, setBookings] = useState<any[]>([]);
  const [allVoyages, setAllVoyages] = useState<Voyage[]>([]);
  const [cabinNumber, setCabinNumber] = useState("Not Assigned");

  const [boardingState, setBoardingState] = useState(() => {
    return localStorage.getItem(storageKey) || "Confirmed";
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    if (!passengerId || passengerId === "default") return;
    setIsLoading(true);
    try {
      const res: any = await invoke("view_booking_reservation_and_itinerary", { passengerId });
      setBookings(res.bookings || []);
      if (res.bookings && res.bookings.length > 0) {
        setCabinNumber(res.bookings[0].cabin_number || "Not Assigned");
      }

      const voyageList = await invoke<Voyage[]>("voyage_get_voyages");
      setAllVoyages(voyageList);
    } catch (err) {
      setErrorMsg("Failed to load travel bookings: " + String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [passengerId]);

  const handleBookVoyage = async (voyageId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      await invoke("voyage_book_voyage", { voyageId, passengerId });
      setSuccessMsg("Successfully booked voyage! Enjoy your trip.");
      await loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBooking = async (voyageId: string) => {
    if (!window.confirm("Are you sure you want to cancel your booking for this voyage?")) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      await invoke("voyage_cancel_booking", { voyageId, passengerId });
      setSuccessMsg("Voyage booking successfully cancelled.");
      await loadData();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBoardShip = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const status = passengerProfileDetails?.status || "Normal";

    if (status === "Emergency") {
      setErrorMsg("Boarding Denied: You have an active medical emergency. Please contact the Medical Officer immediately.");
    } else if (status === "Disembarked") {
      setErrorMsg("Boarding Denied: You are not cleared to sail. Passenger has been disembarked.");
    } else {
      setSuccessMsg("Medical Clearance Verified. Welcome aboard the SaiLintis!");
      localStorage.setItem(storageKey, "Boarded");
      setBoardingState("Boarded");
    }
  };

  const isBooked = (voyageId: string) => {
    return bookings.some((b) => b.voyage_id === voyageId);
  };

  return (
    <div className="ps-dashboard-container">
      <div className="ps-title-section">
        <h1 className="hp-title-giant">Travel Bookings & Itineraries</h1>
        <p className="hp-subtitle-clean">Track voyage routes, check boarding pass details, and browse cruise schedules.</p>
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", marginTop: "16px" }}>
        <button
          onClick={() => {
            setActiveTab("my-bookings");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`it-btn ${activeTab === "my-bookings" ? "it-btn-primary" : "it-btn-secondary"}`}
          style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: "700" }}
        >
          My Bookings & Itinerary
        </button>
        <button
          onClick={() => {
            setActiveTab("browse");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`it-btn ${activeTab === "browse" ? "it-btn-primary" : "it-btn-secondary"}`}
          style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: "700" }}
        >
          Browse Voyages
        </button>
      </div>

      {errorMsg && (
        <div className="hp-error-banner" style={{ marginBottom: "16px", borderRadius: "10px" }}>
          <i className="fa-solid fa-circle-exclamation" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="hp-banner-dismiss">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="mil-success-banner" style={{ marginBottom: "16px", borderRadius: "10px" }}>
          <i className="fa-solid fa-circle-check" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="hp-banner-dismiss">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: "28px", color: "var(--blue)" }} />
          <p style={{ marginTop: "12px", color: "#64748b" }}>Loading travel data...</p>
        </div>
      )}

      {!isLoading && activeTab === "my-bookings" && (
        <div>
          {bookings.map((booking: any) => (
            <div key={booking.booking_id} className="ps-booking-card" style={{ marginBottom: "20px" }}>
              <div className="ps-spending-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>Voyage to {booking.ship_name} · {booking.destination}</h3>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className={`hp-tag-sharp ${boardingState === "Boarded" ? "hp-tag-confirmed" : "hp-tag-pending"}`}>
                    {boardingState}
                  </span>
                  {booking.status === "Upcoming" && (
                    <button
                      onClick={() => handleCancelBooking(booking.voyage_id)}
                      className="it-btn it-btn-danger"
                      style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "6px" }}
                    >
                      Cancel Booking
                    </button>
                  )}
                </div>
              </div>
              <p className="ps-text-muted-medium ps-margin-bottom-20">
                <strong>Cabin Allocation:</strong> {booking.cabin_number || cabinNumber} · <strong>Departure Date:</strong> {new Date(booking.departure_date).toLocaleDateString()}
              </p>

              {boardingState === "Confirmed" && (
                <div style={{ marginTop: "16px", marginBottom: "20px", padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px dashed #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "14px", color: "#1e293b" }}>Ready to Board?</strong>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>Perform medical clearance check and board the cruise ship.</p>
                  </div>
                  <button
                    onClick={handleBoardShip}
                    style={{
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      padding: "8px 16px",
                      fontWeight: "700",
                      fontSize: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    Board Ship (Naik Kapal)
                  </button>
                </div>
              )}

              {boardingState === "Boarded" && (
                <div style={{ marginTop: "16px", marginBottom: "20px", padding: "12px 16px", background: "#ecfdf5", borderRadius: "10px", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <i className="fa-solid fa-circle-check" style={{ color: "#10b981" }} />
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#065f46" }}>Medical Clearance Verified. You are currently onboard the ship.</span>
                </div>
              )}

              <h4>Voyage Itinerary</h4>
              <div className="ps-timeline">
                {booking.itinerary?.map((checkpoint: any, index: number) => (
                  <div key={index} className="ps-timeline-item">
                    <div className={`ps-timeline-marker ${index === 0 ? "active" : ""}`} />
                    <div className="ps-timeline-content">
                      <div className="ps-timeline-header">
                        <span className="ps-timeline-title">Day {checkpoint.day} — {checkpoint.port}</span>
                        <span className="ps-timeline-meta">Voyage Checkpoint</span>
                      </div>
                      <p className="ps-font-14-dark">{checkpoint.activity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {bookings.length === 0 && (
            <div className="it-card" style={{ textAlign: "center", padding: "40px" }}>
              <i className="fa-solid fa-compass" style={{ fontSize: "48px", color: "#cbd5e1", marginBottom: "16px" }} />
              <p className="ps-text-muted-medium" style={{ margin: 0 }}>No active travel bookings found. Go to the "Browse Voyages" tab to book a trip.</p>
            </div>
          )}
        </div>
      )}

      {!isLoading && activeTab === "browse" && (
        <div className="hr-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
          {allVoyages.map((voyage) => {
            const alreadyBooked = isBooked(voyage.voyage_id);
            const isFull = voyage.ship_name ? (voyage.occupancy_count >= voyage.capacity) : false;
            return (
              <div key={voyage.voyage_id} className="it-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#1f2937" }}>
                      {voyage.destination}
                    </h3>
                    {alreadyBooked && (
                      <span className="hp-tag-sharp hp-tag-confirmed" style={{ fontSize: "11px", padding: "2px 8px" }}>
                        Booked
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#4b5563" }}>
                    <strong>Departure:</strong> {new Date(voyage.departure_date).toLocaleString()}
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
                    <strong>Vessel allocated:</strong> {voyage.ship_name || "Unassigned"} · <strong>Capacity status:</strong> {voyage.occupancy_count} / {voyage.capacity}
                  </p>
                </div>
                <div>
                  {alreadyBooked ? (
                    <button
                      onClick={() => handleCancelBooking(voyage.voyage_id)}
                      className="it-btn it-btn-danger"
                      style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: "700" }}
                    >
                      Cancel Booking
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBookVoyage(voyage.voyage_id)}
                      disabled={isFull || !voyage.ship_name}
                      className={`it-btn ${isFull || !voyage.ship_name ? "it-btn-secondary" : "it-btn-primary"}`}
                      style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: "700" }}
                    >
                      {!voyage.ship_name ? "Vessel Unassigned" : isFull ? "Voyage Full" : "Book Voyage"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {allVoyages.length === 0 && (
            <p className="ps-text-muted-medium" style={{ textAlign: "center", padding: "24px" }}>
              No cruise voyages currently scheduled by operations.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
