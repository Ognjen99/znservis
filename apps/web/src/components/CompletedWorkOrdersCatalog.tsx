"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { sr } from "@znservis/i18n";
import { TableWrap } from "@/components/TableWrap";

type WorkerOption = {
  id: string;
  full_name: string;
};

type LocationOption = {
  id: string;
  name: string;
};

type CompletedWorkOrderRow = {
  id: string;
  title: string;
  description: string | null;
  location_id: string;
  updated_at: string;
  locations: { name: string; address: string | null } | null;
  assignees: Array<{ worker_id: string; profiles: { full_name: string } | null }>;
  materials: Array<{
    material_id: string;
    assigned_quantity: number;
    used_quantity: number;
    materials: { name: string; unit: string } | null;
  }>;
  daily_log_count: number;
};

type CompletedWorkOrdersCatalogProps = {
  workOrders: CompletedWorkOrderRow[];
  workers: WorkerOption[];
  locations: LocationOption[];
};

function matchesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function toDateInputValue(isoDate: string) {
  return isoDate.slice(0, 10);
}

export function CompletedWorkOrdersCatalog({ workOrders, workers, locations }: CompletedWorkOrdersCatalogProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [query, setQuery] = useState("");

  const filtersActive = Boolean(from || to || workerId || locationId || query);

  const filteredOrders = useMemo(() => {
    return workOrders.filter((order) => {
      const completedDate = toDateInputValue(order.updated_at);

      if (from && completedDate < from) {
        return false;
      }

      if (to && completedDate > to) {
        return false;
      }

      if (workerId && !order.assignees.some((assignee) => assignee.worker_id === workerId)) {
        return false;
      }

      if (locationId && order.location_id !== locationId) {
        return false;
      }

      if (query.trim()) {
        const assigneeNames = order.assignees.map((assignee) => assignee.profiles?.full_name ?? "").join(" ");
        const materialNames = order.materials.map((material) => material.materials?.name ?? "").join(" ");
        const haystack = `${order.title} ${order.description ?? ""} ${order.locations?.name ?? ""} ${assigneeNames} ${materialNames}`;

        if (!matchesQuery(haystack, query)) {
          return false;
        }
      }

      return true;
    });
  }, [from, to, workerId, locationId, query, workOrders]);

  function clearFilters() {
    setFrom("");
    setTo("");
    setWorkerId("");
    setLocationId("");
    setQuery("");
  }

  return (
    <>
      <section className="card filter-panel">
        <h3>{sr.common.filter}</h3>
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="filter_from">Od datuma zavrsetka</label>
            <input
              id="filter_from"
              name="filter_from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="filter_to">Do datuma zavrsetka</label>
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
              placeholder="Naziv, lokacija, radnik, materijal"
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
          <span className="muted">{filteredOrders.length} rezultata</span>
        </div>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Nalog</th>
                <th>Zavrseno</th>
                <th>Lokacija</th>
                <th>Radnici</th>
                <th>Dnevni zapisi</th>
                <th>Akcija</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.title}</strong>
                    {order.description ? <div className="muted table-subtext">{order.description}</div> : null}
                  </td>
                  <td>{new Date(order.updated_at).toLocaleDateString("sr-RS")}</td>
                  <td>
                    {order.locations?.name ?? "-"}
                    {order.locations?.address ? <div className="muted table-subtext">{order.locations.address}</div> : null}
                  </td>
                  <td>
                    {order.assignees.length > 0
                      ? order.assignees.map((assignee) => assignee.profiles?.full_name ?? "-").join(", ")
                      : "-"}
                  </td>
                  <td>{order.daily_log_count}</td>
                  <td className="actions-cell">
                    <Link className="button button-secondary" href={`/reports/${order.id}`}>
                      Detalji
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 ? (
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
