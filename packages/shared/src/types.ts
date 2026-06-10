import type { materialUnits, roles, syncStatuses } from "./constants";

export type UserRole = (typeof roles)[number];
export type MaterialUnit = (typeof materialUnits)[number];
export type SyncStatus = (typeof syncStatuses)[number];

export type Profile = {
  id: string;
  full_name: string;
  login_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Location = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type MaterialGroup = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Material = {
  id: string;
  name: string;
  group_id: string | null;
  unit: MaterialUnit;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkReport = {
  id: string;
  worker_id: string;
  location_id: string;
  performed_at: string;
  notes: string | null;
  created_at: string;
};

export type WorkReportItem = {
  id: string;
  report_id: string;
  material_id: string;
  quantity: number;
  created_at: string;
};

export type WorkReportWithDetails = WorkReport & {
  worker: Pick<Profile, "id" | "full_name"> | null;
  location: Pick<Location, "id" | "name" | "address"> | null;
  items: Array<
    WorkReportItem & {
      material: Pick<Material, "id" | "name" | "unit"> | null;
    }
  >;
};

export type OfflineReport = {
  local_id: string;
  worker_id: string;
  location_id: string;
  performed_at: string;
  notes: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  created_at: string;
};
