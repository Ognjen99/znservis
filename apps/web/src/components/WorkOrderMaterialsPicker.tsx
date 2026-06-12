"use client";

import { useMemo, useState } from "react";
import { sr } from "@znservis/i18n";
import { TableWrap } from "@/components/TableWrap";

const SEARCH_RESULT_LIMIT = 50;

export type MaterialGroupOption = {
  id: string;
  name: string;
};

export type MaterialCatalogOption = {
  id: string;
  name: string;
  unit: string;
  group_id: string | null;
  group_name: string | null;
};

export type AssignedMaterialDraft = {
  material_id: string;
  name: string;
  unit: string;
  group_name: string | null;
  assigned_quantity: number;
};

type WorkOrderMaterialsPickerProps = {
  groups: MaterialGroupOption[];
  materials: MaterialCatalogOption[];
  initialAssigned?: AssignedMaterialDraft[];
};

function matchesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export function WorkOrderMaterialsPicker({
  groups,
  materials,
  initialAssigned = []
}: WorkOrderMaterialsPickerProps) {
  const [assigned, setAssigned] = useState<AssignedMaterialDraft[]>(initialAssigned);
  const [groupId, setGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [addQuantity, setAddQuantity] = useState("1");

  const assignedById = useMemo(
    () => Object.fromEntries(assigned.map((item) => [item.material_id, item])),
    [assigned]
  );

  const filteredMaterials = useMemo(() => {
    if (!groupId && !query.trim()) {
      return [];
    }

    return materials
      .filter((material) => {
        if (assignedById[material.id]) {
          return false;
        }

        if (groupId && material.group_id !== groupId) {
          return false;
        }

        if (query.trim() && !matchesQuery(material.name, query)) {
          return false;
        }

        return true;
      })
      .slice(0, SEARCH_RESULT_LIMIT);
  }, [assignedById, groupId, materials, query]);

  const selectedMaterial =
    filteredMaterials.find((material) => material.id === selectedMaterialId) ??
    materials.find((material) => material.id === selectedMaterialId) ??
    null;

  function addMaterial() {
    if (!selectedMaterial) {
      return;
    }

    const parsedQuantity = Number(addQuantity);
    if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return;
    }

    setAssigned((current) => [
      ...current,
      {
        material_id: selectedMaterial.id,
        name: selectedMaterial.name,
        unit: selectedMaterial.unit,
        group_name: selectedMaterial.group_name,
        assigned_quantity: parsedQuantity
      }
    ]);
    setSelectedMaterialId("");
    setAddQuantity("1");
  }

  function removeMaterial(materialId: string) {
    setAssigned((current) => current.filter((item) => item.material_id !== materialId));
  }

  function updateQuantity(materialId: string, value: string) {
    const parsedQuantity = Number(value);
    if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return;
    }

    setAssigned((current) =>
      current.map((item) =>
        item.material_id === materialId ? { ...item, assigned_quantity: parsedQuantity } : item
      )
    );
  }

  return (
    <div className="material-picker">
      <div className="field">
        <label>{sr.workOrder.assignedMaterials}</label>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Materijal</th>
                <th>Grupa</th>
                <th>Jedinica</th>
                <th>{sr.workOrder.assignedQuantity}</th>
                <th>Akcija</th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((item) => (
                <tr key={item.material_id}>
                  <td>
                    {item.name}
                    <input name="material_id" type="hidden" value={item.material_id} />
                  </td>
                  <td>{item.group_name ?? "-"}</td>
                  <td>{item.unit}</td>
                  <td>
                    <input
                      min="0.001"
                      name={`quantity_${item.material_id}`}
                      onChange={(event) => updateQuantity(item.material_id, event.target.value)}
                      step="0.001"
                      type="number"
                      value={item.assigned_quantity}
                    />
                  </td>
                  <td>
                    <button className="button button-danger" onClick={() => removeMaterial(item.material_id)} type="button">
                      {sr.common.delete}
                    </button>
                  </td>
                </tr>
              ))}
              {assigned.length === 0 ? (
                <tr>
                  <td colSpan={5}>{sr.common.empty}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      </div>

      <div className="card material-picker-search">
        <h4>Dodaj materijal</h4>
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="material_group_filter">{sr.material.group}</label>
            <select
              id="material_group_filter"
              onChange={(event) => {
                setGroupId(event.target.value);
                setSelectedMaterialId("");
              }}
              value={groupId}
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
            <label htmlFor="material_search">{sr.common.search}</label>
            <input
              id="material_search"
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedMaterialId("");
              }}
              placeholder="Pretrazi naziv materijala"
              value={query}
            />
          </div>
          <div className="field">
            <label htmlFor="material_pick">{sr.report.material}</label>
            <select
              id="material_pick"
              onChange={(event) => setSelectedMaterialId(event.target.value)}
              value={selectedMaterialId}
            >
              <option value="">Izaberite materijal</option>
              {filteredMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} ({material.unit})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="inline-row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="material_add_quantity">{sr.report.quantity}</label>
            <input
              id="material_add_quantity"
              min="0.001"
              onChange={(event) => setAddQuantity(event.target.value)}
              step="0.001"
              type="number"
              value={addQuantity}
            />
          </div>
          <button className="button" disabled={!selectedMaterial} onClick={addMaterial} type="button">
            {sr.common.add}
          </button>
        </div>

        <p className="muted table-subtext">
          Izaberite grupu ili unesite pretragu da biste nasli materijal. Prikazuje se najvise{" "}
          {SEARCH_RESULT_LIMIT} rezultata.
        </p>
      </div>
    </div>
  );
}
