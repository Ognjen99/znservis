import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { sr } from "@znservis/i18n";
import { getCatalog, getPendingReports } from "@/lib/localDb";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/ui/BrandLogo";
import { ResponsiveScreen } from "@/ui/ResponsiveScreen";
import { styles } from "@/ui/styles";

export type EditableReportRef = {
  source: "local" | "remote";
  id: string;
};

type ReportRow = {
  id: string;
  source: "local" | "remote";
  performed_at: string;
  notes: string | null;
  locationName: string;
  items: Array<{
    quantity: number;
    materialName: string;
    unit: string;
  }>;
  syncStatus?: string;
};

type RemoteRelation<T> = T | T[] | null;

type RemoteReportRecord = {
  id: string;
  performed_at: string;
  notes: string | null;
  locations: RemoteRelation<{ name: string }>;
  work_report_items: Array<{
    quantity: number;
    materials: RemoteRelation<{ name: string; unit: string }>;
  }>;
};

type MyReportsScreenProps = {
  onBack: () => void;
  onEdit: (report: EditableReportRef) => void;
};

function firstRelation<T>(relation: RemoteRelation<T>) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export function MyReportsScreen({ onBack, onEdit }: MyReportsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function loadReports() {
      const [pending, remote, catalog] = await Promise.all([
        getPendingReports(),
        supabase
          .from("work_reports")
          .select("id, performed_at, notes, locations(name), work_report_items(quantity, materials(name, unit))")
          .order("performed_at", { ascending: false })
          .limit(50),
        getCatalog()
      ]);

      const locationById = Object.fromEntries(catalog.locations.map((location) => [location.id, location.name]));
      const materialById = Object.fromEntries(catalog.materials.map((material) => [material.id, material]));

      const pendingRows: ReportRow[] = pending.map(({ report, items }) => ({
        id: report.local_id,
        source: "local",
        performed_at: report.performed_at,
        notes: report.notes,
        locationName: locationById[report.location_id] ?? "-",
        syncStatus: report.sync_status,
        items: items.map((item) => ({
          quantity: item.quantity,
          materialName: materialById[item.material_id]?.name ?? item.material_id,
          unit: materialById[item.material_id]?.unit ?? ""
        }))
      }));

      const remoteRows: ReportRow[] = ((remote.data ?? []) as RemoteReportRecord[]).map((report) => {
        const location = firstRelation(report.locations);

        return {
          id: report.id,
          source: "remote",
          performed_at: report.performed_at,
          notes: report.notes,
          locationName: location?.name ?? "-",
          items: report.work_report_items.map((item) => {
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
      setReports(
        [...pendingRows, ...remoteRows].sort(
          (left, right) => new Date(right.performed_at).getTime() - new Date(left.performed_at).getTime()
        )
      );
      setLoading(false);
    }

    void loadReports();
  }, []);

  return (
    <ResponsiveScreen>
      <View style={[styles.card, styles.homeHeroCard]}>
        <BrandLogo compact />
        <Text style={styles.title}>{sr.report.myReports}</Text>
        <Text style={styles.subtitle}>
          {pendingCount > 0 ? `${pendingCount} lokalnih izvestaja jos nije poslato.` : sr.sync.synced}
        </Text>
        <TouchableOpacity onPress={onBack} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Nazad</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator /> : null}

      {reports.map((report) => (
        <View key={`${report.source}-${report.id}`} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>{new Date(report.performed_at).toLocaleString("sr-RS")}</Text>
            {report.source === "local" ? (
              <Text style={styles.subtitle}>{report.syncStatus === "error" ? sr.sync.error : sr.sync.pending}</Text>
            ) : null}
          </View>
          <Text>{report.locationName}</Text>
          {report.items.map((item, index) => (
            <Text key={`${report.id}-${index}`} style={styles.subtitle}>
              {item.materialName}: {item.quantity} {item.unit}
            </Text>
          ))}
          {report.notes ? <Text>{report.notes}</Text> : null}
          <TouchableOpacity
            onPress={() => onEdit({ source: report.source, id: report.id })}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>{sr.common.edit}</Text>
          </TouchableOpacity>
        </View>
      ))}

      {!loading && reports.length === 0 ? (
        <View style={styles.card}>
          <Text>{sr.report.noReports}</Text>
        </View>
      ) : null}
    </ResponsiveScreen>
  );
}
