import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface RestaurantReservationProps {
  passengerId: string;
  passengerProfileDetails: any;
  isUpdating: boolean;
  setIsUpdating: (val: boolean) => void;
  setOperationError: (val: string) => void;
  setOperationSuccess: (val: string) => void;
  onNotificationAdded?: () => void;
}

export function RestaurantReservation({
  passengerId,
  passengerProfileDetails,
  isUpdating,
  setIsUpdating,
  setOperationError,
  setOperationSuccess,
  onNotificationAdded
}: RestaurantReservationProps) {
  const [diningTableSelection, setDiningTableSelection] = useState<number | null>(null);
  const [dietaryPreferenceNotes, setDietaryPreferenceNotes] = useState("");
  const [useVipEarlyAccessForDining, setUseVipEarlyAccessForDining] = useState(false);
  const [tableStatuses, setTableStatuses] = useState<Record<number, { status: string; bookedAt?: number }>>({});
  const [activeMapCategory, setActiveMapCategory] = useState("Regular");
  const [showVipLockModal, setShowVipLockModal] = useState(false);
  const [showTableSelectModal, setShowTableSelectModal] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<any | null>(null);

  const [newTableRestaurant, setNewTableRestaurant] = useState("Royal Horizon Deck");
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState(4);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isEmployee = user.role_name && user.role_name !== "Passenger";

  const vipChefDelicaciesList = [
    { title: "Lobster Thermidor", description: "Butter-poached lobster tail served with a rich cognac cream sauce and herb crust.", tag: "VIP Exclusive" },
    { title: "Caviar Tasting", description: "A selection of premium Osetra and Beluga caviar accompanied by traditional blinis and crème fraîche.", tag: "VIP Exclusive" },
    { title: "Truffle Tagliolini", description: "House-made pasta tossed in black truffle butter, finished with shaved white Alba truffles.", tag: "VIP Exclusive" },
    { title: "Wagyu Ribeye", description: "A5 Miyazaki Wagyu ribeye seared over white binchotan charcoal, served with roasted root vegetables.", tag: "VIP Exclusive" }
  ];

  useEffect(() => {
    if (!passengerId) return;
    const fetchTables = async () => {
      try {
        const restaurantName = activeMapCategory === "VIP" ? "Le Voyage Restaurant" : "Royal Horizon Deck";
        const res: Record<string, string> = await invoke("get_dining_tables", { restaurantName, passengerId });
        const mapped: Record<number, { status: string; bookedAt?: number }> = {};
        Object.entries(res).forEach(([tableNum, status]) => {
          const num = parseInt(tableNum);
          mapped[num] = {
            status: status.toLowerCase(),
            bookedAt: Date.now()
          };
        });
        setTableStatuses(mapped);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTables();
  }, [passengerId, activeMapCategory, isUpdating]);

  const handleMakeTableReservation = async () => {
    setOperationError("");
    setOperationSuccess("");
    if (diningTableSelection === null) {
      setOperationError("Please select a dining table first.");
      return;
    }
    const selectedTable = diningTableSelection;
    setIsUpdating(true);
    try {
      const payloadData = {
        passenger_id: passengerId,
        table_id: String(selectedTable),
        dietary_request: dietaryPreferenceNotes.trim() || "None"
      };
      if (useVipEarlyAccessForDining && passengerProfileDetails?.status?.toLowerCase() === "vip") {
        await invoke("reserved_dining_table_with_vip_early_access", { payload: payloadData });
      } else {
        await invoke("reserved_dining_table_with_dietary_request", { payload: payloadData });
      }
      
      const notifKey = `passenger_notifications_${passengerId}`;
      const existingNotifs = JSON.parse(localStorage.getItem(notifKey) || "[]");
      const pendingNotif = {
        id: `dining-pending-${selectedTable}-${Date.now()}`,
        title: "Table Booking Submitted",
        body: `Booking request for Table T-${selectedTable} submitted. Awaiting manager approval.`,
        time: new Date().toISOString(),
        icon: "fa-clock"
      };
      localStorage.setItem(notifKey, JSON.stringify([pendingNotif, ...existingNotifs]));
      if (onNotificationAdded) {
        onNotificationAdded();
      }

      setShowSuccessModal({
        restaurantName: activeMapCategory === "VIP" ? "Le Voyage Restaurant" : "Royal Horizon Deck",
        tableNumber: selectedTable,
        dietaryRequest: dietaryPreferenceNotes || "None",
        status: "Pending Approval"
      });

      setOperationSuccess(`Table T-${selectedTable} successfully booked! Please approve the reservation in the Staff Approval Console.`);
      setDiningTableSelection(null);
      setDietaryPreferenceNotes("");

    } catch (error) {
      setOperationError("Failed to book table: " + String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateDiningTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationError("");
    setOperationSuccess("");
    if (!newTableNumber) {
      setOperationError("Please enter table number.");
      return;
    }
    setIsUpdating(true);
    try {
      await invoke("create_dining_table", {
        restaurantName: newTableRestaurant,
        tableNumber: newTableNumber,
        capacity: Number(newTableCapacity)
      });
      setOperationSuccess(`Table T-${newTableNumber} for "${newTableRestaurant}" successfully added!`);
      setNewTableNumber("");
    } catch (err) {
      setOperationError("Failed to add table: " + String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMapCategoryChange = (category: string) => {
    if (category === "VIP" && passengerProfileDetails?.status?.toLowerCase() !== "vip") {
      setShowVipLockModal(true);
      return;
    }
    setActiveMapCategory(category);
  };

  return (
    <div className="ps-dashboard-container">
      <div className="ps-title-section">
        <h1 className="hp-title-giant">Dining Reservations & Fine Dining</h1>
        <p className="hp-subtitle-clean">Book luxury cruise dining tables and submit custom dietary requirements.</p>
      </div>

      <div className="ps-booking-card ps-booking-card-wide ps-margin-bottom-20">
        <h3>Table Selection Map</h3>
        <p className="ps-card-subtitle">Select an available table from the floor plan for your dinner reservation.</p>

        <div className="ps-dining-map-tabs">
          <button
            type="button"
            onClick={() => handleMapCategoryChange("Regular")}
            className={`ps-dining-map-tab-btn ${activeMapCategory === "Regular" ? "active" : ""}`}
          >
            Regular Dining
          </button>
          <button
            type="button"
            onClick={() => handleMapCategoryChange("VIP")}
            className={`ps-dining-map-tab-btn ${activeMapCategory === "VIP" ? "active" : ""} ${passengerProfileDetails?.status?.toLowerCase() !== "vip" ? "locked" : ""}`}
          >
            {passengerProfileDetails?.status?.toLowerCase() !== "vip" && (
              <i className="fa fa-lock" />
            )}
            VIP Sea View Terrace
          </button>
        </div>

        {activeMapCategory === "VIP" ? (
          <div className="ps-restaurant-floorplan vip-only">
            <div className="ps-floor-sea-view">
              <div className="ps-floor-sea-view-title">
                <i className="fa fa-water" /> SEA VIEW TERRACE (VIP AREA)
              </div>
              <div className="ps-floor-sea-view-tables">
                {[1, 2, 3, 4].map((tableNum) => {
                  const tableData = tableStatuses[tableNum] || { status: "available" };
                  const isReserved = tableData.status === "reserved" || tableData.status === "booked";
                  const isPending = tableData.status === "pending";
                  const isApproved = tableData.status === "approved";
                  const isSelected = diningTableSelection === tableNum;
                  
                  let tableClass = "";
                  let statusText = "2 Seats";
                  let icon = "fa-circle-dot";
                  
                  if (isReserved) {
                    tableClass = "reserved";
                    statusText = "Booked";
                    icon = "fa-lock";
                  } else if (isPending) {
                    tableClass = "pending";
                    statusText = "Pending";
                    icon = "fa-hourglass-half";
                  } else if (isApproved) {
                    tableClass = "approved";
                    statusText = "Approved";
                    icon = "fa-circle-check";
                  } else if (isSelected) {
                    tableClass = "selected";
                    statusText = "Selected";
                  }
                  
                  return (
                    <div
                      key={tableNum}
                      onClick={() => !isReserved && !isPending && !isApproved && setShowTableSelectModal(tableNum)}
                      className={`ps-table-node circular ${tableClass}`}
                    >
                      <i className={`fa ${icon}`} />
                      <span>T-{tableNum}</span>
                      <span className="ps-table-capacity">{statusText}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="ps-floor-horizontal-landmark vip-lounge">
              <i className="fa fa-crown" />
              <span>VIP Early Access Lounge</span>
            </div>
          </div>
        ) : (
          <div className="ps-restaurant-floorplan regular-only">
            <div className="ps-floor-horizontal-landmark kitchen">
              <i className="fa fa-utensils" />
              <span>Gourmet Live Kitchen</span>
            </div>

            <div className="ps-floor-central-dining">
              <div className="ps-floor-dining-title">GRAND CENTRAL DINING HALL</div>
              <div className="ps-floor-dining-tables">
                {[5, 6, 7, 8].map((tableNum) => {
                  const tableData = tableStatuses[tableNum] || { status: "available" };
                  const isReserved = tableData.status === "reserved" || tableData.status === "booked";
                  const isPending = tableData.status === "pending";
                  const isApproved = tableData.status === "approved";
                  const isSelected = diningTableSelection === tableNum;
                  
                  let tableClass = "";
                  let statusText = "4 Seats";
                  let icon = "fa-square";
                  
                  if (isReserved) {
                    tableClass = "reserved";
                    statusText = "Booked";
                    icon = "fa-lock";
                  } else if (isPending) {
                    tableClass = "pending";
                    statusText = "Pending";
                    icon = "fa-hourglass-half";
                  } else if (isApproved) {
                    tableClass = "approved";
                    statusText = "Approved";
                    icon = "fa-circle-check";
                  } else if (isSelected) {
                    tableClass = "selected";
                    statusText = "Selected";
                  }
                  
                  return (
                    <div
                      key={tableNum}
                      onClick={() => !isReserved && !isPending && !isApproved && setShowTableSelectModal(tableNum)}
                      className={`ps-table-node rectangular ${tableClass}`}
                    >
                      <i className={`fa ${icon}`} />
                      <span>T-{tableNum}</span>
                      <span className="ps-table-capacity">{statusText}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="ps-floor-horizontal-landmark bar">
              <i className="fa fa-glass-martini-alt" />
              <span>Starlight Cocktail Bar</span>
            </div>

            <div className="ps-floor-alcoves">
              <div className="ps-floor-alcoves-title">COZY PRIVATE ALCOVES</div>
              <div className="ps-floor-alcoves-tables">
                {[9, 10, 11, 12].map((tableNum) => {
                  const tableData = tableStatuses[tableNum] || { status: "available" };
                  const isReserved = tableData.status === "reserved" || tableData.status === "booked";
                  const isPending = tableData.status === "pending";
                  const isApproved = tableData.status === "approved";
                  const isSelected = diningTableSelection === tableNum;
                  
                  let tableClass = "";
                  let statusText = "6 Seats";
                  let icon = "fa-chair";
                  
                  if (isReserved) {
                    tableClass = "reserved";
                    statusText = "Booked";
                    icon = "fa-lock";
                  } else if (isPending) {
                    tableClass = "pending";
                    statusText = "Pending";
                    icon = "fa-hourglass-half";
                  } else if (isApproved) {
                    tableClass = "approved";
                    statusText = "Approved";
                    icon = "fa-circle-check";
                  } else if (isSelected) {
                    tableClass = "selected";
                    statusText = "Selected";
                  }
                  
                  return (
                    <div
                      key={tableNum}
                      onClick={() => !isReserved && !isPending && !isApproved && setShowTableSelectModal(tableNum)}
                      className={`ps-table-node rectangular six-seats ${tableClass}`}
                    >
                      <i className={`fa ${icon}`} />
                      <span>T-{tableNum}</span>
                      <span className="ps-table-capacity">{statusText}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="ps-floor-horizontal-landmark lobby">
              <i className="fa fa-concierge-bell" />
              <span>Lobby Entrance & Hostess Stand</span>
            </div>
          </div>
        )}

        <div className="ps-theatre-legend ps-dining-legend-container">
          <div className="ps-legend-item">
            <div className="ps-legend-box available" />
            <span>Available</span>
          </div>
          <div className="ps-legend-item">
            <div className="ps-legend-box selected ps-legend-selected" />
            <span>Selected</span>
          </div>
          <div className="ps-legend-item">
            <div className="ps-legend-box pending ps-legend-pending" />
            <span>Pending</span>
          </div>
          <div className="ps-legend-item">
            <div className="ps-legend-box approved ps-legend-approved" />
            <span>Approved</span>
          </div>
          <div className="ps-legend-item">
            <div className="ps-legend-box reserved ps-legend-reserved" />
            <span>Reserved</span>
          </div>
        </div>
      </div>

      <div className="ps-grid-selection">
        <div className="ps-booking-card">
          <h3>Dining Reservation Form</h3>
          <p className="ps-card-subtitle">Confirm your table choice and submit dietary preferences.</p>

          <div className="hp-field ps-field-wrapper">
            <label className="ps-field-label">Selected Table</label>
            <input
              type="text"
              readOnly
              className="it-input"
              value={diningTableSelection !== null ? `Table T-${diningTableSelection}` : "None Selected"}
            />
          </div>

          {passengerProfileDetails?.status?.toLowerCase() === "vip" && (
            <div className="hp-field ps-field-wrapper">
              <label className="ps-checkbox-label">
                <input
                  type="checkbox"
                  checked={useVipEarlyAccessForDining}
                  onChange={(e) => setUseVipEarlyAccessForDining(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                Book with VIP Early Access
              </label>
            </div>
          )}

          <div className="hp-field ps-field-wrapper-top">
            <label className="ps-field-label">Dietary Notes / Special Requests</label>
            <textarea
              placeholder="e.g. Gluten-free, seafood allergy, vegetarian options required"
              value={dietaryPreferenceNotes}
              onChange={(e) => setDietaryPreferenceNotes(e.target.value)}
              className="it-input ps-dietary-textarea"
            />
          </div>

          <button onClick={handleMakeTableReservation} disabled={isUpdating} className="hp-btn-primary-sharp ps-submit-btn">
            Confirm Table Booking
          </button>
        </div>

        <div className="ps-booking-card">
          <h3>Fine Dining Venues</h3>
          <p className="ps-dining-venues-intro">
            Savor gourmet international cuisines prepared by Michelin-starred chefs at Le Voyage and Royal Horizon Deck.
          </p>
          <div className="ps-dining-venue-item">
            <h4 className="ps-dining-venue-title">Le Voyage Restaurant</h4>
            <p className="ps-dining-venue-meta">Deck 7 · International Fine Dining · Dress Code: Formal</p>
          </div>
          <div className="ps-dining-venue-item">
            <h4 className="ps-dining-venue-title">Royal Horizon Deck</h4>
            <p className="ps-dining-venue-meta">Deck 10 · Seafood Specialty · Dress Code: Smart Casual</p>
          </div>

          {passengerProfileDetails?.status?.toLowerCase() === "vip" && (
            <div className="ps-vip-chef-section">
              <span className="ps-vip-badge">Exclusive VIP Chef Menu</span>
              <div className="ps-chef-menu-grid">
                {vipChefDelicaciesList.map((delicacy) => (
                  <div key={delicacy.title} className="ps-chef-menu-card">
                    <span className="ps-chef-menu-tag">{delicacy.tag}</span>
                    <div className="ps-chef-menu-title">{delicacy.title}</div>
                    <div className="ps-chef-menu-desc">{delicacy.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {isEmployee && (
          <div className="ps-booking-card ps-margin-top-20">
            <h3>Add Dining Table (Manager/Staff)</h3>
            <form onSubmit={handleCreateDiningTable} className="it-form">
              <div className="hp-field ps-field-wrapper">
                <label className="ps-field-label">Restaurant</label>
                <select
                  value={newTableRestaurant}
                  onChange={(e) => setNewTableRestaurant(e.target.value)}
                  className="it-select"
                >
                  <option value="Royal Horizon Deck">Royal Horizon Deck (Regular)</option>
                  <option value="Le Voyage Restaurant">Le Voyage Restaurant (VIP)</option>
                </select>
              </div>
              <div className="hp-field ps-field-wrapper">
                <label className="ps-field-label">Table Number (e.g. 13)</label>
                <input
                  type="text"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="it-input"
                  placeholder="e.g. 13"
                  required
                />
              </div>
              <div className="hp-field ps-field-wrapper">
                <label className="ps-field-label">Capacity (Seats)</label>
                <input
                  type="number"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                  className="it-input"
                  required
                />
              </div>
              <button type="submit" disabled={isUpdating} className="hp-btn-primary-sharp">
                Add Table
              </button>
            </form>
          </div>
        )}
      </div>

      {showTableSelectModal !== null && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card ps-modal-confirm">
            <div className="it-modal-header ps-modal-header-confirm">Confirm Table Selection</div>
            <div className="it-modal-body">
              <p className="ps-modal-body-text">
                Would you like to select <strong>Table T-{showTableSelectModal}</strong> for your reservation?
              </p>
            </div>
            <div className="it-modal-footer">
              <button type="button" className="it-btn" onClick={() => setShowTableSelectModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="it-btn ps-btn-modal-confirm"
                onClick={() => {
                  setDiningTableSelection(showTableSelectModal);
                  setShowTableSelectModal(null);
                }}
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {showVipLockModal && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card ps-modal-confirm ps-sos-modal-card">
            <div className="it-modal-header ps-modal-header-confirm ps-sos-modal-header">
              <i className="fa fa-lock" /> VIP Access Required
            </div>
            <div className="it-modal-body">
              <p className="ps-modal-body-text">
                The VIP Sea View Terrace is reserved exclusively for VIP passengers. Upgrade your cabin ticket or contact the concierge deck to access this area.
              </p>
            </div>
            <div className="it-modal-footer">
              <button type="button" className="it-btn ps-sos-btn-modal-confirm" onClick={() => setShowVipLockModal(false)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="it-modal-overlay ps-emergency-overlay">
          <div className="it-modal-card ps-modal-confirm hp-premium-modal-card">
            <div className="hp-premium-modal-header">
              <div className="hp-premium-modal-icon-container success-blue">
                <i className="fa-solid fa-utensils" />
              </div>
              <h3 className="hp-premium-modal-title">
                Reservation Submitted
              </h3>
            </div>
            <div className="it-modal-body hp-premium-modal-body-list">
              <div style={{ marginBottom: "6px" }}><strong>Restaurant:</strong> <span style={{ color: "#0f172a" }}>{showSuccessModal.restaurantName}</span></div>
              <div style={{ marginBottom: "6px" }}><strong>Table:</strong> <span style={{ color: "#0f172a", fontWeight: "bold" }}>T-{showSuccessModal.tableNumber}</span></div>
              <div style={{ marginBottom: "6px" }}><strong>Dietary Request:</strong> <span style={{ color: "#0f172a" }}>{showSuccessModal.dietaryRequest}</span></div>
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
