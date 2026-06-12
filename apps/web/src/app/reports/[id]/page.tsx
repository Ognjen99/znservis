import Link from "next/link";
import { notFound } from "next/navigation";
import { workOrderStatusLabels } from "@znservis/shared";
import { sr } from "@znservis/i18n";
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
  status: "completed";
  updated_at: string;
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

export default async function CompletedWorkOrderReportPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: order } = await supabase
    .from("work_orders")
    .select(
      "id, title, description, status, updated_at, locations(name, address), work_order_assignees(worker_id, profiles(full_name)), work_order_materials(id, material_id, assigned_quantity, materials(name, unit)), work_order_attachments(id, file_path, file_name, mime_type, created_at), work_reports(id, worker_id, work_date, performed_at, notes, profiles(full_name), work_report_items(material_id, quantity, materials(name, unit)))"
    )
    .eq("id", id)
    .eq("status", "completed")
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const workOrder = order as WorkOrderRecord;
  const location = firstRelation(workOrder.locations);
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
            {workOrderStatusLabels.completed} - {new Date(workOrder.updated_at).toLocaleDateString("sr-RS")}
          </p>
          <p className="muted">
            {location?.name ?? "-"} {location?.address ? `- ${location.address}` : ""}
          </p>
        </div>
        <Link className="button button-secondary" href="/reports">
          Nazad na izvestaje
        </Link>
      </div>

      {workOrder.description ? (
        <section className="card">
          <h3>{sr.workOrder.description}</h3>
          <p>{workOrder.description}</p>
        </section>
      ) : null}

      <section className="grid grid-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>{sr.workOrder.assignees}</h3>
          <div className="stack-list">
            {workOrder.work_order_assignees.map((assignee) => (
              <div key={assignee.worker_id}>{firstRelation(assignee.profiles)?.full_name ?? "-"}</div>
            ))}
            {workOrder.work_order_assignees.length === 0 ? <p className="muted">{sr.common.empty}</p> : null}
          </div>
        </article>

        <article className="card">
          <h3>{sr.workOrder.planAttachments}</h3>
          <div className="stack-list">
            {attachmentLinks.map((attachment) =>
              attachment.signedUrl ? (
                <a
                  className="button button-secondary"
                  href={attachment.signedUrl}
                  key={attachment.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  {attachment.file_name}
                </a>
              ) : (
                <span key={attachment.id}>{attachment.file_name}</span>
              )
            )}
            {attachmentLinks.length === 0 ? <p className="muted">{sr.common.empty}</p> : null}
          </div>
        </article>
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
