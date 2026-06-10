import { useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { sr } from "@znservis/i18n";
import { workerAuthEmail } from "@znservis/shared";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/ui/BrandLogo";
import { ResponsiveScreen } from "@/ui/ResponsiveScreen";
import { styles, colors } from "@/ui/styles";

export function LoginScreen() {
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);

    const trimmedName = loginName.trim();
    if (trimmedName.length < 2) {
      setLoading(false);
      setError("Unesite ime radnika.");
      return;
    }

    const email = workerAuthEmail(trimmedName);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError("Pogresno ime ili lozinka.");
    }
  }

  return (
    <ResponsiveScreen centered keyboardAvoiding>
      <View style={styles.card}>
        <BrandLogo />
        <Text style={styles.title}>{sr.app.name}</Text>
        <Text style={styles.subtitle}>{sr.app.tagline}</Text>
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        <Text style={styles.label}>{sr.auth.name}</Text>
        <TextInput
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={setLoginName}
          style={styles.input}
          value={loginName}
        />
        <Text style={styles.label}>{sr.auth.password}</Text>
        <TextInput onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />
        <TouchableOpacity disabled={loading} onPress={signIn} style={styles.button}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{sr.auth.login}</Text>}
        </TouchableOpacity>
      </View>
    </ResponsiveScreen>
  );
}
