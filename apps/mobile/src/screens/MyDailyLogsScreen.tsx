import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { sr } from "@znservis/i18n";
import { getCachedWorkOrder, getPendingDailyLogs } from "@/lib/localDb";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/ui/BrandLogo";
import { ResponsiveScreen } from "@/ui/ResponsiveScreen";
import { styles } from "@/ui/styles";

type DailyLogRow = {
  id: string;
  source: "local" | "remote";
  performed_at: string;
  notes: string | null;
  workOrderTitle: string;
  items: Array<{
    quantity: number;
    materialName: string;
    unit: string;
  }>;
  syncStatus?: string;
};

type RemoteRelation<T> = T | T[] | null;

type RemoteDailyLogRecord = {
  id: string;
  performed_at: string;
  notes: string | null;
  work_orders: RemoteRelation<{ title: string }>;
  work_report_items: Array<{
    quantity: number;
    materials: RemoteRelation<{ name: string; unit: string }>;
  }>;
};

type MyDailyLogsScreenProps = {
  onBack: () => void;
};

function firstRelation<T>(relation: RemoteRelation<T>) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export function MyDailyLogsScreen({ onBack }: MyDailyLogsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<DailyLogRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function loadLogs() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      const [pending, remote] = await Promise.all([
        getPendingDailyLogs(),
        user
          ? supabase
              .from("work_reports")
              .select("id, performed_at, notes, work_orders(title), work_report_items(quantity, materials(name, unit))")
              .eq("worker_id", user.id)
              .not("work_order_id", "is", null)
              .order("performed_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] })
      ]);

      const pendingRows: DailyLogRow[] = [];
      for (const { log, items } of pending) {
        const order = await getCachedWorkOrder(log.work_order_id);
        const materialById = Object.fromEntries((order?.materials ?? []).map((material) => [material.material_id, material]));

        pendingRows.push({
          id: log.local_id,
          source: "local",
          performed_at: log.performed_at,
          notes: log.notes,
          workOrderTitle: order?.title ?? log.work_order_id,
          syncStatus: log.sync_status,
          items: items.map((item) => ({
            quantity: item.quantity,
            materialName: materialById[item.material_id]?.material_name ?? item.material_id,
            unit: materialById[item.material_id]?.unit ?? ""
          }))
        });
      }

      const remoteRows: DailyLogRow[] = ((remote.data ?? []) as RemoteDailyLogRecord[]).map((log) => {
        const order = firstRelation(log.work_orders);

        return {
          id: log.id,
          source: "remote",
          performed_at: log.performed_at,
          notes: log.notes,
          workOrderTitle: order?.title ?? "-",
          items: log.work_report_items.map((item) => {
            const material = firstRelation(item.materials);

            return {
              quantity: item.quantity,
              materialName: material?.name ?? "Materijal",
              unit: material?.unit ?? ""
            };
          })
        };
      });

      setPendingCount(pending.length);
      setLogs(
        [...pendingRows, ...remoteRows].sort(
          (left, right) => new Date(right.performed_at).getTime() - new Date(left.performed_at).getTime()
        )
      );
      setLoading(false);
    }

    void loadLogs();
  }, []);

  return (
    <ResponsiveScreen>
      <View style={[styles.card, styles.homeHeroCard]}>
        <BrandLogo compact />
        <Text style={styles.title}>{sr.workOrder.dailyLogs}</Text>
        <Text style={styles.subtitle}>
          {pendingCount > 0 ? `${pendingCount} dnevnih zapisa ceka sinhronizaciju.` : sr.sync.synced}
        </Text>
        <TouchableOpacity onPress={onBack} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Nazad</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator /> : null}

      {logs.map((log) => (
        <View key={`${log.source}-${log.id}`} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>{new Date(log.performed_at).toLocaleDateString("sr-RS")}</Text>
            {log.source === "local" ? (
              <Text style={styles.subtitle}>{log.syncStatus === "error" ? sr.sync.error : sr.sync.pending}</Text>
            ) : null}
          </View>
          <Text>{log.workOrderTitle}</Text>
          {log.items.map((item, index) => (
            <Text key={`${log.id}-${index}`} style={styles.subtitle}>
              {item.materialName}: {item.quantity} {item.unit}
            </Text>
          ))}
          {log.notes ? <Text>{log.notes}</Text> : null}
        </View>
      ))}

      {!loading && logs.length === 0 ? (
        <View style={styles.card}>
          <Text>{sr.common.empty}</Text>
        </View>
      ) : null}
    </ResponsiveScreen>
  );
}
