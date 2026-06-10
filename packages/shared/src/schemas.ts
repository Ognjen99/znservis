import { z } from "zod";
import { materialUnits, roles } from "./constants";

export const RoleSchema = z.enum(roles);
export const MaterialUnitSchema = z.enum(materialUnits);

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
export type ReportFiltersInput = z.infer<typeof ReportFiltersSchema>;
