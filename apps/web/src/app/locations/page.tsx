import { sr } from "@znservis/i18n";
import { createLocationAction, deleteLocationAction, setLocationActiveAction } from "@/app/actions";
import { AdminShell } from "@/components/AdminShell";
import { TableWrap } from "@/components/TableWrap";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LocationsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, address, notes, active")
    .order("name");

  return (
    <AdminShell>
      <div className="page-header">
        <div>
          <h2>{sr.nav.locations}</h2>
          <p className="muted">Lokacije na kojima radnici izvode posao.</p>
        </div>
      </div>

      <section className="grid grid-2">
        <article className="card">
          <h3>Dodaj lokaciju</h3>
          <form action={createLocationAction} className="form">
            <div className="field">
              <label htmlFor="name">Naziv</label>
              <input id="name" name="name" required minLength={2} />
            </div>
            <div className="field">
              <label htmlFor="address">Adresa</label>
              <input id="address" name="address" />
            </div>
            <div className="field">
              <label htmlFor="notes">{sr.report.notes}</label>
              <textarea id="notes" name="notes" rows={3} />
            </div>
            <label>
              <input name="active" type="checkbox" defaultChecked /> {sr.common.active}
            </label>
            <button className="button" type="submit">
              {sr.common.add}
            </button>
          </form>
        </article>

        <article className="card">
          <h3>Lokacije</h3>
          <TableWrap>
            <table className="table">
              <thead>
                <tr>
                  <th>Naziv</th>
                  <th>Adresa</th>
                  <th>Status</th>
                  <th>Akcija</th>
                </tr>
              </thead>
              <tbody>
                {(locations ?? []).map((location) => (
                  <tr key={location.id}>
                    <td>
                      {location.name}
                      {location.notes ? <div className="muted">{location.notes}</div> : null}
                    </td>
                    <td>{location.address ?? "-"}</td>
                    <td>
                      <span className={location.active ? "badge" : "badge badge-inactive"}>
                        {location.active ? sr.common.active : sr.common.inactive}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <form action={setLocationActiveAction}>
                        <input name="id" type="hidden" value={location.id} />
                        <input name="active" type="hidden" value={location.active ? "false" : "true"} />
                        <button className="button" type="submit">
                          {location.active ? "Deaktiviraj" : "Aktiviraj"}
                        </button>
                      </form>
                      <form action={deleteLocationAction}>
                        <input name="id" type="hidden" value={location.id} />
                        <button className="button button-danger" type="submit">
                          {sr.common.delete}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {locations?.length === 0 ? (
                  <tr>
                    <td colSpan={4}>{sr.common.empty}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </article>
      </section>
    </AdminShell>
  );
}
