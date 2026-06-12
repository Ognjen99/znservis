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

export const workOrderStatuses = ["in_progress", "completed"] as const;

export const workOrderStatusLabels = {
  in_progress: "U toku",
  completed: "Zavrsen"
} as const;
