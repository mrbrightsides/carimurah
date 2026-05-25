import { UserProfile, HistoryItem } from '../types';
import { auth, loginWithGoogle, logout } from './firebase'; // Keep auth but move data to mongo

// This client proxies requests to our Express server which talks to MongoDB
// This is more secure as it keeps MongoDB credentials on the server.

export { auth, loginWithGoogle, logout };

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
