import type { materialUnits, roles, syncStatuses, workOrderStatuses } from "./constants";

export type UserRole = (typeof roles)[number];
export type MaterialUnit = (typeof materialUnits)[number];
export type SyncStatus = (typeof syncStatuses)[number];
export type WorkOrderStatus = (typeof workOrderStatuses)[number];

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
  work_order_id: string | null;
  performed_at: string;
  work_date: string;
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

export type WorkOrder = {
  id: string;
  title: string;
  description: string | null;
  location_id: string;
  status: WorkOrderStatus;
  created_by: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkOrderAssignee = {
  work_order_id: string;
  worker_id: string;
  created_at: string;
};

export type WorkOrderMaterial = {
  id: string;
  work_order_id: string;
  material_id: string;
  assigned_quantity: number;
  created_at: string;
  updated_at: string;
};

export type WorkOrderMaterialUsage = WorkOrderMaterial & {
  used_quantity: number;
  remaining_quantity: number;
};

export type WorkOrderAttachment = {
  id: string;
  work_order_id: string;
  file_path: string;
  file_name: string;
  mime_type: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  uploaded_by: string | null;
  created_at: string;
};

export type WorkOrderWithDetails = WorkOrder & {
  location: Pick<Location, "id" | "name" | "address"> | null;
  assignees: Array<WorkOrderAssignee & { worker: Pick<Profile, "id" | "full_name"> | null }>;
  materials: Array<
    WorkOrderMaterialUsage & {
      material: Pick<Material, "id" | "name" | "unit"> | null;
    }
  >;
  attachments: WorkOrderAttachment[];
  daily_logs: WorkReportWithDetails[];
};

export type OfflineReport = {
  local_id: string;
  worker_id: string;
  location_id: string;
  work_order_id: string | null;
  performed_at: string;
  work_date: string;
  notes: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  created_at: string;
};
