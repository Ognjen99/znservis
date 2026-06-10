"use client";

import { materialUnits } from "@znservis/shared";
import { sr } from "@znservis/i18n";
import { useMemo, useState } from "react";
import { deleteMaterialAction, setMaterialActiveAction } from "@/app/actions";
import { TableWrap } from "@/components/TableWrap";

type GroupRow = {
  id: string;
  name: string;
};

type MaterialRow = {
  id: string;
  name: string;
  unit: string;
  active: boolean;
  group_id: string | null;
  material_groups: { name: string } | null;
};

type MaterialsCatalogProps = {
  groups: GroupRow[];
  materials: MaterialRow[];
};

function matchesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export function MaterialsCatalog({ groups, materials }: MaterialsCatalogProps) {
  const [groupQuery, setGroupQuery] = useState("");
  const [materialQuery, setMaterialQuery] = useState("");
  const [groupId, setGroupId] = useState("");
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState("");

  const filtersActive = Boolean(groupQuery || materialQuery || groupId || unit || status);

  const filteredGroups = useMemo(() => {
    if (!groupQuery.trim()) {
      return groups;
    }

    return groups.filter((group) => matchesQuery(group.name, groupQuery));
  }, [groupQuery, groups]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      if (materialQuery.trim() && !matchesQuery(material.name, materialQuery)) {
        return false;
      }

      if (groupId && material.group_id !== groupId) {
        return false;
      }

      if (unit && material.unit !== unit) {
        return false;
      }

      if (status === "active" && !material.active) {
        return false;
      }

      if (status === "inactive" && material.active) {
        return false;
      }

      return true;
    });
  }, [groupId, materialQuery, materials, status, unit]);

  function clearFilters() {
    setGroupQuery("");
    setMaterialQuery("");
    setGroupId("");
    setUnit("");
    setStatus("");
  }

  return (
    <>
      <section className="card filter-panel">
        <h3>{sr.common.filter}</h3>
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="group_q">Pretraga grupa</label>
            <input
              id="group_q"
              name="group_q"
              placeholder="Naziv grupe"
              value={groupQuery}
              onChange={(event) => setGroupQuery(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="material_q">Pretraga materijala</label>
            <input
              id="material_q"
              name="material_q"
              placeholder="Naziv materijala"
              value={materialQuery}
              onChange={(event) => setMaterialQuery(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="filter_group_id">{sr.material.group}</label>
            <select
              id="filter_group_id"
              name="filter_group_id"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
            >
              <option value="">Sve grupe</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter_unit">{sr.material.unit}</label>
            <select
              id="filter_unit"
              name="filter_unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              <option value="">Sve jedinice</option>
              {materialUnits.map((materialUnit) => (
                <option key={materialUnit} value={materialUnit}>
                  {materialUnit}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter_status">Status</label>
            <select
              id="filter_status"
              name="filter_status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Svi statusi</option>
              <option value="active">{sr.common.active}</option>
              <option value="inactive">{sr.common.inactive}</option>
            </select>
          </div>
          {filtersActive ? (
            <div className="filter-actions">
              <button className="button button-secondary" type="button" onClick={clearFilters}>
                {sr.common.clearFilters}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 16 }}>
        <article className="card">
          <div className="table-header">
            <h3>Grupe</h3>
            <span className="muted">{filteredGroups.length} rezultata</span>
          </div>
          <TableWrap compact>
            <table className="table">
              <thead>
                <tr>
                  <th>Naziv</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((group) => (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                  </tr>
                ))}
                {filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={1}>{sr.common.empty}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </article>

        <article className="card">
          <div className="table-header">
            <h3>Materijali</h3>
            <span className="muted">{filteredMaterials.length} rezultata</span>
          </div>
          <TableWrap>
            <table className="table">
              <thead>
                <tr>
                  <th>Naziv</th>
                  <th>Grupa</th>
                  <th>Jedinica</th>
                  <th>Status</th>
                  <th>Akcija</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((material) => (
                  <tr key={material.id}>
                    <td>{material.name}</td>
                    <td>{material.material_groups?.name ?? "-"}</td>
                    <td>{material.unit}</td>
                    <td>
                      <span className={material.active ? "badge" : "badge badge-inactive"}>
                        {material.active ? sr.common.active : sr.common.inactive}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <form action={setMaterialActiveAction}>
                        <input name="id" type="hidden" value={material.id} />
                        <input name="active" type="hidden" value={material.active ? "false" : "true"} />
                        <button className="button" type="submit">
                          {material.active ? "Deaktiviraj" : "Aktiviraj"}
                        </button>
                      </form>
                      <form action={deleteMaterialAction}>
                        <input name="id" type="hidden" value={material.id} />
                        <button className="button button-danger" type="submit">
                          {sr.common.delete}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{sr.common.empty}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </article>
      </section>
    </>
  );
}
