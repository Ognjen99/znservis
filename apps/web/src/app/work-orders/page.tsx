import { sr } from "@znservis/i18n";
import { createWorkOrderAction } from "@/app/actions";
import { AdminShell } from "@/components/AdminShell";
import { TableWrap } from "@/components/TableWrap";
import { WorkOrdersCatalog } from "@/components/WorkOrdersCatalog";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstRelation, type SupabaseRelation } from "@/lib/supabaseRelations";

type WorkOrderRecord = {
  id: string;
  title: string;
  description: string | null;
  location_id: string;
  status: "created" | "assigned" | "in_progress" | "on_hold" | "completed" | "cancelled";
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
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

  return order.work_order_materials.map((material) => {
    const usedQuantity = usedByMaterial.get(material.material_id) ?? 0;

    return {
      material_id: material.material_id,
      assigned_quantity: Number(material.assigned_quantity),
      used_quantity: usedQuantity,
      remaining_quantity: Number(material.assigned_quantity) - usedQuantity,
      materials: firstRelation(material.materials)
    };
  });
}

export default async function WorkOrdersPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [{ data: locations }, { data: workers }, { data: materials }, { data: workOrders }] = await Promise.all([
    supabase.from("locations").select("id, name").eq("active", true).order("name"),
    supabase.from("profiles").select("id, full_name").eq("role", "worker").eq("active", true).order("full_name"),
    supabase.from("materials").select("id, name, unit").eq("active", true).order("name"),
    supabase
      .from("work_orders")
      .select(
        "id, title, description, location_id, status, scheduled_start, scheduled_end, created_at, locations(name, address), work_order_assignees(worker_id, profiles(full_name)), work_order_materials(material_id, assigned_quantity, materials(name, unit)), work_reports(work_report_items(material_id, quantity))"
      )
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  const orderRows = ((workOrders ?? []) as WorkOrderRecord[]).map((order) => ({
    id: order.id,
    title: order.title,
    description: order.description,
    location_id: order.location_id,
    status: order.status,
    scheduled_start: order.scheduled_start,
    scheduled_end: order.scheduled_end,
    created_at: order.created_at,
    locations: firstRelation(order.locations),
    assignees: order.work_order_assignees.map((assignee) => ({
      worker_id: assignee.worker_id,
      profiles: firstRelation(assignee.profiles)
    })),
    materials: materialUsageFor(order)
  }));

  return (
    <AdminShell>
      <div className="page-header">
        <div>
          <h2>{sr.nav.workOrders}</h2>
          <p className="muted">Planiranje visednevnih poslova, radnika, materijala i dnevnih zapisa.</p>
        </div>
      </div>

      <section className="card">
        <h3>{sr.workOrder.new}</h3>
        <form action={createWorkOrderAction} className="form">
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="title">{sr.workOrder.title}</label>
              <input id="title" name="title" required minLength={2} />
            </div>
            <div className="field">
              <label htmlFor="location_id">{sr.report.location}</label>
              <select id="location_id" name="location_id" required>
                {(locations ?? []).map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">{sr.workOrder.description}</label>
            <textarea id="description" name="description" rows={3} />
          </div>

          <div className="field">
            <label>{sr.workOrder.assignees}</label>
            <div className="checkbox-grid">
              {(workers ?? []).map((worker) => (
                <label className="checkbox-row" key={worker.id}>
                  <input name="worker_id" type="checkbox" value={worker.id} />
                  {worker.full_name}
                </label>
              ))}
              {(workers ?? []).length === 0 ? <p className="muted">{sr.common.empty}</p> : null}
            </div>
          </div>

          <div className="field">
            <label>{sr.workOrder.assignedMaterials}</label>
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>Materijal</th>
                    <th>Jedinica</th>
                    <th>{sr.workOrder.assignedQuantity}</th>
                  </tr>
                </thead>
                <tbody>
                  {(materials ?? []).map((material) => (
                    <tr key={material.id}>
                      <td>
                        {material.name}
                        <input name="material_id" type="hidden" value={material.id} />
                      </td>
                      <td>{material.unit}</td>
                      <td>
                        <input
                          min="0"
                          name={`quantity_${material.id}`}
                          placeholder="0"
                          step="0.001"
                          type="number"
                        />
                      </td>
                    </tr>
                  ))}
                  {(materials ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3}>{sr.common.empty}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </TableWrap>
            <p className="muted table-subtext">Unesite kolicinu samo za materijale koje radnici smeju da koriste.</p>
          </div>

          <button className="button" type="submit">
            {sr.common.add}
          </button>
        </form>
      </section>

      <WorkOrdersCatalog locations={locations ?? []} workers={workers ?? []} workOrders={orderRows} />
    </AdminShell>
  );
}
