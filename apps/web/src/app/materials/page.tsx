import { materialUnits } from "@znservis/shared";
import { sr } from "@znservis/i18n";
import {
  createMaterialAction,
  createMaterialGroupAction
} from "@/app/actions";
import { AdminShell } from "@/components/AdminShell";
import { MaterialsCatalog } from "@/components/MaterialsCatalog";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstRelation, type SupabaseRelation } from "@/lib/supabaseRelations";

type MaterialRow = {
  id: string;
  name: string;
  unit: string;
  active: boolean;
  group_id: string | null;
  material_groups: { name: string } | null;
};

type MaterialRecord = {
  id: string;
  name: string;
  unit: string;
  active: boolean;
  group_id: string | null;
  material_groups: SupabaseRelation<{ name: string }>;
};

export default async function MaterialsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [{ data: groups }, { data: materials }] = await Promise.all([
    supabase.from("material_groups").select("id, name").order("name"),
    supabase
      .from("materials")
      .select("id, name, unit, active, group_id, material_groups(name)")
      .order("name")
  ]);

  const materialRows: MaterialRow[] = ((materials ?? []) as MaterialRecord[]).map((material) => ({
    id: material.id,
    name: material.name,
    unit: material.unit,
    active: material.active,
    group_id: material.group_id,
    material_groups: firstRelation(material.material_groups)
  }));

  return (
    <AdminShell>
      <div className="page-header">
        <div>
          <h2>{sr.nav.materials}</h2>
          <p className="muted">Katalog materijala koji radnici biraju u izvestajima.</p>
        </div>
      </div>

      <section className="grid grid-2">
        <article className="card">
          <h3>Dodaj grupu</h3>
          <form action={createMaterialGroupAction} className="form">
            <div className="field">
              <label htmlFor="group_name">Naziv</label>
              <input id="group_name" name="name" required minLength={2} />
            </div>
            <button className="button" type="submit">
              {sr.common.add}
            </button>
          </form>
        </article>

        <article className="card">
          <h3>Dodaj materijal</h3>
          <form action={createMaterialAction} className="form">
            <div className="field">
              <label htmlFor="material_name">Naziv</label>
              <input id="material_name" name="name" required minLength={2} />
            </div>
            <div className="field">
              <label htmlFor="group_id">{sr.material.group}</label>
              <select id="group_id" name="group_id">
                <option value="">Bez grupe</option>
                {(groups ?? []).map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="unit">{sr.material.unit}</label>
              <select id="unit" name="unit" defaultValue="kom">
                {materialUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
            <label>
              <input name="active" type="checkbox" defaultChecked /> {sr.common.active}
            </label>
            <button className="button" type="submit">
              {sr.common.add}
            </button>
          </form>
        </article>
      </section>

      <MaterialsCatalog groups={groups ?? []} materials={materialRows} />
    </AdminShell>
  );
}
