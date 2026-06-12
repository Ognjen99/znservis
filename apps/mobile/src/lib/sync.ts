import { supabase } from "@/lib/supabase";
import {
  cacheCatalog,
  cacheWorkOrders,
  getPendingDailyLogs,
  updateDailyLogSyncStatus,
  type CachedWorkOrderWithDetails,
  type CatalogLocation,
  type CatalogMaterial
} from "@/lib/localDb";

type RemoteRelation<T> = T | T[] | null;

type RemoteWorkOrder = {
  id: string;
  title: string;
  description: string | null;
  location_id: string;
  status: "in_progress" | "completed";
  scheduled_start: string | null;
  scheduled_end: string | null;
  locations: RemoteRelation<{ name: string; address: string | null }>;
  work_order_materials: Array<{
    material_id: string;
    assigned_quantity: number;
    materials: RemoteRelation<{ name: string; unit: string }>;
  }>;
  work_order_attachments: Array<{
    id: string;
    file_path: string;
    file_name: string;
    mime_type: string;
  }>;
  work_reports: Array<{
    work_report_items: Array<{
      material_id: string;
      quantity: number;
    }>;
  }>;
};

function firstRelation<T>(relation: RemoteRelation<T>) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export async function refreshCatalog() {
  const [locations, materialGroups, materials] = await Promise.all([
    supabase.from("locations").select("id, name, address").eq("active", true).order("name"),
    supabase.from("material_groups").select("id, name").order("name"),
    supabase.from("materials").select("id, name, unit, group_id").eq("active", true).order("name")
  ]);

  if (locations.error) throw locations.error;
  if (materialGroups.error) throw materialGroups.error;
  if (materials.error) throw materials.error;

  await cacheCatalog({
    locations: (locations.data ?? []) as CatalogLocation[],
    materialGroups: materialGroups.data ?? [],
    materials: (materials.data ?? []) as CatalogMaterial[]
  });
}

export async function refreshWorkOrders() {
  const { data, error } = await supabase
    .from("work_orders")
    .select(
      "id, title, description, location_id, status, scheduled_start, scheduled_end, locations(name, address), work_order_materials(material_id, assigned_quantity, materials(name, unit)), work_order_attachments(id, file_path, file_name, mime_type), work_reports(work_report_items(material_id, quantity))"
    )
    .eq("status", "in_progress")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const orders: CachedWorkOrderWithDetails[] = await Promise.all(
    ((data ?? []) as RemoteWorkOrder[]).map(async (order) => {
      const location = firstRelation(order.locations);
      const usedByMaterial = new Map<string, number>();

      for (const report of order.work_reports ?? []) {
        for (const item of report.work_report_items ?? []) {
          usedByMaterial.set(item.material_id, (usedByMaterial.get(item.material_id) ?? 0) + Number(item.quantity));
        }
      }

      const attachments = await Promise.all(
        (order.work_order_attachments ?? []).map(async (attachment) => {
          const { data: signed } = await supabase.storage
            .from("work-order-plans")
            .createSignedUrl(attachment.file_path, 60 * 60);

          return {
            id: attachment.id,
            work_order_id: order.id,
            file_name: attachment.file_name,
            mime_type: attachment.mime_type,
            signed_url: signed?.signedUrl ?? null
          };
        })
      );

      return {
        id: order.id,
        title: order.title,
        description: order.description,
        location_id: order.location_id,
        location_name: location?.name ?? "-",
        location_address: location?.address ?? null,
        status: order.status,
        scheduled_start: order.scheduled_start,
        scheduled_end: order.scheduled_end,
        materials: (order.work_order_materials ?? []).map((assignment) => {
          const material = firstRelation(assignment.materials);
          const usedQuantity = usedByMaterial.get(assignment.material_id) ?? 0;
          const assignedQuantity = Number(assignment.assigned_quantity);

          return {
            work_order_id: order.id,
            material_id: assignment.material_id,
            material_name: material?.name ?? "Materijal",
            unit: material?.unit ?? "",
            assigned_quantity: assignedQuantity,
            used_quantity: usedQuantity,
            remaining_quantity: assignedQuantity - usedQuantity
          };
        }),
        attachments
      };
    })
  );

  await cacheWorkOrders(orders);
}

export async function flushDailyLogOutbox() {
  const pending = await getPendingDailyLogs();

  for (const { log, items } of pending) {
    await updateDailyLogSyncStatus(log.local_id, "syncing");

    try {
      const { data: existing } = await supabase
        .from("work_reports")
        .select("id")
        .eq("worker_id", log.worker_id)
        .eq("client_generated_id", log.local_id)
        .maybeSingle();

      let reportId = existing?.id as string | undefined;

      if (!reportId) {
        const { data, error } = await supabase
          .from("work_reports")
          .insert({
            worker_id: log.worker_id,
            work_order_id: log.work_order_id,
            location_id: log.location_id,
            work_date: log.work_date,
            performed_at: log.performed_at,
            notes: log.notes,
            client_generated_id: log.local_id
          })
          .select("id")
          .single();

        if (error) throw error;
        reportId = data.id;
      }

      const { count: existingItemCount } = await supabase
        .from("work_report_items")
        .select("id", { count: "exact", head: true })
        .eq("report_id", reportId);

      if (!existingItemCount) {
        const { error: itemError } = await supabase.from("work_report_items").insert(
          items.map((item) => ({
            report_id: reportId,
            material_id: item.material_id,
            quantity: item.quantity
          }))
        );

        if (itemError) {
          throw itemError;
        }
      }

      await updateDailyLogSyncStatus(log.local_id, "synced");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepoznata greska";
      await updateDailyLogSyncStatus(log.local_id, "error", message);
    }
  }
}

export async function completeWorkOrder(workOrderId: string) {
  const { error } = await supabase
    .from("work_orders")
    .update({ status: "completed" })
    .eq("id", workOrderId)
    .eq("status", "in_progress");

  if (error) {
    throw error;
  }
}

export async function syncNow() {
  await refreshCatalog();
  await flushDailyLogOutbox();
  await refreshWorkOrders();
}
