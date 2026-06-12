"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { workOrderStatusLabels, workOrderStatuses, type WorkOrderStatus } from "@znservis/shared";
import { sr } from "@znservis/i18n";
import { deleteWorkOrderAction } from "@/app/actions";
import { TableWrap } from "@/components/TableWrap";

type WorkOrderRow = {
  id: string;
  title: string;
  description: string | null;
  location_id: string;
  status: WorkOrderStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
  locations: { name: string; address: string | null } | null;
  assignees: Array<{ worker_id: string; profiles: { full_name: string } | null }>;
  materials: Array<{
    material_id: string;
    assigned_quantity: number;
    used_quantity: number;
    remaining_quantity: number;
    materials: { name: string; unit: string } | null;
  }>;
};

type Option = {
  id: string;
  name?: string;
  full_name?: string;
};

type WorkOrdersCatalogProps = {
  workOrders: WorkOrderRow[];
  locations: Option[];
  workers: Option[];
};

function matchesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export function WorkOrdersCatalog({ workOrders, locations, workers }: WorkOrdersCatalogProps) {
  const [status, setStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [query, setQuery] = useState("");

  const filteredOrders = useMemo(() => {
    return workOrders.filter((order) => {
      if (status && order.status !== status) {
        return false;
      }

      if (locationId && order.location_id !== locationId) {
        return false;
      }

      if (workerId && !order.assignees.some((assignee) => assignee.worker_id === workerId)) {
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
  }, [locationId, query, status, workerId, workOrders]);

  function clearFilters() {
    setStatus("");
    setLocationId("");
    setWorkerId("");
    setQuery("");
  }

  const filtersActive = Boolean(status || locationId || workerId || query);

  return (
    <>
      <section className="card filter-panel">
        <h3>{sr.common.filter}</h3>
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="filter_work_order_query">{sr.common.search}</label>
            <input
              id="filter_work_order_query"
              placeholder="Naziv, lokacija, radnik, materijal"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="filter_work_order_status">{sr.workOrder.status}</label>
            <select
              id="filter_work_order_status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Svi statusi</option>
              {workOrderStatuses.map((nextStatus) => (
                <option key={nextStatus} value={nextStatus}>
                  {workOrderStatusLabels[nextStatus]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter_work_order_location">{sr.report.location}</label>
            <select
              id="filter_work_order_location"
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
            <label htmlFor="filter_work_order_worker">{sr.report.worker}</label>
            <select
              id="filter_work_order_worker"
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
          <h3>{sr.workOrder.plural}</h3>
          <span className="muted">{filteredOrders.length} rezultata</span>
        </div>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Nalog</th>
                <th>Status</th>
                <th>Lokacija</th>
                <th>Radnici</th>
                <th>Materijali</th>
                <th>Akcija</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.title}</strong>
                    {order.description ? <div className="muted table-subtext">{order.description}</div> : null}
                    {order.scheduled_start || order.scheduled_end ? (
                      <div className="muted table-subtext">
                        {order.scheduled_start ?? "?"} - {order.scheduled_end ?? "?"}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className={order.status === "cancelled" ? "badge badge-inactive" : "badge"}>
                      {workOrderStatusLabels[order.status]}
                    </span>
                  </td>
                  <td>
                    {order.locations?.name ?? "-"}
                    {order.locations?.address ? <div className="muted table-subtext">{order.locations.address}</div> : null}
                  </td>
                  <td>
                    {order.assignees.length > 0
                      ? order.assignees.map((assignee) => assignee.profiles?.full_name ?? "-").join(", ")
                      : "-"}
                  </td>
                  <td>
                    {order.materials.length > 0
                      ? order.materials.map((material) => (
                          <div key={`${order.id}-${material.material_id}`}>
                            {material.materials?.name ?? "Materijal"}: {material.used_quantity}/{material.assigned_quantity}{" "}
                            {material.materials?.unit ?? ""}
                          </div>
                        ))
                      : "-"}
                  </td>
                  <td className="actions-cell">
                    <Link className="button button-secondary" href={`/work-orders/${order.id}`}>
                      Otvori
                    </Link>
                    <form action={deleteWorkOrderAction}>
                      <input name="id" type="hidden" value={order.id} />
                      <button className="button button-danger" type="submit">
                        {sr.common.delete}
                      </button>
                    </form>
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
