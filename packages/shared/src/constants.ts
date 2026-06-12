export const roles = ["admin", "worker"] as const;

export const materialUnits = [
  "kom",
  "m",
  "m2",
  "m3",
  "kg",
  "l",
  "pak",
  "kutija"
] as const;

export const syncStatuses = ["pending", "syncing", "synced", "error"] as const;

export const workOrderStatuses = [
  "created",
  "assigned",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled"
] as const;

export const workOrderStatusLabels = {
  created: "Kreiran",
  assigned: "Dodeljen",
  in_progress: "U toku",
  on_hold: "Na cekanju",
  completed: "Zavrsen",
  cancelled: "Otkazan"
} as const;
