import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import { LoadingScreen } from "../../components/LoadingScreen";
import "../../../RestaurantDashboard.css";

interface FoodItem {
  item_id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  minimum_stock: number;
  last_delivery_date: string | null;
  created_at: string;
  updated_at: string;
}

interface RestockRequest {
  request_id: string;
  item_id: string;
  item_name: string;
  requested_quantity: number;
  reason: string;
  status: string;
  requested_by: string;
  requested_by_name: string;
  requested_at: string;
}

interface MenuItem {
  menu_item_id: string;
  restaurant_id: string;
  restaurant_name: string;
  item_name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
  created_at: string;
}

interface Reservation {
  booking_id: string;
  passenger_id: string | null;
  passenger_name: string;
  restaurant_name: string;
  tables: string[];
  reservation_date: string;
  reservation_time: string;
  location: string;
  dietary_request: string | null;
  status: string;
}

interface OverviewStats {
  total_food_items: number;
  low_stock_count: number;
  pending_restock_count: number;
  public_menu_count: number;
  vip_menu_count: number;
  pending_reservations: number;
  approved_reservations: number;
  total_reservations: number;
}

export function RestaurantDashboard() {
  const navigate = useNavigate();
  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isManager = loggedInUser.role_name === "Restaurant Manager";

  const [activeItem, setActiveItem] = useState("Restaurant Management");
  const [activeSection, setActiveSection] = useState("Overview");
  const [activeTab, setActiveTab] = useState<"overview" | "inventory" | "public_menu" | "vip_menu" | "reservations">("overview");

  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [publicMenu, setPublicMenu] = useState<MenuItem[]>([]);
  const [vipMenu, setVipMenu] = useState<MenuItem[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [stats, setStats] = useState<OverviewStats>({
    total_food_items: 0,
    low_stock_count: 0,
    pending_restock_count: 0,
    public_menu_count: 0,
    vip_menu_count: 0,
    pending_reservations: 0,
    approved_reservations: 0,
    total_reservations: 0,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [foodName, setFoodName] = useState("");
  const [foodCategory, setFoodCategory] = useState("Ingredients");
  const [foodQty, setFoodQty] = useState(0);
  const [foodUnit, setFoodUnit] = useState("kg");
  const [foodMinStock, setFoodMinStock] = useState(0);

  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockItem, setRestockItem] = useState<FoodItem | null>(null);
  const [restockQty, setRestockQty] = useState(0);
  const [restockReason, setRestockReason] = useState("");

  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [menuType, setMenuType] = useState<"Public" | "VIP">("Public");
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [menuItemName, setMenuItemName] = useState("");
  const [menuItemDesc, setMenuItemDesc] = useState("");
  const [menuItemPrice, setMenuItemPrice] = useState(0);
  const [menuItemCategory, setMenuItemCategory] = useState("Main Course");
  const [menuItemAvailable, setMenuItemAvailable] = useState(true);

  useEffect(() => {
    if (!isManager) {
      const t = setTimeout(() => {
        navigate("/home");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [isManager, navigate]);

  useEffect(() => {
    if (isManager) {
      loadTab(activeTab);
    }
  }, [activeTab, isManager]);

  const loadTab = async (tab: typeof activeTab) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const currentStats = await invoke<any>("rm_get_overview_stats");
      setStats({
        total_food_items: Number(currentStats.total_food_items || 0),
        low_stock_count: Number(currentStats.low_stock_count || 0),
        pending_restock_count: Number(currentStats.pending_restock_count || 0),
        public_menu_count: Number(currentStats.public_menu_count || 0),
        vip_menu_count: Number(currentStats.vip_menu_count || 0),
        pending_reservations: Number(currentStats.pending_reservations || 0),
        approved_reservations: Number(currentStats.approved_reservations || 0),
        total_reservations: Number(currentStats.total_reservations || 0),
      });

      if (tab === "overview") {
        const food = await invoke<FoodItem[]>("rm_get_food_inventory");
        setFoodItems(food);
      } else if (tab === "inventory") {
        const food = await invoke<FoodItem[]>("rm_get_food_inventory");
        setFoodItems(food);
        const reqs = await invoke<RestockRequest[]>("rm_get_restock_requests");
        setRestockRequests(reqs);
      } else if (tab === "public_menu") {
        const items = await invoke<MenuItem[]>("rm_get_menu_items", { menuType: "Public" });
        setPublicMenu(items);
      } else if (tab === "vip_menu") {
        const items = await invoke<MenuItem[]>("rm_get_menu_items", { menuType: "VIP" });
        setVipMenu(items);
      } else if (tab === "reservations") {
        const res = await invoke<Reservation[]>("rm_get_reservations");
        setReservations(res);
      }
    } catch (err) {
      setErrorMsg("Failed to load data: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFoodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!foodName.trim() || !foodCategory.trim() || !foodUnit.trim()) {
      setErrorMsg("All fields are required");
      return;
    }

    setLoading(true);
    try {
      if (selectedFood) {
        await invoke("rm_update_food_item", {
          itemId: selectedFood.item_id,
          itemName: foodName,
          category: foodCategory,
          quantity: Number(foodQty),
          unit: foodUnit,
          minimumStock: Number(foodMinStock),
        });
        setSuccessMsg(`Successfully updated food item: ${foodName}`);
      } else {
        await invoke("rm_create_food_item", {
          itemName: foodName,
          category: foodCategory,
          quantity: Number(foodQty),
          unit: foodUnit,
          minimumStock: Number(foodMinStock),
        });
        setSuccessMsg(`Successfully created food item: ${foodName}`);
      }
      setFoodModalOpen(false);
      loadTab(activeTab);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFoodDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this food item?")) return;
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("rm_delete_food_item", { itemId: id });
      setSuccessMsg("Food item deleted successfully");
      loadTab(activeTab);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!restockItem) return;
    if (restockQty <= 0 || !restockReason.trim()) {
      setErrorMsg("Please provide a valid quantity and reason");
      return;
    }

    setLoading(true);
    try {
      const uId = loggedInUser.user_id || loggedInUser.id;
      await invoke("rm_submit_restock_request", {
        itemId: restockItem.item_id,
        requestedQuantity: Number(restockQty),
        reason: restockReason,
        userId: uId,
      });
      setSuccessMsg(`Submitted restock request for ${restockItem.item_name}`);
      setRestockModalOpen(false);
      loadTab(activeTab);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRestockStatus = async (requestId: string, newStatus: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("rm_update_restock_request_status", { requestId, status: newStatus });
      setSuccessMsg(`Restock request updated to status: ${newStatus}`);
      loadTab(activeTab);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!menuItemName.trim() || !menuItemCategory.trim()) {
      setErrorMsg("Menu item name and category are required");
      return;
    }

    setLoading(true);
    try {
      if (selectedMenuItem) {
        await invoke("rm_update_menu_item", {
          menuItemId: selectedMenuItem.menu_item_id,
          itemName: menuItemName,
          description: menuItemDesc,
          price: Number(menuItemPrice),
          category: menuItemCategory,
          isAvailable: menuItemAvailable,
        });
        setSuccessMsg(`Successfully updated menu item: ${menuItemName}`);
      } else {
        await invoke("rm_create_menu_item", {
          menuType,
          itemName: menuItemName,
          description: menuItemDesc,
          price: Number(menuItemPrice),
          category: menuItemCategory,
        });
        setSuccessMsg(`Successfully created menu item: ${menuItemName}`);
      }
      setMenuModalOpen(false);
      loadTab(activeTab);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleMenuDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this menu item?")) return;
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("rm_delete_menu_item", { menuItemId: id });
      setSuccessMsg("Menu item deleted successfully");
      loadTab(activeTab);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReservation = async (bookingId: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("rm_approve_reservation", { bookingId });
      setSuccessMsg("Reservation approved successfully");
      loadTab(activeTab);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRejectReservation = async (bookingId: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await invoke("rm_reject_reservation", { bookingId });
      setSuccessMsg("Reservation rejected successfully");
      loadTab(activeTab);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const openFoodModal = (item: FoodItem | null) => {
    setSelectedFood(item);
    if (item) {
      setFoodName(item.item_name);
      setFoodCategory(item.category);
      setFoodQty(item.quantity);
      setFoodUnit(item.unit);
      setFoodMinStock(item.minimum_stock);
    } else {
      setFoodName("");
      setFoodCategory("Ingredients");
      setFoodQty(0);
      setFoodUnit("kg");
      setFoodMinStock(0);
    }
    setFoodModalOpen(true);
  };

  const openRestockModal = (item: FoodItem) => {
    setRestockItem(item);
    setRestockQty(Math.max(0, item.minimum_stock - item.quantity));
    setRestockReason("");
    setRestockModalOpen(true);
  };

  const openMenuModal = (item: MenuItem | null, type: "Public" | "VIP") => {
    setSelectedMenuItem(item);
    setMenuType(type);
    if (item) {
      setMenuItemName(item.item_name);
      setMenuItemDesc(item.description || "");
      setMenuItemPrice(item.price);
      setMenuItemCategory(item.category);
      setMenuItemAvailable(item.is_available);
    } else {
      setMenuItemName("");
      setMenuItemDesc("");
      setMenuItemPrice(0);
      setMenuItemCategory("Main Course");
      setMenuItemAvailable(true);
    }
    setMenuModalOpen(true);
  };

  if (!isManager) {
    return (
      <div className="rest-dashboard-container">
        <div className="rest-msg-alert rest-msg-error">
          <i className="fa-solid fa-triangle-exclamation" />
          Access Denied. Redirecting to home...
        </div>
      </div>
    );
  }

  const lowStockItems = foodItems.filter((fi) => fi.quantity <= fi.minimum_stock);

  return (
    <Dashboard
      activeItem={activeItem}
      activeSection={activeSection}
      setActiveItem={setActiveItem}
      setActiveSection={setActiveSection}
    >
      <div className="rest-dashboard-container">

        {errorMsg && (
          <div className="rest-msg-alert rest-msg-error">
            <i className="fa-solid fa-circle-xmark" />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="rest-msg-alert rest-msg-success">
            <i className="fa-solid fa-circle-check" />
            {successMsg}
          </div>
        )}

        {activeTab === "overview" && lowStockItems.length > 0 && (
          <div className="rest-low-stock-banner">
            <div>
              <h4>Low Stock Alert!</h4>
              <p>{lowStockItems.length} food items have dropped below their minimum stock levels.</p>
            </div>
            <button className="rest-btn rest-btn-secondary" onClick={() => setActiveTab("inventory")}>
              Go to Inventory
            </button>
          </div>
        )}

        <div className="rest-tabs-container">
          <button
            className={`rest-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <i className="fa-solid fa-chart-line" /> Overview
          </button>
          <button
            className={`rest-tab-btn ${activeTab === "inventory" ? "active" : ""}`}
            onClick={() => setActiveTab("inventory")}
          >
            <i className="fa-solid fa-warehouse" /> Food Inventory
          </button>
          <button
            className={`rest-tab-btn ${activeTab === "public_menu" ? "active" : ""}`}
            onClick={() => setActiveTab("public_menu")}
          >
            <i className="fa-solid fa-book-open" /> Public Menu
          </button>
          <button
            className={`rest-tab-btn ${activeTab === "vip_menu" ? "active" : ""}`}
            onClick={() => setActiveTab("vip_menu")}
          >
            <i className="fa-solid fa-crown" /> VIP Menu
          </button>
          <button
            className={`rest-tab-btn ${activeTab === "reservations" ? "active" : ""}`}
            onClick={() => setActiveTab("reservations")}
          >
            <i className="fa-solid fa-calendar-check" /> Reservations ({stats.pending_reservations} pending)
          </button>
        </div>

        <div className="rest-stats-grid">
          <div className="rest-stat-card">
            <div className="rest-stat-icon-wrapper primary">
              <i className="fa-solid fa-wheat-awn" />
            </div>
            <div className="rest-stat-info">
              <h3>Total Food Items</h3>
              <p>{stats.total_food_items}</p>
            </div>
          </div>
          <div className="rest-stat-card">
            <div className="rest-stat-icon-wrapper danger">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>
            <div className="rest-stat-info">
              <h3>Low Stock Items</h3>
              <p>{stats.low_stock_count}</p>
            </div>
          </div>
          <div className="rest-stat-card">
            <div className="rest-stat-icon-wrapper warning">
              <i className="fa-solid fa-clock-rotate-left" />
            </div>
            <div className="rest-stat-info">
              <h3>Pending Restocks</h3>
              <p>{stats.pending_restock_count}</p>
            </div>
          </div>
          <div className="rest-stat-card">
            <div className="rest-stat-icon-wrapper success">
              <i className="fa-solid fa-utensils" />
            </div>
            <div className="rest-stat-info">
              <h3>Menu Items (Pub/VIP)</h3>
              <p>{stats.public_menu_count} / {stats.vip_menu_count}</p>
            </div>
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="rest-content-card">
            <div className="rest-card-header">
              <h2>Quick Status Overview</h2>
            </div>
            <div className="rest-stats-grid">
              <div className="rest-stat-card">
                <div className="rest-stat-icon-wrapper warning">
                  <i className="fa-solid fa-bell" />
                </div>
                <div className="rest-stat-info">
                  <h3>Pending Reservations</h3>
                  <p>{stats.pending_reservations}</p>
                </div>
              </div>
              <div className="rest-stat-card">
                <div className="rest-stat-icon-wrapper success">
                  <i className="fa-solid fa-calendar-check" />
                </div>
                <div className="rest-stat-info">
                  <h3>Approved Reservations</h3>
                  <p>{stats.approved_reservations}</p>
                </div>
              </div>
              <div className="rest-stat-card">
                <div className="rest-stat-icon-wrapper primary">
                  <i className="fa-solid fa-list-check" />
                </div>
                <div className="rest-stat-info">
                  <h3>Total Reservations</h3>
                  <p>{stats.total_reservations}</p>
                </div>
              </div>
            </div>
            <div style={{ marginTop: "24px" }}>
              <h3>Low Stock Alert List</h3>
              {lowStockItems.length === 0 ? (
                <div className="rest-empty-state">
                  <i className="fa-solid fa-square-check" />
                  All food stock levels are within normal parameters.
                </div>
              ) : (
                <div className="rest-table-wrapper">
                  <table className="rest-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Current Quantity</th>
                        <th>Minimum Stock</th>
                        <th>Unit</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockItems.map((item) => (
                        <tr key={item.item_id}>
                          <td><strong>{item.item_name}</strong></td>
                          <td>{item.category}</td>
                          <td><span className="rest-badge rest-badge-low">{item.quantity}</span></td>
                          <td>{item.minimum_stock}</td>
                          <td>{item.unit}</td>
                          <td>
                            <button className="rest-btn rest-btn-primary" onClick={() => openRestockModal(item)}>
                              Request Restock
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <>
            <div className="rest-content-card">
              <div className="rest-card-header">
                <h2>Food Inventory Directory</h2>
                <button className="rest-btn rest-btn-primary" onClick={() => openFoodModal(null)}>
                  <i className="fa-solid fa-plus" /> Add New Item
                </button>
              </div>

              {foodItems.length === 0 ? (
                <div className="rest-empty-state">
                  <i className="fa-solid fa-wheat-awn-slash" />
                  No food items in database inventory. Add some to get started.
                </div>
              ) : (
                <div className="rest-table-wrapper">
                  <table className="rest-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Minimum Stock</th>
                        <th>Status</th>
                        <th>Last Delivery</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foodItems.map((item) => {
                        const isLow = item.quantity <= item.minimum_stock;
                        return (
                          <tr key={item.item_id}>
                            <td><strong>{item.item_name}</strong></td>
                            <td>{item.category}</td>
                            <td>{item.quantity} {item.unit}</td>
                            <td>{item.minimum_stock} {item.unit}</td>
                            <td>
                              <span className={`rest-badge ${isLow ? "rest-badge-low" : "rest-badge-ok"}`}>
                                {isLow ? "Low Stock" : "In Stock"}
                              </span>
                            </td>
                            <td>{item.last_delivery_date || "N/A"}</td>
                            <td>
                              <div className="rest-actions-cell">
                                <button className="rest-btn rest-btn-secondary" onClick={() => openFoodModal(item)}>
                                  <i className="fa-solid fa-edit" /> Edit
                                </button>
                                <button className="rest-btn rest-btn-primary" onClick={() => openRestockModal(item)}>
                                  <i className="fa-solid fa-truck" /> Restock
                                </button>
                                <button className="rest-btn rest-btn-danger" onClick={() => handleFoodDelete(item.item_id)}>
                                  <i className="fa-solid fa-trash" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rest-content-card">
              <div className="rest-card-header">
                <h2>Restock Request History</h2>
              </div>
              {restockRequests.length === 0 ? (
                <div className="rest-empty-state">
                  No restock requests have been submitted.
                </div>
              ) : (
                <div className="rest-table-wrapper">
                  <table className="rest-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Requested Quantity</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Requested By</th>
                        <th>Requested At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restockRequests.map((req) => (
                        <tr key={req.request_id}>
                          <td><strong>{req.item_name}</strong></td>
                          <td>{req.requested_quantity}</td>
                          <td>{req.reason}</td>
                          <td>
                            <span className={`rest-badge rest-badge-${req.status.toLowerCase().replace(/\s+/g, "-")}`}>
                              {req.status === "Approved" ? "ACC" : (req.status === "Passed to Supplier" ? "Sent to Supplier" : req.status)}
                            </span>
                          </td>
                          <td>{req.requested_by_name}</td>
                          <td>{req.requested_at}</td>
                          <td>
                            {req.status === "Approved" && (
                              <button
                                className="rest-btn rest-btn-primary"
                                style={{ padding: "6px 12px", fontSize: "12px" }}
                                onClick={() => handleUpdateRestockStatus(req.request_id, "Passed to Supplier")}
                              >
                                <i className="fa-solid fa-paper-plane" /> Send to Supplier
                              </button>
                            )}
                            {req.status === "Passed to Supplier" && (
                              <span style={{ color: "#475569", fontSize: "13px", fontWeight: 600 }}>Waiting for Supplier...</span>
                            )}
                            {req.status === "Shipped" && (
                              <button
                                className="rest-btn rest-btn-success"
                                style={{ padding: "6px 12px", fontSize: "12px" }}
                                onClick={() => handleUpdateRestockStatus(req.request_id, "Delivered")}
                              >
                                <i className="fa-solid fa-circle-check" /> Confirm Delivery
                              </button>
                            )}
                            {req.status !== "Approved" && req.status !== "Passed to Supplier" && req.status !== "Shipped" && (
                              <span style={{ color: "#94a3b8", fontSize: "13px" }}>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {(activeTab === "public_menu" || activeTab === "vip_menu") && (
          <div className="rest-content-card">
            <div className="rest-card-header">
              <h2>{activeTab === "public_menu" ? "Public Restaurant Menu" : "VIP Restaurant Menu"}</h2>
              <button
                className="rest-btn rest-btn-primary"
                onClick={() => openMenuModal(null, activeTab === "public_menu" ? "Public" : "VIP")}
              >
                <i className="fa-solid fa-plus" /> Add Menu Item
              </button>
            </div>

            {((activeTab === "public_menu" ? publicMenu : vipMenu).length === 0) ? (
              <div className="rest-empty-state">
                <i className="fa-solid fa-utensils" />
                No menu items found in this menu.
              </div>
            ) : (
              <div className="rest-table-wrapper">
                <table className="rest-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Price</th>
                      <th>Availability</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTab === "public_menu" ? publicMenu : vipMenu).map((item) => (
                      <tr key={item.menu_item_id}>
                        <td><strong>{item.item_name}</strong></td>
                        <td>{item.category}</td>
                        <td>{item.description || "-"}</td>
                        <td>Rp {item.price.toLocaleString("id-ID")}</td>
                        <td>
                          <span className={`rest-badge ${item.is_available ? "rest-badge-ok" : "rest-badge-low"}`}>
                            {item.is_available ? "Available" : "Unavailable"}
                          </span>
                        </td>
                        <td>
                          <div className="rest-actions-cell">
                            <button
                              className="rest-btn rest-btn-secondary"
                              onClick={() => openMenuModal(item, activeTab === "public_menu" ? "Public" : "VIP")}
                            >
                              <i className="fa-solid fa-edit" /> Edit
                            </button>
                            <button className="rest-btn rest-btn-danger" onClick={() => handleMenuDelete(item.menu_item_id)}>
                              <i className="fa-solid fa-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "reservations" && (
          <div className="rest-content-card">
            <div className="rest-card-header">
              <h2>Dining Table Reservations</h2>
            </div>

            {reservations.length === 0 ? (
              <div className="rest-empty-state">
                <i className="fa-solid fa-calendar-xmark" />
                No restaurant reservations found.
              </div>
            ) : (
              <div className="rest-table-wrapper">
                <table className="rest-table">
                  <thead>
                    <tr>
                      <th>Passenger Name</th>
                      <th>Restaurant Name</th>
                      <th>Location / Deck</th>
                      <th>Tables</th>
                      <th>Date & Time</th>
                      <th>Dietary Requests</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((res) => {
                      const isPending = res.status.toLowerCase() === "pending";
                      return (
                        <tr key={res.booking_id}>
                          <td><strong>{res.passenger_name}</strong></td>
                          <td>{res.restaurant_name}</td>
                          <td>{res.location}</td>
                          <td>{res.tables.join(", ") || "-"}</td>
                          <td>{res.reservation_date} @ {res.reservation_time}</td>
                          <td>{res.dietary_request || "-"}</td>
                          <td>
                            <span className={`rest-badge rest-badge-${res.status.toLowerCase()}`}>
                              {res.status}
                            </span>
                          </td>
                          <td>
                            {isPending ? (
                              <div className="rest-actions-cell">
                                <button className="rest-btn rest-btn-success" onClick={() => handleApproveReservation(res.booking_id)}>
                                  Approve
                                </button>
                                <button className="rest-btn rest-btn-danger" onClick={() => handleRejectReservation(res.booking_id)}>
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: "13px" }}>Processed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {foodModalOpen && (
          <div className="rest-form-overlay" onClick={() => setFoodModalOpen(false)}>
            <div className="rest-form-card" onClick={(e) => e.stopPropagation()}>
              <h3>{selectedFood ? "Edit Food Inventory Item" : "Add New Food Inventory Item"}</h3>
              <form onSubmit={handleFoodSubmit}>
                <div className="rest-form-group">
                  <label>Item Name</label>
                  <input
                    type="text"
                    className="rest-form-control"
                    value={foodName}
                    onChange={(e) => setFoodName(e.target.value)}
                    required
                  />
                </div>
                <div className="rest-form-group">
                  <label>Category</label>
                  <select
                    className="rest-form-control"
                    value={foodCategory}
                    onChange={(e) => setFoodCategory(e.target.value)}
                  >
                    <option value="Ingredients">Ingredients</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Meat & Poultry">Meat & Poultry</option>
                    <option value="Seafood">Seafood</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Spices">Spices</option>
                  </select>
                </div>
                <div className="rest-form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    step="any"
                    className="rest-form-control"
                    value={foodQty}
                    onChange={(e) => setFoodQty(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="rest-form-group">
                  <label>Unit</label>
                  <input
                    type="text"
                    className="rest-form-control"
                    value={foodUnit}
                    onChange={(e) => setFoodUnit(e.target.value)}
                    placeholder="e.g. kg, pcs, liters"
                    required
                  />
                </div>
                <div className="rest-form-group">
                  <label>Minimum Stock Level</label>
                  <input
                    type="number"
                    step="any"
                    className="rest-form-control"
                    value={foodMinStock}
                    onChange={(e) => setFoodMinStock(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="rest-form-actions">
                  <button type="button" className="rest-btn rest-btn-secondary" onClick={() => setFoodModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="rest-btn rest-btn-primary">
                    {selectedFood ? "Save Changes" : "Create Item"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {restockModalOpen && restockItem && (
          <div className="rest-form-overlay" onClick={() => setRestockModalOpen(false)}>
            <div className="rest-form-card" onClick={(e) => e.stopPropagation()}>
              <h3>Submit Restock Request</h3>
              <p style={{ margin: "-10px 0 20px 0", fontSize: "14px", color: "#64748b" }}>
                Item: <strong>{restockItem.item_name}</strong> (Current: {restockItem.quantity} {restockItem.unit} / Min: {restockItem.minimum_stock} {restockItem.unit})
              </p>
              <form onSubmit={handleRestockSubmit}>
                <div className="rest-form-group">
                  <label>Requested Quantity ({restockItem.unit})</label>
                  <input
                    type="number"
                    step="any"
                    className="rest-form-control"
                    value={restockQty}
                    onChange={(e) => setRestockQty(Number(e.target.value))}
                    min="0.1"
                    required
                  />
                </div>
                <div className="rest-form-group">
                  <label>Reason for Request</label>
                  <textarea
                    className="rest-form-control"
                    style={{ height: "80px", resize: "none" }}
                    value={restockReason}
                    onChange={(e) => setRestockReason(e.target.value)}
                    placeholder="Provide details about restock necessity (e.g. low stock, prep for dinner service)"
                    required
                  />
                </div>
                <div className="rest-form-actions">
                  <button type="button" className="rest-btn rest-btn-secondary" onClick={() => setRestockModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="rest-btn rest-btn-primary">
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {menuModalOpen && (
          <div className="rest-form-overlay" onClick={() => setMenuModalOpen(false)}>
            <div className="rest-form-card" onClick={(e) => e.stopPropagation()}>
              <h3>{selectedMenuItem ? "Edit Menu Item" : `Add New ${menuType} Menu Item`}</h3>
              <form onSubmit={handleMenuSubmit}>
                <div className="rest-form-group">
                  <label>Item Name</label>
                  <input
                    type="text"
                    className="rest-form-control"
                    value={menuItemName}
                    onChange={(e) => setMenuItemName(e.target.value)}
                    required
                  />
                </div>
                <div className="rest-form-group">
                  <label>Category</label>
                  <select
                    className="rest-form-control"
                    value={menuItemCategory}
                    onChange={(e) => setMenuItemCategory(e.target.value)}
                  >
                    <option value="Appetizer">Appetizer</option>
                    <option value="Main Course">Main Course</option>
                    <option value="Dessert">Dessert</option>
                    <option value="Beverage">Beverage</option>
                    <option value="Wine & Spirits">Wine & Spirits</option>
                  </select>
                </div>
                <div className="rest-form-group">
                  <label>Price (Rp)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="rest-form-control"
                    value={menuItemPrice}
                    onChange={(e) => setMenuItemPrice(Number(e.target.value))}
                    min="0"
                    required
                  />
                </div>
                <div className="rest-form-group">
                  <label>Description</label>
                  <textarea
                    className="rest-form-control"
                    style={{ height: "80px", resize: "none" }}
                    value={menuItemDesc}
                    onChange={(e) => setMenuItemDesc(e.target.value)}
                  />
                </div>
                {selectedMenuItem && (
                  <div className="rest-form-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      id="menuItemAvailable"
                      checked={menuItemAvailable}
                      onChange={(e) => setMenuItemAvailable(e.target.checked)}
                    />
                    <label htmlFor="menuItemAvailable" style={{ margin: 0, cursor: "pointer" }}>Item Available in Menu</label>
                  </div>
                )}
                <div className="rest-form-actions">
                  <button type="button" className="rest-btn rest-btn-secondary" onClick={() => setMenuModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="rest-btn rest-btn-primary">
                    {selectedMenuItem ? "Save Changes" : "Create Item"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <LoadingScreen visible={loading} />
    </Dashboard>
  );
}
