import Image from "next/image";
import { sr } from "@znservis/i18n";
import { LoginForm } from "@/components/LoginForm";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="login">
      <section className="card">
        <div className="login-brand">
          <Image
            alt="ZN Servis"
            className="login-logo"
            height={120}
            priority
            src="/Logo-ZN.webp"
            width={320}
          />
        </div>
        <p className="muted login-tagline">{sr.app.tagline}</p>
        {params.error ? (
          <p style={{ color: "var(--danger)" }}>
            {params.error === "not_admin"
              ? "Nalog nema administratorska prava."
              : params.error === "no_profile"
                ? "Nalog nema profil u bazi. Kontaktirajte administratora."
              : params.error === "email_not_confirmed"
                ? "Email nije potvrdjen. Potvrdite nalog u Supabase ili kontaktirajte administratora."
                : "Pogresan email ili lozinka."}
          </p>
        ) : null}
        <LoginForm />
      </section>
    </main>
  );
}
