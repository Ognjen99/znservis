import type { CreateWorkReportInput } from "@znservis/shared";
import { supabase } from "@/lib/supabase";
import {
  cacheCatalog,
  getPendingReports,
  updateReportSyncStatus,
  type CatalogLocation,
  type CatalogMaterial
} from "@/lib/localDb";

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

export async function flushReportOutbox() {
  const pending = await getPendingReports();

  for (const { report, items } of pending) {
    await updateReportSyncStatus(report.local_id, "syncing");

    try {
      const { data: existing } = await supabase
        .from("work_reports")
        .select("id")
        .eq("worker_id", report.worker_id)
        .eq("client_generated_id", report.local_id)
        .maybeSingle();

      let reportId = existing?.id as string | undefined;

      if (!reportId) {
        const { data, error } = await supabase
          .from("work_reports")
          .insert({
            worker_id: report.worker_id,
            location_id: report.location_id,
            performed_at: report.performed_at,
            notes: report.notes,
            client_generated_id: report.local_id
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

      await updateReportSyncStatus(report.local_id, "synced");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepoznata greska";
      await updateReportSyncStatus(report.local_id, "error", message);
    }
  }
}

export async function syncNow() {
  await refreshCatalog();
  await flushReportOutbox();
}

export async function updateRemoteReport(reportId: string, report: CreateWorkReportInput) {
  const { error: reportError } = await supabase
    .from("work_reports")
    .update({
      location_id: report.location_id,
      performed_at: report.performed_at,
      notes: report.notes
    })
    .eq("id", reportId);

  if (reportError) {
    throw reportError;
  }

  const { error: deleteError } = await supabase.from("work_report_items").delete().eq("report_id", reportId);

  if (deleteError) {
    throw deleteError;
  }

  const { error: insertError } = await supabase.from("work_report_items").insert(
    report.items.map((item) => ({
      report_id: reportId,
      material_id: item.material_id,
      quantity: item.quantity
    }))
  );

  if (insertError) {
    throw insertError;
  }
}
