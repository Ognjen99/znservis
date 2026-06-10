import { sr } from "@znservis/i18n";
import { AdminShell } from "@/components/AdminShell";
import { TableWrap } from "@/components/TableWrap";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstRelation, type SupabaseRelation } from "@/lib/supabaseRelations";

type RecentReport = {
  id: string;
  performed_at: string;
  notes: string | null;
  profiles: { full_name: string } | null;
  locations: { name: string } | null;
};

type RecentReportRecord = {
  id: string;
  performed_at: string;
  notes: string | null;
  profiles: SupabaseRelation<{ full_name: string }>;
  locations: SupabaseRelation<{ name: string }>;
};

export default async function DashboardPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [{ count: reportsCount }, { count: workersCount }, { count: locationsCount }, recentReports] =
    await Promise.all([
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
        .from("work_reports")
        .select("id, performed_at, notes, profiles(full_name), locations(name)")
        .order("performed_at", { ascending: false })
        .limit(8)
    ]);

  const reports: RecentReport[] = ((recentReports.data ?? []) as RecentReportRecord[]).map((report) => ({
    id: report.id,
    performed_at: report.performed_at,
    notes: report.notes,
    profiles: firstRelation(report.profiles),
    locations: firstRelation(report.locations)
  }));

  return (
    <AdminShell>
      <div className="page-header">
        <div>
          <h2>{sr.nav.dashboard}</h2>
          <p className="muted">Pregled rada firme i najnovijih izvestaja.</p>
        </div>
      </div>

      <section className="grid grid-3">
        <article className="card">
          <span className="muted">Ukupno izvestaja</span>
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
        <h3>{sr.admin.recentReports}</h3>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Radnik</th>
                <th>Lokacija</th>
                <th>Napomena</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{new Date(report.performed_at).toLocaleString("sr-RS")}</td>
                  <td>{report.profiles?.full_name ?? "-"}</td>
                  <td>{report.locations?.name ?? "-"}</td>
                  <td>{report.notes ?? "-"}</td>
                </tr>
              ))}
              {reports.length === 0 ? (
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
