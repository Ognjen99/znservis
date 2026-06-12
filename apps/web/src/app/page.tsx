import { sr } from "@znservis/i18n";
import { workOrderStatusLabels, type WorkOrderStatus } from "@znservis/shared";
import { AdminShell } from "@/components/AdminShell";
import { TableWrap } from "@/components/TableWrap";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstRelation, type SupabaseRelation } from "@/lib/supabaseRelations";

type RecentWorkOrder = {
  id: string;
  title: string;
  status: WorkOrderStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  locations: { name: string } | null;
};

type RecentWorkOrderRecord = {
  id: string;
  title: string;
  status: WorkOrderStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  locations: SupabaseRelation<{ name: string }>;
};

export default async function DashboardPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [{ count: activeOrdersCount }, { count: reportsCount }, { count: workersCount }, { count: locationsCount }, recentOrders] =
    await Promise.all([
      supabase
        .from("work_orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["assigned", "in_progress", "on_hold"]),
      supabase.from("work_reports").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "worker"),
      supabase
        .from("locations")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      supabase
        .from("work_orders")
        .select("id, title, status, scheduled_start, scheduled_end, locations(name)")
        .order("created_at", { ascending: false })
        .limit(8)
    ]);

  const orders: RecentWorkOrder[] = ((recentOrders.data ?? []) as RecentWorkOrderRecord[]).map((order) => ({
    id: order.id,
    title: order.title,
    status: order.status,
    scheduled_start: order.scheduled_start,
    scheduled_end: order.scheduled_end,
    locations: firstRelation(order.locations)
  }));

  return (
    <AdminShell>
      <div className="page-header">
        <div>
          <h2>{sr.nav.dashboard}</h2>
          <p className="muted">Pregled aktivnih radnih naloga i najnovijih aktivnosti.</p>
        </div>
      </div>

      <section className="grid grid-3">
        <article className="card">
          <span className="muted">Aktivni radni nalozi</span>
          <div className="metric">{activeOrdersCount ?? 0}</div>
        </article>
        <article className="card">
          <span className="muted">Dnevni zapisi</span>
          <div className="metric">{reportsCount ?? 0}</div>
        </article>
        <article className="card">
          <span className="muted">Radnici</span>
          <div className="metric">{workersCount ?? 0}</div>
        </article>
        <article className="card">
          <span className="muted">Aktivne lokacije</span>
          <div className="metric">{locationsCount ?? 0}</div>
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Najnoviji radni nalozi</h3>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Nalog</th>
                <th>Status</th>
                <th>Lokacija</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.title}</td>
                  <td>{workOrderStatusLabels[order.status]}</td>
                  <td>{order.locations?.name ?? "-"}</td>
                  <td>
                    {order.scheduled_start || order.scheduled_end
                      ? `${order.scheduled_start ?? "?"} - ${order.scheduled_end ?? "?"}`
                      : "-"}
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
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
