import * as SQLite from "expo-sqlite";
import type { CreateWorkReportInput } from "@znservis/shared";
import { createUuid } from "@/lib/uuid";

export type CatalogLocation = {
  id: string;
  name: string;
  address: string | null;
};

export type CatalogMaterial = {
  id: string;
  name: string;
  unit: string;
  group_id: string | null;
};

export type PendingReport = {
  local_id: string;
  worker_id: string;
  location_id: string;
  performed_at: string;
  notes: string | null;
  sync_status: "pending" | "syncing" | "synced" | "error";
  sync_error: string | null;
  created_at: string;
};

export type PendingReportItem = {
  id: string;
  local_report_id: string;
  material_id: string;
  quantity: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  dbPromise ??= SQLite.openDatabaseAsync("znservis.db");
  return dbPromise;
}

export async function migrateLocalDb() {
  const db = await getDb();
  await db.execAsync(`
    create table if not exists local_locations (
      id text primary key,
      name text not null,
      address text
    );

    create table if not exists local_material_groups (
      id text primary key,
      name text not null
    );

    create table if not exists local_materials (
      id text primary key,
      name text not null,
      unit text not null,
      group_id text
    );

    create table if not exists pending_reports (
      local_id text primary key,
      worker_id text not null,
      location_id text not null,
      performed_at text not null,
      notes text,
      sync_status text not null default 'pending',
      sync_error text,
      created_at text not null
    );

    create table if not exists pending_report_items (
      id text primary key,
      local_report_id text not null references pending_reports(local_id) on delete cascade,
      material_id text not null,
      quantity real not null
    );
  `);
}

export async function cacheCatalog(input: {
  locations: CatalogLocation[];
  materialGroups: Array<{ id: string; name: string }>;
  materials: CatalogMaterial[];
}) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("delete from local_locations");
    await db.runAsync("delete from local_material_groups");
    await db.runAsync("delete from local_materials");

    for (const location of input.locations) {
      await db.runAsync(
        "insert into local_locations (id, name, address) values (?, ?, ?)",
        location.id,
        location.name,
        location.address
      );
    }

    for (const group of input.materialGroups) {
      await db.runAsync(
        "insert into local_material_groups (id, name) values (?, ?)",
        group.id,
        group.name
      );
    }

    for (const material of input.materials) {
      await db.runAsync(
        "insert into local_materials (id, name, unit, group_id) values (?, ?, ?, ?)",
        material.id,
        material.name,
        material.unit,
        material.group_id
      );
    }
  });
}

export async function getCatalog() {
  const db = await getDb();
  const [locations, materials] = await Promise.all([
    db.getAllAsync<CatalogLocation>("select id, name, address from local_locations order by name"),
    db.getAllAsync<CatalogMaterial>("select id, name, unit, group_id from local_materials order by name")
  ]);

  return { locations, materials };
}

export async function enqueueReport(workerId: string, report: CreateWorkReportInput) {
  const db = await getDb();
  const localId = createUuid();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `insert into pending_reports
        (local_id, worker_id, location_id, performed_at, notes, sync_status, created_at)
       values (?, ?, ?, ?, ?, 'pending', ?)`,
      localId,
      workerId,
      report.location_id,
      report.performed_at,
      report.notes ?? null,
      new Date().toISOString()
    );

    for (const item of report.items) {
      await db.runAsync(
        "insert into pending_report_items (id, local_report_id, material_id, quantity) values (?, ?, ?, ?)",
        createUuid(),
        localId,
        item.material_id,
        item.quantity
      );
    }
  });

  return localId;
}

export async function getPendingReports() {
  const db = await getDb();
  const reports = await db.getAllAsync<PendingReport>(
    "select * from pending_reports where sync_status in ('pending', 'error') order by created_at"
  );

  const result: Array<{ report: PendingReport; items: PendingReportItem[] }> = [];
  for (const report of reports) {
    const items = await db.getAllAsync<PendingReportItem>(
      "select * from pending_report_items where local_report_id = ?",
      report.local_id
    );
    result.push({ report, items });
  }

  return result;
}

export async function updateReportSyncStatus(
  localId: string,
  status: PendingReport["sync_status"],
  error: string | null = null
) {
  const db = await getDb();
  await db.runAsync(
    "update pending_reports set sync_status = ?, sync_error = ? where local_id = ?",
    status,
    error,
    localId
  );
}

export async function countPendingReports() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "select count(*) as count from pending_reports where sync_status in ('pending', 'error')"
  );
  return row?.count ?? 0;
}

export async function getPendingReport(localId: string) {
  const db = await getDb();
  const report = await db.getFirstAsync<PendingReport>(
    "select * from pending_reports where local_id = ?",
    localId
  );

  if (!report) {
    return null;
  }

  const items = await db.getAllAsync<PendingReportItem>(
    "select * from pending_report_items where local_report_id = ?",
    localId
  );

  return { report, items };
}

export async function updatePendingReport(localId: string, report: CreateWorkReportInput) {
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `update pending_reports
       set location_id = ?, performed_at = ?, notes = ?, sync_status = 'pending', sync_error = null
       where local_id = ?`,
      report.location_id,
      report.performed_at,
      report.notes ?? null,
      localId
    );

    await db.runAsync("delete from pending_report_items where local_report_id = ?", localId);

    for (const item of report.items) {
      await db.runAsync(
        "insert into pending_report_items (id, local_report_id, material_id, quantity) values (?, ?, ?, ?)",
        createUuid(),
        localId,
        item.material_id,
        item.quantity
      );
    }
  });
}
