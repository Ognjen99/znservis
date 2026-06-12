import { sr } from "@znservis/i18n";
import { AdminShell } from "@/components/AdminShell";
import { CompletedWorkOrdersCatalog } from "@/components/CompletedWorkOrdersCatalog";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstRelation, type SupabaseRelation } from "@/lib/supabaseRelations";

type WorkOrderRecord = {
  id: string;
  title: string;
  description: string | null;
  location_id: string;
  updated_at: string;
  locations: SupabaseRelation<{ name: string; address: string | null }>;
  work_order_assignees: Array<{
    worker_id: string;
    profiles: SupabaseRelation<{ full_name: string }>;
  }>;
  work_order_materials: Array<{
    material_id: string;
    assigned_quantity: number;
    materials: SupabaseRelation<{ name: string; unit: string }>;
  }>;
  work_reports: Array<{
    work_report_items: Array<{
      material_id: string;
      quantity: number;
    }>;
  }>;
};

function materialUsageFor(order: WorkOrderRecord) {
  const usedByMaterial = new Map<string, number>();

  for (const report of order.work_reports) {
    for (const item of report.work_report_items) {
      usedByMaterial.set(item.material_id, (usedByMaterial.get(item.material_id) ?? 0) + Number(item.quantity));
    }
  }

  return order.work_order_materials.map((material) => ({
    material_id: material.material_id,
    assigned_quantity: Number(material.assigned_quantity),
    used_quantity: usedByMaterial.get(material.material_id) ?? 0,
    materials: firstRelation(material.materials)
  }));
}

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [{ data: workers }, { data: locations }, { data: workOrders }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "worker").order("full_name"),
    supabase.from("locations").select("id, name").order("name"),
    supabase
      .from("work_orders")
      .select(
        "id, title, description, location_id, updated_at, locations(name, address), work_order_assignees(worker_id, profiles(full_name)), work_order_materials(material_id, assigned_quantity, materials(name, unit)), work_reports(work_report_items(material_id, quantity))"
      )
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(500)
  ]);

  const orderRows = ((workOrders ?? []) as WorkOrderRecord[]).map((order) => ({
    id: order.id,
    title: order.title,
    description: order.description,
    location_id: order.location_id,
    updated_at: order.updated_at,
    locations: firstRelation(order.locations),
    assignees: order.work_order_assignees.map((assignee) => ({
      worker_id: assignee.worker_id,
      profiles: firstRelation(assignee.profiles)
    })),
    materials: materialUsageFor(order),
    daily_log_count: order.work_reports.length
  }));

  return (
    <AdminShell>
      <div className="page-header">
        <div>
          <h2>{sr.nav.reports}</h2>
          <p className="muted">Zavrseni radni nalozi sa detaljima rada i utrosenog materijala.</p>
        </div>
      </div>

      <CompletedWorkOrdersCatalog
        locations={locations ?? []}
        workOrders={orderRows}
        workers={workers ?? []}
      />
    </AdminShell>
  );
}
