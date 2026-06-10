import NetInfo from "@react-native-community/netinfo";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Alert, AppState, BackHandler } from "react-native";
import type { CreateWorkReportInput } from "@znservis/shared";
import {
  countPendingReports,
  enqueueReport,
  getCatalog,
  getPendingReport,
  migrateLocalDb,
  updatePendingReport,
  type CatalogLocation,
  type CatalogMaterial
} from "@/lib/localDb";
import { flushReportOutbox, refreshCatalog, syncNow, updateRemoteReport } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import { HomeScreen } from "@/screens/HomeScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { MyReportsScreen, type EditableReportRef } from "@/screens/MyReportsScreen";
import { NewReportScreen, type ReportFormInitialValues } from "@/screens/NewReportScreen";

type Screen = "home" | "new-report" | "my-reports" | "edit-report";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [locations, setLocations] = useState<CatalogLocation[]>([]);
  const [materials, setMaterials] = useState<CatalogMaterial[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [editingReport, setEditingReport] = useState<EditableReportRef | null>(null);
  const [editInitialValues, setEditInitialValues] = useState<ReportFormInitialValues | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [workerName, setWorkerName] = useState<string | null>(null);

  async function loadWorkerProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    setWorkerName(data?.full_name ?? null);
  }

  async function loadLocalState() {
    const [{ locations: cachedLocations, materials: cachedMaterials }, count] = await Promise.all([
      getCatalog(),
      countPendingReports()
    ]);
    setLocations(cachedLocations);
    setMaterials(cachedMaterials);
    setPendingCount(count);
  }

  async function runSync() {
    try {
      await syncNow();
      await loadLocalState();
    } catch {
      await loadLocalState();
    }
  }

  useEffect(() => {
    async function bootstrap() {
      await migrateLocalDb();
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      await loadLocalState();
      if (data.session) {
        void loadWorkerProfile(data.session.user.id);
        void runSync();
      }
    }

    void bootstrap();

    const authSubscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void loadWorkerProfile(nextSession.user.id);
        void runSync();
      } else {
        setWorkerName(null);
      }
    });

    return () => authSubscription.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      if (state.isConnected && session) {
        void flushReportOutbox().then(loadLocalState);
      }
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && session) {
        void runSync();
      }
    });

    return () => {
      unsubscribeNetwork();
      appStateSubscription.remove();
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    function onBackPress() {
      if (screen === "home") {
        return false;
      }

      if (screen === "new-report") {
        setScreen("home");
        return true;
      }

      if (screen === "my-reports") {
        setScreen("home");
        return true;
      }

      if (screen === "edit-report") {
        setEditingReport(null);
        setEditInitialValues(null);
        setScreen("my-reports");
        return true;
      }

      return false;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [screen, session]);

  async function submitReport(report: CreateWorkReportInput) {
    if (!session?.user.id) return;

    await enqueueReport(session.user.id, report);
    await loadLocalState();
    Alert.alert("Sacuvano", "Izvestaj je sacuvan i bice sinhronizovan.");
    setScreen("home");
    void flushReportOutbox().then(loadLocalState);
  }

  async function openEditReport(reportRef: EditableReportRef) {
    setLoadingEdit(true);
    setEditingReport(reportRef);

    try {
      if (reportRef.source === "local") {
        const pending = await getPendingReport(reportRef.id);
        if (!pending) {
          Alert.alert("Greska", "Lokalni izvestaj nije pronadjen.");
          return;
        }

        setEditInitialValues({
          location_id: pending.report.location_id,
          performed_at: pending.report.performed_at,
          notes: pending.report.notes,
          items: pending.items.map((item) => ({
            material_id: item.material_id,
            quantity: item.quantity
          }))
        });
      } else {
        const { data, error } = await supabase
          .from("work_reports")
          .select("location_id, performed_at, notes, work_report_items(material_id, quantity)")
          .eq("id", reportRef.id)
          .single();

        if (error || !data) {
          Alert.alert("Greska", "Izvestaj nije pronadjen.");
          return;
        }

        setEditInitialValues({
          location_id: data.location_id,
          performed_at: data.performed_at,
          notes: data.notes,
          items: (data.work_report_items ?? []).map((item: { material_id: string; quantity: number }) => ({
            material_id: item.material_id,
            quantity: item.quantity
          }))
        });
      }

      setScreen("edit-report");
    } finally {
      setLoadingEdit(false);
    }
  }

  async function submitEditedReport(report: CreateWorkReportInput) {
    if (!editingReport) {
      return;
    }

    try {
      if (editingReport.source === "local") {
        await updatePendingReport(editingReport.id, report);
        await loadLocalState();
        Alert.alert("Sacuvano", "Lokalni izvestaj je azuriran.");
        void flushReportOutbox().then(loadLocalState);
      } else {
        await updateRemoteReport(editingReport.id, report);
        Alert.alert("Sacuvano", "Izvestaj je azuriran.");
      }

      setEditingReport(null);
      setEditInitialValues(null);
      setScreen("my-reports");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Greska pri cuvanju izvestaja.";
      Alert.alert("Greska", message);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setScreen("home");
    setSession(null);
    setWorkerName(null);
    setEditingReport(null);
    setEditInitialValues(null);
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (screen === "new-report") {
    return (
      <NewReportScreen
        locations={locations}
        materials={materials}
        onCancel={() => setScreen("home")}
        onSubmit={submitReport}
      />
    );
  }

  if (screen === "edit-report" && editInitialValues) {
    return (
      <NewReportScreen
        initialValues={editInitialValues}
        locations={locations}
        materials={materials}
        mode="edit"
        onCancel={() => {
          setEditingReport(null);
          setEditInitialValues(null);
          setScreen("my-reports");
        }}
        onSubmit={submitEditedReport}
      />
    );
  }

  if (screen === "my-reports") {
    return (
      <MyReportsScreen
        onBack={() => setScreen("home")}
        onEdit={(report) => {
          if (loadingEdit) {
            return;
          }
          void openEditReport(report);
        }}
      />
    );
  }

  return (
    <HomeScreen
      pendingCount={pendingCount}
      workerName={workerName}
      onLogout={logout}
      onMyReports={() => setScreen("my-reports")}
      onNewReport={() => {
        if (!locations.length || !materials.length) {
          Alert.alert("Katalog nije ucitan", "Sinhronizujte aplikaciju pre kreiranja izvestaja.");
          void refreshCatalog().then(loadLocalState);
          return;
        }
        setScreen("new-report");
      }}
      onSync={runSync}
    />
  );
}
