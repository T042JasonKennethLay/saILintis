import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ActivitiesProps {
  passengerId: string;
  isUpdating: boolean;
  setIsUpdating: (val: boolean) => void;
  setOperationError: (val: string) => void;
  setOperationSuccess: (val: string) => void;
  fetchSpendingData: () => Promise<void>;
  onNotificationAdded?: () => void;
}

export function Activities({
  passengerId,
  isUpdating,
  setIsUpdating,
  setOperationError,
  setOperationSuccess,
  fetchSpendingData,
  onNotificationAdded
}: ActivitiesProps) {
  const [joinedEvents, setJoinedEvents] = useState<string[]>([]);
  const [showEventConfirmModal, setShowEventConfirmModal] = useState<any>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("All");

  const categoriesList = ["All", "Wellness & Sport", "Culinary & Workshops", "Arts & Shows"];

  const [activitiesList, setActivitiesList] = useState<any[]>([]);

  useEffect(() => {
    if (passengerId) {
      loadJoinedEvents();
    }
    fetchActivities();
  }, [passengerId]);

  const fetchActivities = async () => {
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
      setActivitiesList(mapped);
    } catch (error) {
      setOperationError("Failed to load activities: " + String(error));
    }
  };

  const loadJoinedEvents = () => {
    const events = JSON.parse(localStorage.getItem(`passenger_joined_events_${passengerId}`) || "[]");
    setJoinedEvents(events);
  };

  const handleJoinActivity = (activity: any) => {
    setShowEventConfirmModal(activity);
  };

  const executeJoinActivity = async (activity: any) => {
    if (!passengerId) return;
    setIsUpdating(true);
    try {
      if (activity.price > 0) {
        await invoke("add_spending_entry", {
          payload: {
            passenger_id: passengerId,
            description: `Activity: ${activity.title}`,
            amount: activity.price.toFixed(2)
          }
        });
      }

      const storageKey = `passenger_joined_events_${passengerId}`;
      const existingEvents = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const updatedEvents = [...existingEvents, activity.id];
      localStorage.setItem(storageKey, JSON.stringify(updatedEvents));
      setJoinedEvents(updatedEvents);

      const notifKey = `passenger_notifications_${passengerId}`;
      const existingNotifs = JSON.parse(localStorage.getItem(notifKey) || "[]");
      const newNotif = {
        id: `activity-${activity.id}-${Date.now()}`,
        title: "Activity Registered",
        body: `You joined ${activity.title}. Time: ${activity.time}. Location: ${activity.location}.`,
        time: new Date().toISOString(),
        icon: "fa-calendar-check"
      };
      localStorage.setItem(notifKey, JSON.stringify([newNotif, ...existingNotifs]));

      if (onNotificationAdded) {
        onNotificationAdded();
      }

      setOperationSuccess(`Successfully registered for: ${activity.title}!`);
      await fetchSpendingData();
    } catch (error) {
      setOperationError("Failed to register for activity: " + String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredActivities = activitiesList.filter(
    (act) => activeCategoryFilter === "All" || act.category === activeCategoryFilter
  );

  return (
    <div className="ps-dashboard-container">
      <div className="ps-title-section">
        <h1 className="hp-title-giant">Onboard Activities & Workshops</h1>
        <p className="hp-subtitle-clean">Explore and book daily sports, wellness, cooking workshops, and entertainment activities.</p>
      </div>

      <div className="ps-activities-filter-row">
        {categoriesList.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategoryFilter(cat)}
            className={`ps-activities-filter-btn ${activeCategoryFilter === cat ? "active" : ""}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="ps-activities-grid">
        {filteredActivities.map((act) => {
          const isJoined = joinedEvents.includes(act.id);
          return (
            <div key={act.id} className="ps-activity-catalog-card">
              <div className="ps-activity-catalog-header">
                <div className="ps-activity-catalog-icon">
                  <i className={`fa ${act.icon}`} />
                </div>
                <span className={`ps-event-price-tag ${act.price === 0 ? "free" : "paid"}`}>
                  {act.price === 0 ? "FREE" : `Rp ${act.price.toLocaleString("id-ID")}`}
                </span>
              </div>
              <div className="ps-activity-catalog-content">
                <span className="ps-activity-catalog-category">{act.category}</span>
                <h3 className="ps-activity-catalog-title">{act.title}</h3>
                <p className="ps-activity-catalog-description">{act.description}</p>
                <div className="ps-activity-catalog-meta">
                  <div className="ps-activity-meta-item">
                    <i className="fa fa-clock" />
                    <span>{act.time}</span>
                  </div>
                  <div className="ps-activity-meta-item">
                    <i className="fa fa-map-marker-alt" />
                    <span>{act.location}</span>
                  </div>
                </div>
              </div>
              <div className="ps-activity-catalog-footer">
                <button
                  onClick={() => handleJoinActivity(act)}
                  disabled={isJoined || isUpdating}
                  className={`ps-activity-catalog-btn ${isJoined ? "joined" : ""}`}
                >
                  {isJoined ? "Registered" : "Book Activity"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showEventConfirmModal && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card ps-modal-confirm">
            <div className="it-modal-header ps-modal-header-confirm">Confirm Activity Booking</div>
            <div className="it-modal-body">
              <p className="ps-modal-body-text">
                Are you sure you want to book the activity: <strong>{showEventConfirmModal.title}</strong>?
              </p>
              {showEventConfirmModal.price > 0 && (
                <div className="ps-modal-charge-alert">
                  <i className="fa fa-info-circle" />
                  <span>A charge of <strong>Rp {showEventConfirmModal.price.toLocaleString("id-ID")}</strong> will be added to your onboard account.</span>
                </div>
              )}
            </div>
            <div className="it-modal-footer">
              <button className="it-btn" onClick={() => setShowEventConfirmModal(null)}>
                Cancel
              </button>
              <button
                className="it-btn ps-btn-modal-confirm"
                onClick={() => {
                  const activityToJoin = showEventConfirmModal;
                  setShowEventConfirmModal(null);
                  executeJoinActivity(activityToJoin);
                }}
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
