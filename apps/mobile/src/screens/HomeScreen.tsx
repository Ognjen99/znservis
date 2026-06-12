import { Text, TouchableOpacity, View } from "react-native";
import { sr } from "@znservis/i18n";
import { BrandLogo } from "@/ui/BrandLogo";
import { ResponsiveScreen } from "@/ui/ResponsiveScreen";
import { styles } from "@/ui/styles";

type HomeScreenProps = {
  pendingCount: number;
  workerName: string | null;
  onMyWorkOrders: () => void;
  onMyDailyLogs: () => void;
  onSync: () => void;
  onLogout: () => void;
};

export function HomeScreen({
  pendingCount,
  workerName,
  onMyWorkOrders,
  onMyDailyLogs,
  onSync,
  onLogout
}: HomeScreenProps) {
  return (
    <ResponsiveScreen>
      <View style={[styles.card, styles.homeHeroCard]}>
        <BrandLogo compact />
        <Text style={styles.title}>{sr.app.name}</Text>
        {workerName ? <Text style={styles.subtitle}>{workerName}</Text> : null}
        <Text style={styles.subtitle}>
          {pendingCount > 0 ? `${pendingCount} dnevnih zapisa ceka sinhronizaciju` : sr.sync.synced}
        </Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity onPress={onMyWorkOrders} style={styles.button}>
          <Text style={styles.buttonText}>{sr.workOrder.myWorkOrders}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMyDailyLogs} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{sr.workOrder.dailyLogs}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSync} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sinhronizuj sada</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogout} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{sr.auth.logout}</Text>
        </TouchableOpacity>
      </View>
    </ResponsiveScreen>
  );
}
