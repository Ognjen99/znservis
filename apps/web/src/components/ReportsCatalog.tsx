"use client";

import { sr } from "@znservis/i18n";
import { useMemo, useState } from "react";
import { deleteReportAction } from "@/app/actions";
import { TableWrap } from "@/components/TableWrap";

type WorkerOption = {
  id: string;
  full_name: string;
};

type LocationOption = {
  id: string;
  name: string;
};

type MaterialOption = {
  id: string;
  name: string;
};

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

type ReportsCatalogProps = {
  reports: ReportRow[];
  workers: WorkerOption[];
  locations: LocationOption[];
  materials: MaterialOption[];
};

function matchesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function toDateInputValue(isoDate: string) {
  return isoDate.slice(0, 10);
}

export function ReportsCatalog({ reports, workers, locations, materials }: ReportsCatalogProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [query, setQuery] = useState("");

  const filtersActive = Boolean(from || to || workerId || locationId || materialId || query);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const reportDate = toDateInputValue(report.performed_at);

      if (from && reportDate < from) {
        return false;
      }

      if (to && reportDate > to) {
        return false;
      }

      if (workerId && report.worker_id !== workerId) {
        return false;
      }

      if (locationId && report.location_id !== locationId) {
        return false;
      }

      if (materialId && !report.work_report_items.some((item) => item.material_id === materialId)) {
        return false;
      }

      if (query.trim()) {
        const note = report.notes ?? "";
        const workerName = report.profiles?.full_name ?? "";
        const locationName = report.locations?.name ?? "";
        const materialNames = report.work_report_items
          .map((item) => item.materials?.name ?? "")
          .join(" ");

        const haystack = `${note} ${workerName} ${locationName} ${materialNames}`;
        if (!matchesQuery(haystack, query)) {
          return false;
        }
      }

      return true;
    });
  }, [from, to, workerId, locationId, materialId, query, reports]);

  function clearFilters() {
    setFrom("");
    setTo("");
    setWorkerId("");
    setLocationId("");
    setMaterialId("");
    setQuery("");
  }

  return (
    <>
      <section className="card filter-panel">
        <h3>{sr.common.filter}</h3>
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="filter_from">Od datuma</label>
            <input
              id="filter_from"
              name="filter_from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="filter_to">Do datuma</label>
            <input
              id="filter_to"
              name="filter_to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="filter_query">{sr.common.search}</label>
            <input
              id="filter_query"
              name="filter_query"
              placeholder="Napomena, radnik, lokacija, materijal"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="filter_worker_id">{sr.report.worker}</label>
            <select
              id="filter_worker_id"
              name="filter_worker_id"
              value={workerId}
              onChange={(event) => setWorkerId(event.target.value)}
            >
              <option value="">Svi radnici</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter_location_id">{sr.report.location}</label>
            <select
              id="filter_location_id"
              name="filter_location_id"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">Sve lokacije</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter_material_id">{sr.report.material}</label>
            <select
              id="filter_material_id"
              name="filter_material_id"
              value={materialId}
              onChange={(event) => setMaterialId(event.target.value)}
            >
              <option value="">Svi materijali</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
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

      <section className="card" style={{ marginTop: 16 }}>
        <div className="table-header">
          <h3>{sr.nav.reports}</h3>
          <span className="muted">{filteredReports.length} rezultata</span>
        </div>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Radnik</th>
                <th>Lokacija</th>
                <th>Materijali</th>
                <th>Napomena</th>
                <th>Akcija</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr key={report.id}>
                  <td>{new Date(report.performed_at).toLocaleString("sr-RS")}</td>
                  <td>{report.profiles?.full_name ?? "-"}</td>
                  <td>
                    {report.locations?.name ?? "-"}
                    {report.locations?.address ? <div className="muted">{report.locations.address}</div> : null}
                  </td>
                  <td>
                    {report.work_report_items.map((item, index) => (
                      <div key={`${report.id}-${index}`}>
                        {item.materials?.name ?? "Materijal"}: {item.quantity} {item.materials?.unit ?? ""}
                      </div>
                    ))}
                  </td>
                  <td>{report.notes ?? "-"}</td>
                  <td className="actions-cell">
                    <form action={deleteReportAction}>
                      <input name="id" type="hidden" value={report.id} />
                      <button className="button button-danger" type="submit">
                        {sr.common.delete}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={6}>{sr.common.empty}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      </section>
    </>
  );
}
