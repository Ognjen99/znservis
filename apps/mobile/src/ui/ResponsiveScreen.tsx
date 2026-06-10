import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, useWindowDimensions } from "react-native";
import type { ReactNode } from "react";
import { styles } from "@/ui/styles";

type ResponsiveScreenProps = {
  children: ReactNode;
  centered?: boolean;
  keyboardAvoiding?: boolean;
};

export function ResponsiveScreen({ children, centered = false, keyboardAvoiding = false }: ResponsiveScreenProps) {
  const { width } = useWindowDimensions();
  const padding = width < 360 ? 12 : 20;

  const content = (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.screenContent, centered ? styles.screenContentCentered : null, { padding }]}
        keyboardShouldPersistTaps="handled"
        style={styles.screenScroll}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );

  if (!keyboardAvoiding) {
    return content;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      {content}
    </KeyboardAvoidingView>
  );
}
