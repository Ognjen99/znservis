import { Picker } from "@react-native-picker/picker";
import { useEffect, useMemo, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CreateWorkReportSchema, type CreateWorkReportInput } from "@znservis/shared";
import { sr } from "@znservis/i18n";
import type { CatalogLocation, CatalogMaterial } from "@/lib/localDb";
import { BrandLogo } from "@/ui/BrandLogo";
import { ResponsiveScreen } from "@/ui/ResponsiveScreen";
import { styles, colors } from "@/ui/styles";

type DraftItem = {
  material_id: string;
  quantity: number;
};

export type ReportFormInitialValues = {
  location_id: string;
  performed_at: string;
  notes: string | null;
  items: DraftItem[];
};

type NewReportScreenProps = {
  locations: CatalogLocation[];
  materials: CatalogMaterial[];
  mode?: "create" | "edit";
  initialValues?: ReportFormInitialValues;
  onCancel: () => void;
  onSubmit: (report: CreateWorkReportInput) => Promise<void>;
};

export function NewReportScreen({
  locations,
  materials,
  mode = "create",
  initialValues,
  onCancel,
  onSubmit
}: NewReportScreenProps) {
  const [locationId, setLocationId] = useState(initialValues?.location_id ?? locations[0]?.id ?? "");
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [items, setItems] = useState<DraftItem[]>(initialValues?.items ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initialValues) {
      return;
    }

    setLocationId(initialValues.location_id);
    setNotes(initialValues.notes ?? "");
    setItems(initialValues.items);
  }, [initialValues]);

  const materialById = useMemo(
    () => Object.fromEntries(materials.map((material) => [material.id, material])),
    [materials]
  );

  function addItem() {
    const parsedQuantity = Number(quantity);
    if (!materialId || Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert("Greska", "Izaberite materijal i unesite kolicinu vecu od nule.");
      return;
    }

    setItems((current) => [...current, { material_id: materialId, quantity: parsedQuantity }]);
    setQuantity("1");
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function saveReport() {
    const parsed = CreateWorkReportSchema.safeParse({
      location_id: locationId,
      performed_at: initialValues?.performed_at ?? new Date().toISOString(),
      notes: notes.trim() || null,
      items
    });

    if (!parsed.success) {
      Alert.alert("Greska", "Izaberite lokaciju i dodajte bar jedan materijal.");
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
        <Text style={styles.title}>{mode === "edit" ? sr.report.edit : sr.report.new}</Text>
        <Text style={styles.subtitle}>Izvestaj se prvo cuva na telefonu, zatim se sinhronizuje.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{sr.report.location}</Text>
        <View style={styles.input}>
          <Picker selectedValue={locationId} onValueChange={setLocationId}>
            {locations.map((location) => (
              <Picker.Item key={location.id} label={location.name} value={location.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>{sr.report.material}</Text>
        <View style={styles.input}>
          <Picker selectedValue={materialId} onValueChange={setMaterialId}>
            {materials.map((material) => (
              <Picker.Item
                key={material.id}
                label={`${material.name} (${material.unit})`}
                value={material.id}
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
        <TouchableOpacity onPress={addItem} style={styles.secondaryButton}>
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
                {material?.name ?? item.material_id}: {item.quantity} {material?.unit ?? ""}
              </Text>
              <TouchableOpacity
                accessibilityLabel="Ukloni materijal"
                onPress={() => removeItem(index)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>×</Text>
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
        <TouchableOpacity disabled={saving} onPress={saveReport} style={styles.button}>
          <Text style={styles.buttonText}>{saving ? sr.common.loading : sr.common.save}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{sr.common.cancel}</Text>
        </TouchableOpacity>
      </View>
    </ResponsiveScreen>
  );
}
