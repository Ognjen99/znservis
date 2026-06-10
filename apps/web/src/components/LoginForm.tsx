"use client";

import { sr } from "@znservis/i18n";
import { useFormStatus } from "react-dom";
import { signInAction } from "@/app/actions";
import { PasswordField } from "@/components/PasswordField";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? sr.common.loading : sr.auth.login}
    </button>
  );
}

export function LoginForm() {
  return (
    <form action={signInAction} className="form">
      <div className="field">
        <label htmlFor="email">{sr.auth.email}</label>
        <input autoComplete="username" id="email" name="email" required type="email" />
      </div>
      <div className="field">
        <label htmlFor="password">{sr.auth.password}</label>
        <PasswordField autoComplete="current-password" id="password" minLength={6} name="password" required />
      </div>
      <SubmitButton />
    </form>
  );
}
