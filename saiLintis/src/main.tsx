import React from "react";
import ReactDOM from "react-dom/client";
import{
    BrowserRouter,Routes,Route
}from "react-router-dom"
import { LoginPage } from "./Page/authentication/LoginPage";
import { RegisterPage } from "./Page/authentication/Register";
import { HomePage } from "./Page/pages/HomePage";
import { ProfilePage } from "./Page/pages/ProfilePage";
import { SettingsPage } from "./Page/pages/SettingsPage";
import { ItDashboard } from "./Page/pages/it/ItDashboard";
import { PageTransition } from "./Page/PageTransition";
import { ReviewIncidentReports } from "./Page/pages/security/ReviewIncidentReports";
import { SecurityIncidentReport } from "./Page/pages/security/SecurityIncidentReport";
import { MedicalIncidentLogging } from "./Page/pages/medical/MedicalIncidentLogging";
import { MedicalClearancePage } from "./Page/pages/medical/MedicalClearancePage";
import { HrDashboard } from "./Page/pages/hr/HrDashboard";
import { GuestDashboard } from "./Page/pages/guest/GuestDashboard";
import { HousekeepingDashboard } from "./Page/pages/housekeeping/HousekeepingDashboard";
import { ZoneSecurityAlerts } from "./Page/pages/security/ZoneSecurityAlerts";
import { PayrollPage } from "./Page/pages/finance/PayrollPage";
import { RefundPage } from "./Page/pages/finance/RefundPage";
import { RestockPage } from "./Page/pages/finance/RestockPage";
import { FdoDashboard } from "./Page/pages/fdo/FdoDashboard";
import { EngineeringDashboard } from "./Page/pages/engineering/EngineeringDashboard";
import { VoyageDashboard } from "./Page/pages/voyage/VoyageDashboard";
import { RestaurantDashboard } from "./Page/pages/restaurant/RestaurantDashboard";
import { SupplierDashboard } from "./Page/pages/supplier/SupplierDashboard";
import { OpmDashboard } from "./Page/pages/opm/OpmDashboard";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<LoginPage/>}></Route>
            <Route path="/login" element={
                <PageTransition>
                    <LoginPage />
                </PageTransition>
            }/>
            <Route path="/register" element={
                <PageTransition>
                    <RegisterPage />
                </PageTransition>
            }/>
            <Route path="/home" element={
                <PageTransition>
                    <HomePage />
                </PageTransition>
            }/>
            <Route path="/profile" element={
                <PageTransition>
                    <ProfilePage />
                </PageTransition>
            }/>
            <Route path="/settings" element={
                <PageTransition>
                    <SettingsPage />
                </PageTransition>
            }/>
            <Route path="/it-dashboard" element={
                <PageTransition>
                    <ItDashboard />
                </PageTransition>
            }/>
            <Route path="/review-incidents" element={
                <PageTransition>
                    <ReviewIncidentReports />
                </PageTransition>
            }/>
            <Route path="/security-report" element={
                <PageTransition>
                    <SecurityIncidentReport />
                </PageTransition>
            }/>
            <Route path="/medical-report" element={
                <PageTransition>
                    <MedicalIncidentLogging />
                </PageTransition>
            }/>
            <Route path="/medical-clearance" element={
                <PageTransition>
                    <MedicalClearancePage />
                </PageTransition>
            }/>
            <Route path="/hr-dashboard" element={
                <PageTransition>
                    <HrDashboard />
                </PageTransition>
            }/>
            <Route path="/guest-dashboard" element={
                <PageTransition>
                    <GuestDashboard />
                </PageTransition>
            }/>
            <Route path="/housekeeping-dashboard" element={
                <PageTransition>
                    <HousekeepingDashboard />
                </PageTransition>
            }/>
            <Route path="/zone-alerts" element={
                <PageTransition>
                    <ZoneSecurityAlerts />
                </PageTransition>
            }/>
            <Route path="/payroll" element={
                <PageTransition>
                    <PayrollPage />
                </PageTransition>
            }/>
            <Route path="/refunds" element={
                <PageTransition>
                    <RefundPage />
                </PageTransition>
            }/>
            <Route path="/restocks" element={
                <PageTransition>
                    <RestockPage />
                </PageTransition>
            }/>
            <Route path="/fdo-dashboard" element={
                <PageTransition>
                    <FdoDashboard />
                </PageTransition>
            }/>
            <Route path="/engineering-dashboard" element={
                <PageTransition>
                    <EngineeringDashboard />
                </PageTransition>
            }/>
            <Route path="/voyages" element={
                <PageTransition>
                    <VoyageDashboard />
                </PageTransition>
            }/>
            <Route path="/restaurant-dashboard" element={
                <PageTransition>
                    <RestaurantDashboard />
                </PageTransition>
            }/>
            <Route path="/supplier-dashboard" element={
                <PageTransition>
                    <SupplierDashboard />
                </PageTransition>
            }/>
            <Route path="/opm-dashboard" element={
                <PageTransition>
                    <OpmDashboard />
                </PageTransition>
            }/>
        </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

