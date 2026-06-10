"use client";

import { useId, useState } from "react";

type PasswordFieldProps = {
  id?: string;
  name: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  defaultValue?: string;
  placeholder?: string;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path
          d="M2.5 12C4.5 7.5 8 5 12 5s7.5 2.5 9.5 7c-2 4.5-5.5 7-9.5 7s-7.5-2.5-9.5-7Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="12" fill="currentColor" r="2.5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path
        d="M3 3l18 18M10.5 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.2-1M6.7 6.8C8.2 5.8 10 5.2 12 5.2c4 0 7.5 2.5 9.5 7-.8 1.8-2 3.3-3.5 4.4M9.9 5.5A10.8 10.8 0 0 1 12 5c4 0 7.5 2.5 9.5 7-.6 1.4-1.5 2.6-2.6 3.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function PasswordField({
  id,
  name,
  required,
  minLength,
  autoComplete,
  defaultValue,
  placeholder
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        id={inputId}
        minLength={minLength}
        name={name}
        placeholder={placeholder}
        required={required}
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={visible ? "Sakrij lozinku" : "Prikazi lozinku"}
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}
