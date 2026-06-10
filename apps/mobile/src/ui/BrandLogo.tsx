import { Image } from "react-native";
import { styles } from "@/ui/styles";

const logo = require("../../assets/Logo-ZN.webp");

type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return <Image resizeMode="contain" source={logo} style={compact ? styles.headerLogo : styles.logo} />;
}
