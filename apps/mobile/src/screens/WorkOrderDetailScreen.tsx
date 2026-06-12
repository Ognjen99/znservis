import { useEffect, useState } from "react";
import { Alert, Linking, Text, TouchableOpacity, View } from "react-native";
import { workOrderStatusLabels } from "@znservis/shared";
import { sr } from "@znservis/i18n";
import { getCachedWorkOrder, type CachedWorkOrderWithDetails } from "@/lib/localDb";
import { completeWorkOrder, flushDailyLogOutbox, syncNow } from "@/lib/sync";
import { BrandLogo } from "@/ui/BrandLogo";
import { ResponsiveScreen } from "@/ui/ResponsiveScreen";
import { styles } from "@/ui/styles";

type WorkOrderDetailScreenProps = {
  workOrderId: string;
  onBack: () => void;
  onNewDailyLog: (workOrderId: string) => void;
};

export function WorkOrderDetailScreen({ workOrderId, onBack, onNewDailyLog }: WorkOrderDetailScreenProps) {
  const [order, setOrder] = useState<CachedWorkOrderWithDetails | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      setOrder(await getCachedWorkOrder(workOrderId));
    }

    void loadOrder();
  }, [workOrderId]);

  async function openAttachment(url: string | null) {
    if (!url) {
      Alert.alert("Greska", "Prilog trenutno nije dostupan. Sinhronizujte aplikaciju.");
      return;
    }

    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Greska", "Telefon ne moze da otvori ovaj prilog.");
      return;
    }

    await Linking.openURL(url);
  }

  function confirmComplete() {
    Alert.alert(
      sr.workOrder.complete,
      "Da li ste sigurni da je posao zavrsen? Nalog ce biti poslat administratoru u izvestaje.",
      [
        { text: sr.common.cancel, style: "cancel" },
        {
          text: sr.workOrder.complete,
          style: "destructive",
          onPress: () => {
            void handleComplete();
          }
        }
      ]
    );
  }

  async function handleComplete() {
    setCompleting(true);

    try {
      await flushDailyLogOutbox();
      await completeWorkOrder(workOrderId);
      await syncNow();
      Alert.alert("Uspesno", "Radni nalog je zavrsen.", [{ text: "OK", onPress: onBack }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepoznata greska";
      Alert.alert("Greska", message);
    } finally {
      setCompleting(false);
    }
  }

  if (!order) {
    return (
      <ResponsiveScreen>
        <View style={styles.card}>
          <Text>{sr.common.loading}</Text>
          <TouchableOpacity onPress={onBack} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Nazad</Text>
          </TouchableOpacity>
        </View>
      </ResponsiveScreen>
    );
  }

  const canAddLog = order.status === "in_progress";

  return (
    <ResponsiveScreen>
      <View style={[styles.card, styles.homeHeroCard]}>
        <BrandLogo compact />
        <Text style={styles.title}>{order.title}</Text>
        <Text style={styles.subtitle}>{workOrderStatusLabels[order.status]}</Text>
        <Text>{order.location_name}</Text>
        {order.description ? <Text style={styles.subtitle}>{order.description}</Text> : null}
        <TouchableOpacity onPress={onBack} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Nazad</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{sr.workOrder.assignedMaterials}</Text>
        {order.materials.map((material) => (
          <View key={material.material_id} style={styles.itemRow}>
            <Text style={{ flex: 1 }}>
              {material.material_name}: {material.used_quantity}/{material.assigned_quantity} {material.unit}
            </Text>
            <Text style={styles.subtitle}>
              {sr.workOrder.remainingQuantity}: {material.remaining_quantity} {material.unit}
            </Text>
          </View>
        ))}
        {order.materials.length === 0 ? <Text style={styles.subtitle}>{sr.common.empty}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{sr.workOrder.planAttachments}</Text>
        {order.attachments.map((attachment) => (
          <TouchableOpacity
            key={attachment.id}
            onPress={() => void openAttachment(attachment.signed_url)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>{attachment.file_name}</Text>
          </TouchableOpacity>
        ))}
        {order.attachments.length === 0 ? <Text style={styles.subtitle}>{sr.common.empty}</Text> : null}
      </View>

      <View style={styles.card}>
        {canAddLog ? (
          <>
            <TouchableOpacity onPress={() => onNewDailyLog(order.id)} style={styles.button}>
              <Text style={styles.buttonText}>{sr.workOrder.newDailyLog}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={completing}
              onPress={confirmComplete}
              style={[styles.secondaryButton, { marginTop: 12 }]}
            >
              <Text style={styles.secondaryButtonText}>
                {completing ? sr.common.loading : sr.workOrder.complete}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.subtitle}>Dnevni zapis nije dozvoljen za ovaj status naloga.</Text>
        )}
      </View>
    </ResponsiveScreen>
  );
}
