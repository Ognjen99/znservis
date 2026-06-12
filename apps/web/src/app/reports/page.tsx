import { sr } from "@znservis/i18n";
import { AdminShell } from "@/components/AdminShell";
import { ReportsCatalog } from "@/components/ReportsCatalog";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstRelation, type SupabaseRelation } from "@/lib/supabaseRelations";

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

type ReportRecord = {
  id: string;
  performed_at: string;
  notes: string | null;
  worker_id: string | null;
  location_id: string | null;
  profiles: SupabaseRelation<{ full_name: string }>;
  locations: SupabaseRelation<{ name: string; address: string | null }>;
  work_report_items: Array<{
    material_id: string;
    quantity: number;
    materials: SupabaseRelation<{ name: string; unit: string }>;
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
      .is("work_order_id", null)
      .order("performed_at", { ascending: false })
      .limit(500)
  ]);

  const reportRows: ReportRow[] = ((reports ?? []) as ReportRecord[]).map((report) => ({
    id: report.id,
    performed_at: report.performed_at,
    notes: report.notes,
    worker_id: report.worker_id,
    location_id: report.location_id,
    profiles: firstRelation(report.profiles),
    locations: firstRelation(report.locations),
    work_report_items: report.work_report_items.map((item) => ({
      material_id: item.material_id,
      quantity: item.quantity,
      materials: firstRelation(item.materials)
    }))
  }));

  return (
    <AdminShell>
      <div className="page-header">
        <div>
          <h2>{sr.nav.reports}</h2>
          <p className="muted">Arhiva starih samostalnih izvestaja pre uvodjenja radnih naloga.</p>
        </div>
      </div>

      <ReportsCatalog
        locations={locations ?? []}
        materials={materials ?? []}
        reports={reportRows}
        workers={workers ?? []}
      />
    </AdminShell>
  );
}
