import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { workOrderStatusLabels } from "@znservis/shared";
import { sr } from "@znservis/i18n";
import { getCachedWorkOrders, type CachedWorkOrder } from "@/lib/localDb";
import { BrandLogo } from "@/ui/BrandLogo";
import { ResponsiveScreen } from "@/ui/ResponsiveScreen";
import { styles } from "@/ui/styles";

type MyWorkOrdersScreenProps = {
  onBack: () => void;
  onOpen: (workOrderId: string) => void;
};

export function MyWorkOrdersScreen({ onBack, onOpen }: MyWorkOrdersScreenProps) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<CachedWorkOrder[]>([]);

  useEffect(() => {
    async function loadOrders() {
      setOrders(await getCachedWorkOrders());
      setLoading(false);
    }

    void loadOrders();
  }, []);

  return (
    <ResponsiveScreen>
      <View style={[styles.card, styles.homeHeroCard]}>
        <BrandLogo compact />
        <Text style={styles.title}>{sr.workOrder.myWorkOrders}</Text>
        <TouchableOpacity onPress={onBack} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Nazad</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator /> : null}

      {orders.map((order) => (
        <View key={order.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>{order.title}</Text>
            <Text style={styles.subtitle}>{workOrderStatusLabels[order.status]}</Text>
          </View>
          <Text>{order.location_name}</Text>
          {order.description ? <Text style={styles.subtitle}>{order.description}</Text> : null}
          {order.scheduled_start || order.scheduled_end ? (
            <Text style={styles.subtitle}>
              {order.scheduled_start ?? "?"} - {order.scheduled_end ?? "?"}
            </Text>
          ) : null}
          <TouchableOpacity onPress={() => onOpen(order.id)} style={styles.button}>
            <Text style={styles.buttonText}>Otvori nalog</Text>
          </TouchableOpacity>
        </View>
      ))}

      {!loading && orders.length === 0 ? (
        <View style={styles.card}>
          <Text>{sr.workOrder.noWorkOrders}</Text>
        </View>
      ) : null}
    </ResponsiveScreen>
  );
}
