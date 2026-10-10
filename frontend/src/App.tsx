import { Routes, Route, Navigate } from "react-router-dom";
import { useAppContext } from "./context/AppContext";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import DashboardScreen from "./screens/DashboardScreen";
import CarePlanScreen from "./screens/CarePlanScreen";
import WellbeingScreen from "./screens/WellbeingScreen";
import SyncScreen from "./screens/SyncScreen";
import AlertsScreen from "./screens/AlertsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import StaffProfileScreen from "./screens/StaffProfileScreen";
import AttendanceScreen from "./screens/AttendanceScreen";
import ChatScreen from "./screens/ChatScreen";
import SearchScreen from "./screens/SearchScreen";
import BottomNav from "./components/BottomNav";

// A wrapper that redirects to "/" if the user is not logged in
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAppContext();
  if (!isLoggedIn) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// A wrapper that redirects to "/dashboard" if the user IS logged in
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAppContext();
  if (isLoggedIn) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isLoggedIn } = useAppContext();

  return (
    <div className={`min-h-screen bg-gray-100 ${isLoggedIn ? "pb-20" : ""}`}>
      <Routes>
        <Route
          path="/"
          element={
            <RedirectIfAuth>
              <LoginScreen />
            </RedirectIfAuth>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuth>
              <LoginScreen />
            </RedirectIfAuth>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectIfAuth>
              <SignupScreen />
            </RedirectIfAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/care-plan"
          element={
            <RequireAuth>
              <CarePlanScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/wellbeing"
          element={
            <RequireAuth>
              <WellbeingScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/sync"
          element={
            <RequireAuth>
              <SyncScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/search"
          element={
            <RequireAuth>
              <SearchScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/alerts"
          element={
            <RequireAuth>
              <AlertsScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfileScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/staff/:id"
          element={
            <RequireAuth>
              <StaffProfileScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/staff/:id/attendance"
          element={
            <RequireAuth>
              <AttendanceScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/chat/:id"
          element={
            <RequireAuth>
              <ChatScreen />
            </RequireAuth>
          }
        />
      </Routes>
      {isLoggedIn && <BottomNav />}
    </div>
  );
}
