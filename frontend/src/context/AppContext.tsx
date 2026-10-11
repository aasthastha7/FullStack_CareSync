import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  apiLogin, apiSignup, apiGetProfile,
  getStoredToken, storeToken, storeUser, clearStoredToken, getStoredUser,
} from "../lib/api";

// ---------- types ----------

interface AppState {
  // login / signup
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    full_name: string,
    role: string,
    employee_id: string,
  ) => Promise<void>;
  loginError: string | null;
  clearAndLogout: () => void;
  userName: string;

  // staff edits
  staffEdits: Record<string, { email?: string; phone?: string }>;
  updateStaffDetails: (id: string, email: string, phone: string) => void;
}

// ---------- context ----------

const AppContext = createContext<AppState | null>(null);

export function useAppContext(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppProvider");
  return ctx;
}

// ---------- provider ----------

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getStoredToken());
  const [userName, setUserName] = useState(() => getStoredUser()?.full_name ?? "");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [staffEdits, setStaffEdits] = useState<Record<string, { email?: string; phone?: string }>>({});

  // Auto-login: validate stored token on mount
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    apiGetProfile()
      .then((p) => {
        setIsLoggedIn(true);
        setUserName(p.full_name ?? "");
        storeUser({ id: p.id, email: p.email ?? "", full_name: p.full_name ?? "" });
      })
      .catch(() => {
        clearStoredToken();
        setIsLoggedIn(false);
      });
  }, []);

  async function login(email: string, password: string) {
    setLoginError(null);
    try {
      const data = await apiLogin(email, password);
      storeToken(data.access_token);
      storeUser(data.user);
      setIsLoggedIn(true);
      setUserName(data.user.full_name ?? "");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setLoginError(message);
      throw err;
    }
  }

  /**
   * Register a new account, then automatically log in.
   * Throws on failure so the caller can show inline errors.
   */
  async function signup(
    email: string,
    password: string,
    full_name: string,
    role: string,
    employee_id: string,
  ) {
    setLoginError(null);
    // 1. Create the account
    await apiSignup(email, password, full_name, role, employee_id);
    // 2. Auto-login with the same credentials
    const data = await apiLogin(email, password);
    storeToken(data.access_token);
    storeUser(data.user);
    setIsLoggedIn(true);
    setUserName(data.user.full_name ?? "");
  }

  function updateStaffDetails(id: string, email: string, phone: string) {
    setStaffEdits((prev) => ({ ...prev, [id]: { email, phone } }));
  }

  function clearAndLogout() {
    clearStoredToken();
    setIsLoggedIn(false);
    setUserName("");
    setLoginError(null);
    setStaffEdits({});
  }

  return (
    <AppContext.Provider
      value={{
        isLoggedIn, login, signup, loginError, clearAndLogout, userName,
        staffEdits, updateStaffDetails,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}