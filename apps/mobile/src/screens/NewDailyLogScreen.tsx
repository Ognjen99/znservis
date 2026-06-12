import { Picker } from "@react-native-picker/picker";
import { useMemo, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CreateDailyLogSchema, type CreateDailyLogInput } from "@znservis/shared";
import { sr } from "@znservis/i18n";
import type { CachedWorkOrderWithDetails } from "@/lib/localDb";
import { BrandLogo } from "@/ui/BrandLogo";
import { ResponsiveScreen } from "@/ui/ResponsiveScreen";
import { styles } from "@/ui/styles";

type DraftItem = {
  material_id: string;
  quantity: number;
};

type NewDailyLogScreenProps = {
  workOrder: CachedWorkOrderWithDetails;
  onCancel: () => void;
  onSubmit: (log: CreateDailyLogInput) => Promise<void>;
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function NewDailyLogScreen({ workOrder, onCancel, onSubmit }: NewDailyLogScreenProps) {
  const availableMaterials = workOrder.materials.filter((material) => material.remaining_quantity > 0);
  const [workDate, setWorkDate] = useState(todayDate());
  const [materialId, setMaterialId] = useState(availableMaterials[0]?.material_id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  const materialById = useMemo(
    () => Object.fromEntries(workOrder.materials.map((material) => [material.material_id, material])),
    [workOrder.materials]
  );

  function usedInDraft(nextMaterialId: string) {
    return items
      .filter((item) => item.material_id === nextMaterialId)
      .reduce((total, item) => total + item.quantity, 0);
  }

  function addItem() {
    const material = materialById[materialId];
    const parsedQuantity = Number(quantity);

    if (!material || Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert("Greska", "Izaberite materijal i unesite kolicinu vecu od nule.");
      return;
    }

    const remainingAfterDraft = material.remaining_quantity - usedInDraft(material.material_id);
    if (parsedQuantity > remainingAfterDraft) {
      Alert.alert("Greska", `Preostalo je ${remainingAfterDraft} ${material.unit}.`);
      return;
    }

    setItems((current) => [...current, { material_id: material.material_id, quantity: parsedQuantity }]);
    setQuantity("1");
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function saveLog() {
    const parsed = CreateDailyLogSchema.safeParse({
      work_order_id: workOrder.id,
      location_id: workOrder.location_id,
      work_date: workDate,
      performed_at: `${workDate}T12:00:00.000Z`,
      notes: notes.trim() || null,
      items
    });

    if (!parsed.success) {
      Alert.alert("Greska", "Unesite datum i dodajte bar jedan dodeljeni materijal.");
      return;
    }

    setSaving(true);
    await onSubmit(parsed.data);
    setSaving(false);
  }

  return (
    <ResponsiveScreen keyboardAvoiding>
      <View style={styles.card}>
        <BrandLogo compact />
        <Text style={styles.title}>{sr.workOrder.newDailyLog}</Text>
        <Text style={styles.subtitle}>{workOrder.title}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{sr.report.date}</Text>
        <TextInput
          onChangeText={setWorkDate}
          placeholder="YYYY-MM-DD"
          style={styles.input}
          value={workDate}
        />

        <Text style={styles.label}>{sr.report.material}</Text>
        <View style={styles.input}>
          <Picker selectedValue={materialId} onValueChange={setMaterialId}>
            {availableMaterials.map((material) => (
              <Picker.Item
                key={material.material_id}
                label={`${material.material_name} (${material.remaining_quantity} ${material.unit})`}
                value={material.material_id}
              />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>{sr.report.quantity}</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setQuantity}
          style={styles.input}
          value={quantity}
        />
        <TouchableOpacity disabled={availableMaterials.length === 0} onPress={addItem} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Dodaj materijal</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{sr.report.materials}</Text>
        {items.map((item, index) => {
          const material = materialById[item.material_id];
          return (
            <View key={`${item.material_id}-${index}`} style={styles.itemRow}>
              <Text style={{ flex: 1 }}>
                {material?.material_name ?? item.material_id}: {item.quantity} {material?.unit ?? ""}
              </Text>
              <TouchableOpacity
                accessibilityLabel="Ukloni materijal"
                onPress={() => removeItem(index)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>x</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {items.length === 0 ? <Text style={styles.subtitle}>{sr.common.empty}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{sr.report.notes}</Text>
        <TextInput
          multiline
          numberOfLines={4}
          onChangeText={setNotes}
          style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
          value={notes}
        />
        <TouchableOpacity disabled={saving} onPress={saveLog} style={styles.button}>
          <Text style={styles.buttonText}>{saving ? sr.common.loading : sr.common.save}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{sr.common.cancel}</Text>
        </TouchableOpacity>
      </View>
    </ResponsiveScreen>
  );
}
