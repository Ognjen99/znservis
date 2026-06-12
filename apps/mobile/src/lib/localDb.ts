import * as SQLite from "expo-sqlite";
import type { CreateDailyLogInput, WorkOrderStatus } from "@znservis/shared";
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

export type CachedWorkOrder = {
  id: string;
  title: string;
  description: string | null;
  location_id: string;
  location_name: string;
  location_address: string | null;
  status: WorkOrderStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
};

export type CachedWorkOrderMaterial = {
  work_order_id: string;
  material_id: string;
  material_name: string;
  unit: string;
  assigned_quantity: number;
  used_quantity: number;
  remaining_quantity: number;
};

export type CachedWorkOrderAttachment = {
  id: string;
  work_order_id: string;
  file_name: string;
  mime_type: string;
  signed_url: string | null;
};

export type CachedWorkOrderWithDetails = CachedWorkOrder & {
  materials: CachedWorkOrderMaterial[];
  attachments: CachedWorkOrderAttachment[];
};

export type PendingDailyLog = {
  local_id: string;
  worker_id: string;
  work_order_id: string;
  location_id: string;
  work_date: string;
  performed_at: string;
  notes: string | null;
  sync_status: "pending" | "syncing" | "synced" | "error";
  sync_error: string | null;
  created_at: string;
};

export type PendingDailyLogItem = {
  id: string;
  local_log_id: string;
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

    create table if not exists cached_work_orders (
      id text primary key,
      title text not null,
      description text,
      location_id text not null,
      location_name text not null,
      location_address text,
      status text not null,
      scheduled_start text,
      scheduled_end text
    );

    create table if not exists cached_work_order_materials (
      work_order_id text not null references cached_work_orders(id) on delete cascade,
      material_id text not null,
      material_name text not null,
      unit text not null,
      assigned_quantity real not null,
      used_quantity real not null,
      remaining_quantity real not null,
      primary key (work_order_id, material_id)
    );

    create table if not exists cached_work_order_attachments (
      id text primary key,
      work_order_id text not null references cached_work_orders(id) on delete cascade,
      file_name text not null,
      mime_type text not null,
      signed_url text
    );

    create table if not exists pending_daily_logs (
      local_id text primary key,
      worker_id text not null,
      work_order_id text not null,
      location_id text not null,
      work_date text not null,
      performed_at text not null,
      notes text,
      sync_status text not null default 'pending',
      sync_error text,
      created_at text not null
    );

    create table if not exists pending_daily_log_items (
      id text primary key,
      local_log_id text not null references pending_daily_logs(local_id) on delete cascade,
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

export async function cacheWorkOrders(input: CachedWorkOrderWithDetails[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("delete from cached_work_order_attachments");
    await db.runAsync("delete from cached_work_order_materials");
    await db.runAsync("delete from cached_work_orders");

    for (const order of input) {
      await db.runAsync(
        `insert into cached_work_orders
          (id, title, description, location_id, location_name, location_address, status, scheduled_start, scheduled_end)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        order.id,
        order.title,
        order.description,
        order.location_id,
        order.location_name,
        order.location_address,
        order.status,
        order.scheduled_start,
        order.scheduled_end
      );

      for (const material of order.materials) {
        await db.runAsync(
          `insert into cached_work_order_materials
            (work_order_id, material_id, material_name, unit, assigned_quantity, used_quantity, remaining_quantity)
           values (?, ?, ?, ?, ?, ?, ?)`,
          material.work_order_id,
          material.material_id,
          material.material_name,
          material.unit,
          material.assigned_quantity,
          material.used_quantity,
          material.remaining_quantity
        );
      }

      for (const attachment of order.attachments) {
        await db.runAsync(
          `insert into cached_work_order_attachments
            (id, work_order_id, file_name, mime_type, signed_url)
           values (?, ?, ?, ?, ?)`,
          attachment.id,
          attachment.work_order_id,
          attachment.file_name,
          attachment.mime_type,
          attachment.signed_url
        );
      }
    }
  });
}

export async function getCachedWorkOrders() {
  const db = await getDb();
  return db.getAllAsync<CachedWorkOrder>(
    `select *
     from cached_work_orders
     where status = 'in_progress'
     order by coalesce(scheduled_start, '') desc, title`
  );
}

export async function getCachedWorkOrder(workOrderId: string): Promise<CachedWorkOrderWithDetails | null> {
  const db = await getDb();
  const order = await db.getFirstAsync<CachedWorkOrder>("select * from cached_work_orders where id = ?", workOrderId);

  if (!order) {
    return null;
  }

  const [materials, attachments] = await Promise.all([
    db.getAllAsync<CachedWorkOrderMaterial>(
      "select * from cached_work_order_materials where work_order_id = ? order by material_name",
      workOrderId
    ),
    db.getAllAsync<CachedWorkOrderAttachment>(
      "select * from cached_work_order_attachments where work_order_id = ? order by file_name",
      workOrderId
    )
  ]);

  return { ...order, materials, attachments };
}

export async function enqueueDailyLog(workerId: string, log: CreateDailyLogInput) {
  const db = await getDb();
  const localId = createUuid();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `insert into pending_daily_logs
        (local_id, worker_id, work_order_id, location_id, work_date, performed_at, notes, sync_status, created_at)
       values (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      localId,
      workerId,
      log.work_order_id,
      log.location_id,
      log.work_date,
      log.performed_at,
      log.notes ?? null,
      new Date().toISOString()
    );

    for (const item of log.items) {
      await db.runAsync(
        "insert into pending_daily_log_items (id, local_log_id, material_id, quantity) values (?, ?, ?, ?)",
        createUuid(),
        localId,
        item.material_id,
        item.quantity
      );
    }
  });

  return localId;
}

export async function getPendingDailyLogs() {
  const db = await getDb();
  const logs = await db.getAllAsync<PendingDailyLog>(
    "select * from pending_daily_logs where sync_status in ('pending', 'error') order by created_at"
  );

  const result: Array<{ log: PendingDailyLog; items: PendingDailyLogItem[] }> = [];
  for (const log of logs) {
    const items = await db.getAllAsync<PendingDailyLogItem>(
      "select * from pending_daily_log_items where local_log_id = ?",
      log.local_id
    );
    result.push({ log, items });
  }

  return result;
}

export async function updateDailyLogSyncStatus(
  localId: string,
  status: PendingDailyLog["sync_status"],
  error: string | null = null
) {
  const db = await getDb();
  await db.runAsync(
    "update pending_daily_logs set sync_status = ?, sync_error = ? where local_id = ?",
    status,
    error,
    localId
  );
}

export async function countPendingDailyLogs() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "select count(*) as count from pending_daily_logs where sync_status in ('pending', 'error')"
  );
  return row?.count ?? 0;
}

export async function getPendingDailyLog(localId: string) {
  const db = await getDb();
  const log = await db.getFirstAsync<PendingDailyLog>(
    "select * from pending_daily_logs where local_id = ?",
    localId
  );

  if (!log) {
    return null;
  }

  const items = await db.getAllAsync<PendingDailyLogItem>(
    "select * from pending_daily_log_items where local_log_id = ?",
    localId
  );

  return { log, items };
}
