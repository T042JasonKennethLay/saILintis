# saILintis
SaiLintis - Cruise ship management desktop app built with Tauri 2, React 19 + TypeScript, and Rust (SeaORM + PostgreSQL, Redis). Role-based dashboards for passengers, HR, finance, medical, security, engineering, housekeeping, restaurant, IT, and voyage ops. Includes UML diagrams (use case, activity, sequence, class)

# 🚢 SaiLintis — Cruise Ship Management System

SaiLintis is a desktop app for running a cruise ship's operations. Each crew
role and each passenger gets its own dashboard. It is built with **Tauri 2**:
a **React + TypeScript** frontend and a **Rust** backend on **PostgreSQL**.

## ✨ Features
- **Authentication**: login/register with JWT, bcrypt password hashing, and role-based access
- **Passenger portal**: cabin info, activities, restaurant reservations, performance and travel booking, spending tracker, chat, notifications
- **HR**: post job vacancies and screen applicants
- **Finance**: crew payroll by rank and contract type, passenger refund approval, restock requests
- **Medical**: incident logging and medical cl
- **Security**: incident reports, zone-specific security alerts, captain's review of overnight incidents
- **Engineering, Housekeeping (linen stock trak, IT, Supplier, Operations Manager, Voyage /Cruise Director** dashboards
- Email notifications (SMTP), PDF generation,

## 🛠 Tech Stack
| Layer    | Tech |
|----------|------|
| Frontend | React 19, TypeScript, Vite, React Router, Anime.js, Font Awesome |
| Desktop  | Tauri 2 |
| Backend  | Rust, SeaORM (sqlx-postgres), Tokio |
| Data     | PostgreSQL, Redis |
| Other    | jsonwebtoken, bcrypt, lettre (SMTP), printpdf |
| Design patterns | Observer (ship announcemen

## 📐 Diagrams
The `Diagram/` folder holds the analysis and design docs, made in Visual Paradigm:
use case descriptions (Satzinger format), actiams, and the class diagram.
# create a .env file with: DATABASE_URL, REDIS SMTP_PASSWORD
npm run tauri dev

Prerequisites: Node.js, Rust toolchain, PostgreSQL, Redis
