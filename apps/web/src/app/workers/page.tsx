import { sr } from "@znservis/i18n";
import { AdminShell } from "@/components/AdminShell";
import { WorkersManager } from "@/components/WorkersManager";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function WorkersPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: workers } = await supabase
    .from("profiles")
    .select("id, full_name, login_name, active, created_at")
    .eq("role", "worker")
    .order("full_name");

  return (
    <AdminShell>
      <div className="page-header">
        <div>
          <h2>{sr.nav.workers}</h2>
          <p className="muted">Radnici se prijavljuju imenom i lozinkom u mobilnoj aplikaciji.</p>
        </div>
      </div>

      <WorkersManager workers={workers ?? []} />
    </AdminShell>
  );
}
