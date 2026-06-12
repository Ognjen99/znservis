import NetInfo from "@react-native-community/netinfo";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Alert, AppState, BackHandler } from "react-native";
import type { CreateDailyLogInput } from "@znservis/shared";
import {
  countPendingDailyLogs,
  enqueueDailyLog,
  getCachedWorkOrder,
  migrateLocalDb,
  type CachedWorkOrderWithDetails
} from "@/lib/localDb";
import { flushDailyLogOutbox, refreshWorkOrders, syncNow } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import { HomeScreen } from "@/screens/HomeScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { MyDailyLogsScreen } from "@/screens/MyDailyLogsScreen";
import { MyWorkOrdersScreen } from "@/screens/MyWorkOrdersScreen";
import { NewDailyLogScreen } from "@/screens/NewDailyLogScreen";
import { WorkOrderDetailScreen } from "@/screens/WorkOrderDetailScreen";

type Screen = "home" | "work-orders" | "work-order-detail" | "new-daily-log" | "daily-logs";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [dailyLogOrder, setDailyLogOrder] = useState<CachedWorkOrderWithDetails | null>(null);
  const [workerName, setWorkerName] = useState<string | null>(null);

  async function loadWorkerProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    setWorkerName(data?.full_name ?? null);
  }

  async function loadLocalState() {
    const count = await countPendingDailyLogs();
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
        void flushDailyLogOutbox().then(runSync);
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

      if (screen === "work-orders" || screen === "daily-logs") {
        setScreen("home");
        return true;
      }

      if (screen === "work-order-detail") {
        setSelectedWorkOrderId(null);
        setScreen("work-orders");
        return true;
      }

      if (screen === "new-daily-log") {
        setDailyLogOrder(null);
        setScreen("work-order-detail");
        return true;
      }

      return false;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [screen, session]);

  async function submitDailyLog(log: CreateDailyLogInput) {
    if (!session?.user.id) return;

    await enqueueDailyLog(session.user.id, log);
    await loadLocalState();
    Alert.alert("Sacuvano", "Dnevni zapis je sacuvan i bice sinhronizovan.");
    setDailyLogOrder(null);
    setScreen("work-order-detail");
    void flushDailyLogOutbox().then(runSync);
  }

  async function openNewDailyLog(workOrderId: string) {
    const order = await getCachedWorkOrder(workOrderId);
    if (!order) {
      Alert.alert("Greska", "Radni nalog nije pronadjen. Sinhronizujte aplikaciju.");
      return;
    }

    setDailyLogOrder(order);
    setScreen("new-daily-log");
  }

  async function logout() {
    await supabase.auth.signOut();
    setScreen("home");
    setSession(null);
    setWorkerName(null);
    setSelectedWorkOrderId(null);
    setDailyLogOrder(null);
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (screen === "work-orders") {
    return (
      <MyWorkOrdersScreen
        onBack={() => setScreen("home")}
        onOpen={(workOrderId) => {
          setSelectedWorkOrderId(workOrderId);
          setScreen("work-order-detail");
        }}
      />
    );
  }

  if (screen === "work-order-detail" && selectedWorkOrderId) {
    return (
      <WorkOrderDetailScreen
        workOrderId={selectedWorkOrderId}
        onBack={() => setScreen("work-orders")}
        onNewDailyLog={(workOrderId) => void openNewDailyLog(workOrderId)}
      />
    );
  }

  if (screen === "new-daily-log" && dailyLogOrder) {
    return (
      <NewDailyLogScreen
        workOrder={dailyLogOrder}
        onCancel={() => {
          setDailyLogOrder(null);
          setScreen("work-order-detail");
        }}
        onSubmit={submitDailyLog}
      />
    );
  }

  if (screen === "daily-logs") {
    return <MyDailyLogsScreen onBack={() => setScreen("home")} />;
  }

  return (
    <HomeScreen
      pendingCount={pendingCount}
      workerName={workerName}
      onLogout={logout}
      onMyDailyLogs={() => setScreen("daily-logs")}
      onMyWorkOrders={() => {
        setScreen("work-orders");
        void refreshWorkOrders();
      }}
      onSync={runSync}
    />
  );
}
