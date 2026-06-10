import { Text, TouchableOpacity, View } from "react-native";
import { sr } from "@znservis/i18n";
import { BrandLogo } from "@/ui/BrandLogo";
import { ResponsiveScreen } from "@/ui/ResponsiveScreen";
import { styles } from "@/ui/styles";

type HomeScreenProps = {
  pendingCount: number;
  workerName: string | null;
  onNewReport: () => void;
  onMyReports: () => void;
  onSync: () => void;
  onLogout: () => void;
};

export function HomeScreen({
  pendingCount,
  workerName,
  onNewReport,
  onMyReports,
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
          {pendingCount > 0 ? `${pendingCount} izvestaja ceka sinhronizaciju` : sr.sync.synced}
        </Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity onPress={onNewReport} style={styles.button}>
          <Text style={styles.buttonText}>{sr.report.new}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMyReports} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{sr.report.myReports}</Text>
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
