import { sr } from "@znservis/i18n";
import { AdminShell } from "@/components/AdminShell";
import { ReportsCatalog } from "@/components/ReportsCatalog";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ReportRow = {
  id: string;
  performed_at: string;
  notes: string | null;
  worker_id: string | null;
  location_id: string | null;
  profiles: { full_name: string } | null;
  locations: { name: string; address: string | null } | null;
  work_report_items: Array<{
    material_id: string;
    quantity: number;
    materials: { name: string; unit: string } | null;
  }>;
};

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [{ data: workers }, { data: locations }, { data: materials }, { data: reports }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "worker").order("full_name"),
    supabase.from("locations").select("id, name").order("name"),
    supabase.from("materials").select("id, name").order("name"),
    supabase
      .from("work_reports")
      .select(
        "id, performed_at, notes, worker_id, location_id, profiles(full_name), locations(name, address), work_report_items(material_id, quantity, materials(name, unit))"
      )
      .order("performed_at", { ascending: false })
      .limit(500)
  ]);

  return (
    <AdminShell>
      <div className="page-header">
        <div>
          <h2>{sr.nav.reports}</h2>
          <p className="muted">Istorija svih radova, radnika, lokacija i materijala.</p>
        </div>
      </div>

      <ReportsCatalog
        locations={locations ?? []}
        materials={materials ?? []}
        reports={(reports ?? []) as ReportRow[]}
        workers={workers ?? []}
      />
    </AdminShell>
  );
}
