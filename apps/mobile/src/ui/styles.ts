import { StyleSheet } from "react-native";

export const colors = {
  background: "#f6f7f9",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  border: "#dbe1ea",
  primary: "#0f766e",
  danger: "#b91c1c"
};

export const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1
  },
  screenScroll: {
    flex: 1
  },
  screenContent: {
    alignSelf: "center",
    flexGrow: 1,
    gap: 16,
    maxWidth: 720,
    width: "100%"
  },
  screenContentCentered: {
    justifyContent: "center"
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#fff",
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 12
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "800"
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  itemRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: "#fee2e2",
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22
  },
  logo: {
    alignSelf: "center",
    borderRadius: 12,
    aspectRatio: 3.8,
    marginBottom: 8,
    maxWidth: 320,
    width: "100%"
  },
  headerLogo: {
    alignSelf: "flex-start",
    aspectRatio: 3.8,
    borderRadius: 10,
    marginBottom: 4,
    maxWidth: 220,
    width: "70%"
  },
  homeHeroCard: {
    marginTop: 40
  }
});
