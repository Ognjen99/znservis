import { z } from "zod";
import { materialUnits, roles, workOrderStatuses } from "./constants";

export const RoleSchema = z.enum(roles);
export const MaterialUnitSchema = z.enum(materialUnits);
export const WorkOrderStatusSchema = z.enum(workOrderStatuses);

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format.");

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const WorkerLoginSchema = z.object({
  login_name: z.string().trim().min(2),
  password: z.string().min(6)
});

export const CreateWorkerSchema = z.object({
  password: z.string().min(8),
  full_name: z.string().trim().min(2)
});

export const UpdateWorkerSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2),
  password: z.union([z.string().min(8), z.literal("")]).optional()
});

export const LocationSchema = z.object({
  name: z.string().trim().min(2),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  active: z.boolean().default(true)
});

export const MaterialGroupSchema = z.object({
  name: z.string().trim().min(2)
});

export const MaterialSchema = z.object({
  name: z.string().trim().min(2),
  group_id: z.string().uuid().optional().nullable(),
  unit: MaterialUnitSchema,
  active: z.boolean().default(true)
});

export const WorkReportItemSchema = z.object({
  material_id: z.string().uuid(),
  quantity: z.coerce.number().positive()
});

export const CreateWorkReportSchema = z.object({
  location_id: z.string().uuid(),
  performed_at: z.string().datetime(),
  notes: z.string().trim().optional().nullable(),
  items: z.array(WorkReportItemSchema).min(1)
});

export const DailyLogItemSchema = WorkReportItemSchema;

export const CreateDailyLogSchema = z.object({
  work_order_id: z.string().uuid(),
  location_id: z.string().uuid(),
  work_date: DateOnlySchema,
  performed_at: z.string().datetime(),
  notes: z.string().trim().optional().nullable(),
  items: z.array(DailyLogItemSchema).min(1)
});

export const CreateWorkOrderSchema = z.object({
  title: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  location_id: z.string().uuid(),
  scheduled_start: DateOnlySchema.optional().nullable(),
  scheduled_end: DateOnlySchema.optional().nullable()
});

export const UpdateWorkOrderStatusSchema = z.object({
  id: z.string().uuid(),
  status: WorkOrderStatusSchema
});

export const AssignWorkOrderWorkersSchema = z.object({
  work_order_id: z.string().uuid(),
  worker_ids: z.array(z.string().uuid()).min(1)
});

export const WorkOrderMaterialAssignmentSchema = z.object({
  material_id: z.string().uuid(),
  assigned_quantity: z.coerce.number().positive()
});

export const AssignWorkOrderMaterialsSchema = z.object({
  work_order_id: z.string().uuid(),
  materials: z.array(WorkOrderMaterialAssignmentSchema).min(1)
});

export const ReportFiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  worker_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  material_id: z.string().uuid().optional(),
  query: z.string().optional()
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type WorkerLoginInput = z.infer<typeof WorkerLoginSchema>;
export type CreateWorkerInput = z.infer<typeof CreateWorkerSchema>;
export type UpdateWorkerInput = z.infer<typeof UpdateWorkerSchema>;
export type LocationInput = z.infer<typeof LocationSchema>;
export type MaterialGroupInput = z.infer<typeof MaterialGroupSchema>;
export type MaterialInput = z.infer<typeof MaterialSchema>;
export type CreateWorkReportInput = z.infer<typeof CreateWorkReportSchema>;
export type CreateDailyLogInput = z.infer<typeof CreateDailyLogSchema>;
export type CreateWorkOrderInput = z.infer<typeof CreateWorkOrderSchema>;
export type UpdateWorkOrderStatusInput = z.infer<typeof UpdateWorkOrderStatusSchema>;
export type AssignWorkOrderWorkersInput = z.infer<typeof AssignWorkOrderWorkersSchema>;
export type AssignWorkOrderMaterialsInput = z.infer<typeof AssignWorkOrderMaterialsSchema>;
export type ReportFiltersInput = z.infer<typeof ReportFiltersSchema>;
