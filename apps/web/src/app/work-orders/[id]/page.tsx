import Link from "next/link";
import { notFound } from "next/navigation";
import { workOrderStatusLabels, workOrderStatuses, type WorkOrderStatus } from "@znservis/shared";
import { sr } from "@znservis/i18n";
import {
  assignWorkOrderWorkersAction,
  deleteWorkOrderAttachmentAction,
  setWorkOrderMaterialsAction,
  setWorkOrderStatusAction,
  updateWorkOrderAction,
  uploadWorkOrderPlanAction
} from "@/app/actions";
import { AdminShell } from "@/components/AdminShell";
import { TableWrap } from "@/components/TableWrap";
import { requireAdmin } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient
} from "@/lib/supabase/server";
import { firstRelation, type SupabaseRelation } from "@/lib/supabaseRelations";

type PageProps = {
  params: Promise<{ id: string }>;
};

type WorkOrderRecord = {
  id: string;
  title: string;
  description: string | null;
  location_id: string;
  status: WorkOrderStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  locations: SupabaseRelation<{ name: string; address: string | null }>;
  work_order_assignees: Array<{
    worker_id: string;
    profiles: SupabaseRelation<{ full_name: string }>;
  }>;
  work_order_materials: Array<{
    id: string;
    material_id: string;
    assigned_quantity: number;
    materials: SupabaseRelation<{ name: string; unit: string }>;
  }>;
  work_order_attachments: Array<{
    id: string;
    file_path: string;
    file_name: string;
    mime_type: string;
    created_at: string;
  }>;
  work_reports: Array<{
    id: string;
    worker_id: string | null;
    work_date: string;
    performed_at: string;
    notes: string | null;
    profiles: SupabaseRelation<{ full_name: string }>;
    work_report_items: Array<{
      material_id: string;
      quantity: number;
      materials: SupabaseRelation<{ name: string; unit: string }>;
    }>;
  }>;
};

function usageFor(order: WorkOrderRecord) {
  const usedByMaterial = new Map<string, number>();

  for (const report of order.work_reports) {
    for (const item of report.work_report_items) {
      usedByMaterial.set(item.material_id, (usedByMaterial.get(item.material_id) ?? 0) + Number(item.quantity));
    }
  }

  return order.work_order_materials.map((assignment) => {
    const usedQuantity = usedByMaterial.get(assignment.material_id) ?? 0;

    return {
      ...assignment,
      assigned_quantity: Number(assignment.assigned_quantity),
      used_quantity: usedQuantity,
      remaining_quantity: Number(assignment.assigned_quantity) - usedQuantity,
      materials: firstRelation(assignment.materials)
    };
  });
}

export default async function WorkOrderDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: order }, { data: locations }, { data: workers }, { data: materials }] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "id, title, description, location_id, status, scheduled_start, scheduled_end, locations(name, address), work_order_assignees(worker_id, profiles(full_name)), work_order_materials(id, material_id, assigned_quantity, materials(name, unit)), work_order_attachments(id, file_path, file_name, mime_type, created_at), work_reports(id, worker_id, work_date, performed_at, notes, profiles(full_name), work_report_items(material_id, quantity, materials(name, unit)))"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("locations").select("id, name").eq("active", true).order("name"),
    supabase.from("profiles").select("id, full_name").eq("role", "worker").eq("active", true).order("full_name"),
    supabase.from("materials").select("id, name, unit").eq("active", true).order("name")
  ]);

  if (!order) {
    notFound();
  }

  const workOrder = order as WorkOrderRecord;
  const location = firstRelation(workOrder.locations);
  const assignedWorkerIds = new Set(workOrder.work_order_assignees.map((assignee) => assignee.worker_id));
  const assignedMaterialById = new Map(
    workOrder.work_order_materials.map((assignment) => [assignment.material_id, assignment])
  );
  const usageRows = usageFor(workOrder);
  const admin = createSupabaseAdminClient();
  const attachmentLinks = await Promise.all(
    workOrder.work_order_attachments.map(async (attachment) => {
      const { data } = await admin.storage.from("work-order-plans").createSignedUrl(attachment.file_path, 60 * 30);
      return { ...attachment, signedUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <AdminShell>
      <div className="page-header">
        <div>
          <h2>{workOrder.title}</h2>
          <p className="muted">
            {location?.name ?? "-"} {location?.address ? `- ${location.address}` : ""}
          </p>
        </div>
        <Link className="button button-secondary" href="/work-orders">
          Nazad na radne naloge
        </Link>
      </div>

      <section className="grid grid-2">
        <article className="card">
          <h3>Detalji naloga</h3>
          <form action={updateWorkOrderAction} className="form">
            <input name="id" type="hidden" value={workOrder.id} />
            <div className="field">
              <label htmlFor="title">{sr.workOrder.title}</label>
              <input id="title" name="title" defaultValue={workOrder.title} required minLength={2} />
            </div>
            <div className="field">
              <label htmlFor="location_id">{sr.report.location}</label>
              <select id="location_id" name="location_id" defaultValue={workOrder.location_id} required>
                {(locations ?? []).map((nextLocation) => (
                  <option key={nextLocation.id} value={nextLocation.id}>
                    {nextLocation.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="description">{sr.workOrder.description}</label>
              <textarea id="description" name="description" rows={4} defaultValue={workOrder.description ?? ""} />
            </div>
            <button className="button" type="submit">
              {sr.common.save}
            </button>
          </form>
        </article>

        <article className="card">
          <h3>{sr.workOrder.status}</h3>
          <form action={setWorkOrderStatusAction} className="form">
            <input name="id" type="hidden" value={workOrder.id} />
            <div className="field">
              <label htmlFor="status">{sr.workOrder.status}</label>
              <select id="status" name="status" defaultValue={workOrder.status}>
                {workOrderStatuses.map((status) => (
                  <option key={status} value={status}>
                    {workOrderStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
            <button className="button" type="submit">
              {sr.common.save}
            </button>
          </form>
          <p className="muted table-subtext">
            Dnevni zapisi su dozvoljeni samo kada je nalog dodeljen ili u toku.
          </p>
        </article>
      </section>

      <section className="grid grid-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>{sr.workOrder.assignees}</h3>
          <form action={assignWorkOrderWorkersAction} className="form">
            <input name="work_order_id" type="hidden" value={workOrder.id} />
            <div className="checkbox-grid">
              {(workers ?? []).map((worker) => (
                <label key={worker.id} className="checkbox-row">
                  <input
                    name="worker_id"
                    type="checkbox"
                    value={worker.id}
                    defaultChecked={assignedWorkerIds.has(worker.id)}
                  />
                  {worker.full_name}
                </label>
              ))}
            </div>
            <button className="button" type="submit">
              {sr.common.save}
            </button>
          </form>
        </article>

        <article className="card">
          <h3>{sr.workOrder.planAttachments}</h3>
          <form action={uploadWorkOrderPlanAction} className="form" encType="multipart/form-data">
            <input name="work_order_id" type="hidden" value={workOrder.id} />
            <div className="field">
              <label htmlFor="file">{sr.workOrder.uploadPlan}</label>
              <input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
            </div>
            <button className="button" type="submit">
              {sr.common.add}
            </button>
          </form>

          <div className="stack-list">
            {attachmentLinks.map((attachment) => (
              <div className="inline-row" key={attachment.id}>
                {attachment.signedUrl ? (
                  <a className="button button-secondary" href={attachment.signedUrl} target="_blank" rel="noreferrer">
                    {attachment.file_name}
                  </a>
                ) : (
                  <span>{attachment.file_name}</span>
                )}
                <form action={deleteWorkOrderAttachmentAction}>
                  <input name="id" type="hidden" value={attachment.id} />
                  <input name="work_order_id" type="hidden" value={workOrder.id} />
                  <button className="button button-danger" type="submit">
                    {sr.common.delete}
                  </button>
                </form>
              </div>
            ))}
            {attachmentLinks.length === 0 ? <p className="muted">{sr.common.empty}</p> : null}
          </div>
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>{sr.workOrder.assignedMaterials}</h3>
        <form action={setWorkOrderMaterialsAction} className="form">
          <input name="work_order_id" type="hidden" value={workOrder.id} />
          <TableWrap>
            <table className="table">
              <thead>
                <tr>
                  <th>Materijal</th>
                  <th>Jedinica</th>
                  <th>Dodeljena kolicina</th>
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
                        step="0.001"
                        type="number"
                        defaultValue={assignedMaterialById.get(material.id)?.assigned_quantity ?? ""}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <button className="button" type="submit">
            {sr.common.save}
          </button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="table-header">
          <h3>Stanje materijala</h3>
        </div>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Materijal</th>
                <th>{sr.workOrder.assignedQuantity}</th>
                <th>{sr.workOrder.usedQuantity}</th>
                <th>{sr.workOrder.remainingQuantity}</th>
              </tr>
            </thead>
            <tbody>
              {usageRows.map((material) => (
                <tr key={material.id}>
                  <td>{material.materials?.name ?? "Materijal"}</td>
                  <td>
                    {material.assigned_quantity} {material.materials?.unit ?? ""}
                  </td>
                  <td>
                    {material.used_quantity} {material.materials?.unit ?? ""}
                  </td>
                  <td>
                    {material.remaining_quantity} {material.materials?.unit ?? ""}
                  </td>
                </tr>
              ))}
              {usageRows.length === 0 ? (
                <tr>
                  <td colSpan={4}>{sr.common.empty}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="table-header">
          <h3>{sr.workOrder.dailyLogs}</h3>
          <span className="muted">{workOrder.work_reports.length} zapisa</span>
        </div>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Radnik</th>
                <th>Materijali</th>
                <th>Napomena</th>
              </tr>
            </thead>
            <tbody>
              {workOrder.work_reports.map((report) => {
                const worker = firstRelation(report.profiles);

                return (
                  <tr key={report.id}>
                    <td>{new Date(report.performed_at).toLocaleDateString("sr-RS")}</td>
                    <td>{worker?.full_name ?? "-"}</td>
                    <td>
                      {report.work_report_items.map((item, index) => {
                        const material = firstRelation(item.materials);

                        return (
                          <div key={`${report.id}-${index}`}>
                            {material?.name ?? "Materijal"}: {item.quantity} {material?.unit ?? ""}
                          </div>
                        );
                      })}
                    </td>
                    <td>{report.notes ?? "-"}</td>
                  </tr>
                );
              })}
              {workOrder.work_reports.length === 0 ? (
                <tr>
                  <td colSpan={4}>{sr.common.empty}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      </section>
    </AdminShell>
  );
}
