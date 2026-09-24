use sea_orm::*;
use uuid::Uuid;
use crate::restaurant::restaurant_model::restaurant_model::*;

pub struct RestaurantRepository;

impl RestaurantRepository {
    pub async fn get_food_inventory(pool: &DatabaseConnection) -> Result<Vec<FoodInventoryResponse>, String> {
        let stmt = Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT item_id, item_name, category, quantity, unit, minimum_stock,
                   last_delivery_date::TEXT, created_at::TEXT, updated_at::TEXT
            FROM food_inventory
            ORDER BY category ASC, item_name ASC
            "#.to_string(),
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut items = Vec::new();
        for r in rows {
            items.push(FoodInventoryResponse {
                item_id: r.try_get("", "item_id").map_err(|e| e.to_string())?,
                item_name: r.try_get("", "item_name").map_err(|e| e.to_string())?,
                category: r.try_get("", "category").map_err(|e| e.to_string())?,
                quantity: r.try_get("", "quantity").map_err(|e| e.to_string())?,
                unit: r.try_get("", "unit").map_err(|e| e.to_string())?,
                minimum_stock: r.try_get("", "minimum_stock").map_err(|e| e.to_string())?,
                last_delivery_date: r.try_get("", "last_delivery_date").ok(),
                created_at: r.try_get("", "created_at").map_err(|e| e.to_string())?,
                updated_at: r.try_get("", "updated_at").map_err(|e| e.to_string())?,
            });
        }
        Ok(items)
    }

    pub async fn create_food_item(
        pool: &DatabaseConnection,
        item_name: &str,
        category: &str,
        quantity: f64,
        unit: &str,
        minimum_stock: f64,
    ) -> Result<Uuid, String> {
        let id = Uuid::new_v4();
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO food_inventory (item_id, item_name, category, quantity, unit, minimum_stock, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            "#,
            vec![id.into(), item_name.into(), category.into(), quantity.into(), unit.into(), minimum_stock.into()],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(id)
    }

    pub async fn update_food_item(
        pool: &DatabaseConnection,
        item_id: Uuid,
        item_name: &str,
        category: &str,
        quantity: f64,
        unit: &str,
        minimum_stock: f64,
    ) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            UPDATE food_inventory
            SET item_name = $2, category = $3, quantity = $4, unit = $5, minimum_stock = $6, updated_at = NOW()
            WHERE item_id = $1
            "#,
            vec![item_id.into(), item_name.into(), category.into(), quantity.into(), unit.into(), minimum_stock.into()],
        );
        let res = pool.execute(stmt).await.map_err(|e| e.to_string())?;
        if res.rows_affected() == 0 {
            return Err("Food item not found".to_string());
        }
        Ok(())
    }

    pub async fn delete_food_item(pool: &DatabaseConnection, item_id: Uuid) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "DELETE FROM food_inventory WHERE item_id = $1",
            vec![item_id.into()],
        );
        let res = pool.execute(stmt).await.map_err(|e| e.to_string())?;
        if res.rows_affected() == 0 {
            return Err("Food item not found".to_string());
        }
        Ok(())
    }

    pub async fn submit_restock_request(
        pool: &DatabaseConnection,
        item_id: Uuid,
        requested_quantity: f64,
        reason: &str,
        requested_by: Uuid,
    ) -> Result<Uuid, String> {
        let id = Uuid::new_v4();
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO restock_requests (request_id, item_id, requested_quantity, reason, status, requested_by, requested_at)
            VALUES ($1, $2, $3, $4, 'Pending', $5, NOW())
            "#,
            vec![id.into(), item_id.into(), requested_quantity.into(), reason.into(), requested_by.into()],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(id)
    }

    pub async fn get_restock_requests(pool: &DatabaseConnection) -> Result<Vec<RestockRequestResponse>, String> {
        let stmt = Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT rr.request_id, rr.item_id, fi.item_name, rr.requested_quantity,
                   rr.reason, rr.status, rr.requested_by,
                   COALESCE(u.display_name, 'Unknown') AS requested_by_name,
                   rr.requested_at::TEXT
            FROM restock_requests rr
            JOIN food_inventory fi ON rr.item_id = fi.item_id
            LEFT JOIN users u ON rr.requested_by = u.user_id
            ORDER BY rr.requested_at DESC
            "#.to_string(),
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut items = Vec::new();
        for r in rows {
            items.push(RestockRequestResponse {
                request_id: r.try_get("", "request_id").map_err(|e| e.to_string())?,
                item_id: r.try_get("", "item_id").map_err(|e| e.to_string())?,
                item_name: r.try_get("", "item_name").map_err(|e| e.to_string())?,
                requested_quantity: r.try_get("", "requested_quantity").map_err(|e| e.to_string())?,
                reason: r.try_get("", "reason").map_err(|e| e.to_string())?,
                status: r.try_get("", "status").map_err(|e| e.to_string())?,
                requested_by: r.try_get("", "requested_by").map_err(|e| e.to_string())?,
                requested_by_name: r.try_get("", "requested_by_name").map_err(|e| e.to_string())?,
                requested_at: r.try_get("", "requested_at").map_err(|e| e.to_string())?,
            });
        }
        Ok(items)
    }

    pub async fn get_menu_items(pool: &DatabaseConnection, menu_type: &str) -> Result<Vec<MenuItemResponse>, String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT mi.menu_item_id, mi.restaurant_id, rs.restaurant_name, mi.item_name,
                   mi.description, mi.price, mi.category, mi.is_available, mi.created_at::TEXT
            FROM menu_items mi
            JOIN restaurants rs ON mi.restaurant_id = rs.restaurant_id
            WHERE rs.menu_type = $1
            ORDER BY mi.category ASC, mi.item_name ASC
            "#,
            vec![menu_type.into()],
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut items = Vec::new();
        for r in rows {
            items.push(MenuItemResponse {
                menu_item_id: r.try_get("", "menu_item_id").map_err(|e| e.to_string())?,
                restaurant_id: r.try_get("", "restaurant_id").map_err(|e| e.to_string())?,
                restaurant_name: r.try_get("", "restaurant_name").map_err(|e| e.to_string())?,
                item_name: r.try_get("", "item_name").map_err(|e| e.to_string())?,
                description: r.try_get("", "description").ok(),
                price: r.try_get("", "price").map_err(|e| e.to_string())?,
                category: r.try_get("", "category").map_err(|e| e.to_string())?,
                is_available: r.try_get("", "is_available").map_err(|e| e.to_string())?,
                created_at: r.try_get("", "created_at").map_err(|e| e.to_string())?,
            });
        }
        Ok(items)
    }

    pub async fn create_menu_item(
        pool: &DatabaseConnection,
        menu_type: &str,
        item_name: &str,
        description: &str,
        price: f64,
        category: &str,
    ) -> Result<Uuid, String> {
        let id = Uuid::new_v4();
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO menu_items (menu_item_id, restaurant_id, item_name, description, price, category, is_available, created_at)
            SELECT $1, rs.restaurant_id, $3, $4, $5, $6, true, NOW()
            FROM restaurants rs WHERE rs.menu_type = $2
            "#,
            vec![id.into(), menu_type.into(), item_name.into(), description.into(), price.into(), category.into()],
        );
        pool.execute(stmt).await.map_err(|e| e.to_string())?;
        Ok(id)
    }

    pub async fn update_menu_item(
        pool: &DatabaseConnection,
        menu_item_id: Uuid,
        item_name: &str,
        description: &str,
        price: f64,
        category: &str,
        is_available: bool,
    ) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            UPDATE menu_items
            SET item_name = $2, description = $3, price = $4, category = $5, is_available = $6
            WHERE menu_item_id = $1
            "#,
            vec![menu_item_id.into(), item_name.into(), description.into(), price.into(), category.into(), is_available.into()],
        );
        let res = pool.execute(stmt).await.map_err(|e| e.to_string())?;
        if res.rows_affected() == 0 {
            return Err("Menu item not found".to_string());
        }
        Ok(())
    }

    pub async fn delete_menu_item(pool: &DatabaseConnection, menu_item_id: Uuid) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "DELETE FROM menu_items WHERE menu_item_id = $1",
            vec![menu_item_id.into()],
        );
        let res = pool.execute(stmt).await.map_err(|e| e.to_string())?;
        if res.rows_affected() == 0 {
            return Err("Menu item not found".to_string());
        }
        Ok(())
    }

    pub async fn get_reservations(pool: &DatabaseConnection) -> Result<Vec<ReservationResponse>, String> {
        let stmt = Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT rr.booking_id, b.passenger_id,
                   COALESCE(p.display_name, u.display_name, 'Unknown') AS passenger_name,
                   rs.restaurant_name,
                   COALESCE(rr.tables, ARRAY[]::TEXT[]) AS tables,
                   rr.reservation_date::TEXT,
                   rr.reservation_time::TEXT,
                   rr.location,
                   rr.dietary_request,
                   b.status
            FROM restaurant_reservations rr
            JOIN bookings b ON rr.booking_id = b.booking_id
            LEFT JOIN restaurants rs ON rr.restaurant_id = rs.restaurant_id
            LEFT JOIN passengers p ON b.passenger_id = p.passenger_id
            LEFT JOIN users u ON b.passenger_id = u.user_id
            ORDER BY rr.reservation_date DESC, rr.reservation_time DESC
            "#.to_string(),
        );
        let rows = pool.query_all(stmt).await.map_err(|e| e.to_string())?;
        let mut items = Vec::new();
        for r in rows {
            let tables_arr: Vec<String> = r.try_get("", "tables").unwrap_or_default();
            items.push(ReservationResponse {
                booking_id: r.try_get("", "booking_id").map_err(|e| e.to_string())?,
                passenger_id: r.try_get("", "passenger_id").ok(),
                passenger_name: r.try_get("", "passenger_name").unwrap_or_else(|_| "Unknown".to_string()),
                restaurant_name: r.try_get("", "restaurant_name").unwrap_or_else(|_| "Unknown".to_string()),
                tables: tables_arr,
                reservation_date: r.try_get("", "reservation_date").map_err(|e| e.to_string())?,
                reservation_time: r.try_get("", "reservation_time").map_err(|e| e.to_string())?,
                location: r.try_get("", "location").map_err(|e| e.to_string())?,
                dietary_request: r.try_get("", "dietary_request").ok(),
                status: r.try_get("", "status").map_err(|e| e.to_string())?,
            });
        }
        Ok(items)
    }

    pub async fn approve_reservation(pool: &DatabaseConnection, booking_id: Uuid) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE bookings SET status = 'Approved' WHERE booking_id = $1 AND status = 'Pending'",
            vec![booking_id.into()],
        );
        let res = pool.execute(stmt).await.map_err(|e| e.to_string())?;
        if res.rows_affected() == 0 {
            return Err("Reservation not found or already processed".to_string());
        }

        let tables_stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT rr.tables, rr.restaurant_id
            FROM restaurant_reservations rr
            WHERE rr.booking_id = $1
            "#,
            vec![booking_id.into()],
        );
        if let Some(row) = pool.query_one(tables_stmt).await.map_err(|e| e.to_string())? {
            let tables: Vec<String> = row.try_get("", "tables").unwrap_or_default();
            let restaurant_id: Option<Uuid> = row.try_get("", "restaurant_id").ok();
            if let Some(rid) = restaurant_id {
                for t in &tables {
                    let upd = Statement::from_sql_and_values(
                        DatabaseBackend::Postgres,
                        "UPDATE dining_tables SET status = 'Booked' WHERE restaurant_id = $1 AND table_number = $2",
                        vec![rid.into(), t.clone().into()],
                    );
                    pool.execute(upd).await.ok();
                }
            }
        }
        Ok(())
    }

    pub async fn reject_reservation(pool: &DatabaseConnection, booking_id: Uuid) -> Result<(), String> {
        let tables_stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT rr.tables, rr.restaurant_id
            FROM restaurant_reservations rr
            WHERE rr.booking_id = $1
            "#,
            vec![booking_id.into()],
        );
        if let Some(row) = pool.query_one(tables_stmt).await.map_err(|e| e.to_string())? {
            let tables: Vec<String> = row.try_get("", "tables").unwrap_or_default();
            let restaurant_id: Option<Uuid> = row.try_get("", "restaurant_id").ok();
            if let Some(rid) = restaurant_id {
                for t in &tables {
                    let upd = Statement::from_sql_and_values(
                        DatabaseBackend::Postgres,
                        "UPDATE dining_tables SET status = 'Available' WHERE restaurant_id = $1 AND table_number = $2",
                        vec![rid.into(), t.clone().into()],
                    );
                    pool.execute(upd).await.ok();
                }
            }
        }

        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE bookings SET status = 'Rejected' WHERE booking_id = $1 AND status = 'Pending'",
            vec![booking_id.into()],
        );
        let res = pool.execute(stmt).await.map_err(|e| e.to_string())?;
        if res.rows_affected() == 0 {
            return Err("Reservation not found or already processed".to_string());
        }
        Ok(())
    }

    pub async fn get_overview_stats(pool: &DatabaseConnection) -> Result<RestaurantOverviewResponse, String> {
        let stmt = Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                (SELECT COUNT(*) FROM food_inventory)::BIGINT AS total_food_items,
                (SELECT COUNT(*) FROM food_inventory WHERE quantity <= minimum_stock)::BIGINT AS low_stock_count,
                (SELECT COUNT(*) FROM restock_requests WHERE status = 'Pending')::BIGINT AS pending_restock_count,
                (SELECT COUNT(*) FROM menu_items mi JOIN restaurants rs ON mi.restaurant_id = rs.restaurant_id WHERE rs.menu_type = 'Public')::BIGINT AS public_menu_count,
                (SELECT COUNT(*) FROM menu_items mi JOIN restaurants rs ON mi.restaurant_id = rs.restaurant_id WHERE rs.menu_type = 'VIP')::BIGINT AS vip_menu_count,
                (SELECT COUNT(*) FROM bookings b JOIN restaurant_reservations rr ON b.booking_id = rr.booking_id WHERE b.status = 'Pending')::BIGINT AS pending_reservations,
                (SELECT COUNT(*) FROM bookings b JOIN restaurant_reservations rr ON b.booking_id = rr.booking_id WHERE b.status = 'Approved')::BIGINT AS approved_reservations,
                (SELECT COUNT(*) FROM bookings b JOIN restaurant_reservations rr ON b.booking_id = rr.booking_id)::BIGINT AS total_reservations
            "#.to_string(),
        );
        let row = pool.query_one(stmt).await.map_err(|e| e.to_string())?
            .ok_or_else(|| "Failed to get overview stats".to_string())?;
        Ok(RestaurantOverviewResponse {
            total_food_items: row.try_get("", "total_food_items").unwrap_or(0),
            low_stock_count: row.try_get("", "low_stock_count").unwrap_or(0),
            pending_restock_count: row.try_get("", "pending_restock_count").unwrap_or(0),
            public_menu_count: row.try_get("", "public_menu_count").unwrap_or(0),
            vip_menu_count: row.try_get("", "vip_menu_count").unwrap_or(0),
            pending_reservations: row.try_get("", "pending_reservations").unwrap_or(0),
            approved_reservations: row.try_get("", "approved_reservations").unwrap_or(0),
            total_reservations: row.try_get("", "total_reservations").unwrap_or(0),
        })
    }

    pub async fn update_restock_request_status(
        pool: &DatabaseConnection,
        request_id: Uuid,
        new_status: &str,
    ) -> Result<(), String> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE restock_requests SET status = $2 WHERE request_id = $1",
            vec![request_id.into(), new_status.into()],
        );
        let res = pool.execute(stmt).await.map_err(|e| e.to_string())?;
        if res.rows_affected() == 0 {
            return Err("Restock request not found".to_string());
        }

        if new_status == "Delivered" {
            let find_stmt = Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT item_id, requested_quantity FROM restock_requests WHERE request_id = $1",
                vec![request_id.into()],
            );
            if let Some(row) = pool.query_one(find_stmt).await.map_err(|e| e.to_string())? {
                let item_id: Uuid = row.try_get("", "item_id").map_err(|e| e.to_string())?;
                let requested_quantity: f64 = row.try_get("", "requested_quantity").map_err(|e| e.to_string())?;

                let update_inv_stmt = Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "UPDATE food_inventory SET quantity = quantity + $2, last_delivery_date = NOW(), updated_at = NOW() WHERE item_id = $1",
                    vec![item_id.into(), requested_quantity.into()],
                );
                pool.execute(update_inv_stmt).await.map_err(|e| e.to_string())?;
            }
        }

        Ok(())
    }
}
