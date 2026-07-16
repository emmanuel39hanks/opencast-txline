"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  notifications: { trades: boolean; disputes: boolean; approvals: boolean };
  setNotifications: (n: Partial<AppState["notifications"]>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      notifications: { trades: true, disputes: true, approvals: true },
      setNotifications: (n) =>
        set((s) => ({ notifications: { ...s.notifications, ...n } })),
    }),
    { name: "opencast-app-v1" },
  ),
);
