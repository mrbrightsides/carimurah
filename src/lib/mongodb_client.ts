import { UserProfile, HistoryItem } from '../types';

// This client handles Custom MongoDB Atlas Authentication & Data Proxying
// This ensures all authentication resides directly inside our MongoDB clusters.

type AuthCallback = (user: any | null) => void;
const authCallbacks: AuthCallback[] = [];
let currentUser: any | null = null;

// Load Active Session from localStorage on startup
if (typeof window !== "undefined") {
  const savedUser = localStorage.getItem("carimurah_mongo_user");
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
    } catch (e) {
      currentUser = null;
    }
  }
}

export const onAuthStateChanged = (arg1: any, arg2?: any) => {
  const callback = typeof arg1 === "function" ? arg1 : arg2;
  authCallbacks.push(callback);
  // Instantly invoke with the current state to simulate real auth lifecycle
  if (callback) {
    callback(currentUser);
  }
  return () => {
    const idx = authCallbacks.indexOf(callback);
    if (idx !== -1) {
      authCallbacks.splice(idx, 1);
    }
  };
};

export const triggerAuthStateChange = (user: any | null) => {
  currentUser = user;
  if (user) {
    localStorage.setItem("carimurah_mongo_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("carimurah_mongo_user");
    localStorage.removeItem("carimurah_mongo_token");
  }
  authCallbacks.forEach(cb => {
    try { cb(user); } catch(err) { console.error("Error in auth state listener:", err); }
  });
};

// Register customer direct to MongoDB Atlas
export const register = async (email: string, password: string, displayName: string): Promise<any> => {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Gagal membuat akun.");
  }
  const data = await res.json();
  if (data.success) {
    localStorage.setItem("carimurah_mongo_token", data.token);
    triggerAuthStateChange(data.user);
    return data.user;
  }
  throw new Error("Server mengirimkan data tidak valid.");
};

// Login user direct to MongoDB Atlas
export const login = async (email: string, password: string): Promise<any> => {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Gagal masuk.");
  }
  const data = await res.json();
  if (data.success) {
    localStorage.setItem("carimurah_mongo_token", data.token);
    triggerAuthStateChange(data.user);
    return data.user;
  }
  throw new Error("Server mengirimkan data tidak valid.");
};

// Simulating Google Auth via pure MongoDB accounts
export const loginWithGoogle = async () => {
  const demoEmail = "khudri@binadarma.ac.id";
  const demoName = "Khudri";
  try {
    return await register(demoEmail, "KhudriPassSecretAtlas", demoName);
  } catch (e) {
    // If user already exists, trigger normal login
    return await login(demoEmail, "KhudriPassSecretAtlas");
  }
};

// Logout Active Session on Mongo
export const logout = async () => {
  triggerAuthStateChange(null);
};

// Minimal mock compatibility wrapper to support legacy calls without breaking TypeScript
export const auth = {
  currentUser: null
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const res = await fetch(`/api/profile/${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("MongoDB Client Error (getUserProfile):", error);
    return null;
  }
};

export const updateProfile = async (userId: string, data: Partial<UserProfile>): Promise<void> => {
  try {
    await fetch(`/api/profile/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error("MongoDB Client Error (updateProfile):", error);
  }
};

export const saveHistory = async (userId: string, item: Omit<HistoryItem, 'id'>): Promise<void> => {
  try {
    await fetch(`/api/history/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
  } catch (error) {
    console.error("MongoDB Client Error (saveHistory):", error);
  }
};

export const getHistory = async (userId: string): Promise<HistoryItem[]> => {
  try {
    const res = await fetch(`/api/history/${userId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("MongoDB Client Error (getHistory):", error);
    return [];
  }
};

export const deleteHistoryItems = async (userId: string, ids: string[]): Promise<void> => {
  try {
    await fetch(`/api/history/${userId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
  } catch (error) {
    console.error("MongoDB Client Error (deleteHistoryItems):", error);
  }
};

export const updateHistoryItem = async (userId: string, historyId: string, data: Partial<HistoryItem>): Promise<void> => {
  try {
    await fetch(`/api/history/${userId}/${historyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error("MongoDB Client Error (updateHistoryItem):", error);
  }
};
