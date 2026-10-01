"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { registerAction } from "@/lib/auth/actions";
import { routes } from "@/lib/auth/routes";
import { PASSWORD_MIN_LENGTH, registerSchema, type RegisterInput } from "@/lib/auth/validation";
import { AuthDivider } from "./auth-divider";
import { GoogleButton } from "./google-button";
import { PasswordInput } from "./password-input";
import { PasswordStrengthMeter } from "./password-strength";

const FIELDS = ["name", "email", "password", "confirmPassword"] as const;
type FieldName = (typeof FIELDS)[number];

function isFieldName(value: string): value is FieldName {
  return (FIELDS as readonly string[]).includes(value);
}

export function RegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await registerAction(values);
      // A successful action redirects into the workspace; only failures come back.
      if (result && !result.ok) {
        setServerError(result.message);
        const [field, message] = Object.entries(result.fieldErrors ?? {})[0] ?? [];
        if (field && isFieldName(field)) {
          setError(field, { type: "server", message });
          setFocus(field);
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-busy={isPending}>
      {serverError ? <Alert>{serverError}</Alert> : null}

      <Field id="name" label="Full name" error={errors.name?.message}>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Ada Lovelace"
          disabled={isPending}
          {...fieldAria("name", errors.name?.message)}
          {...register("name")}
        />
      </Field>

      <Field id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          spellCheck={false}
          autoCapitalize="none"
          disabled={isPending}
          {...fieldAria("email", errors.email?.message)}
          {...register("email")}
        />
      </Field>

      <Field
        id="password"
        label="Password"
        error={errors.password?.message}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters with a letter and a number.`}
        footer={<PasswordStrengthMeter password={password ?? ""} />}
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          disabled={isPending}
          {...fieldAria("password", errors.password?.message, true)}
          {...register("password")}
        />
      </Field>

      <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Repeat your password"
          disabled={isPending}
          {...fieldAria("confirmPassword", errors.confirmPassword?.message)}
          {...register("confirmPassword")}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={isPending} loadingLabel="Creating your account…">
        Create account
      </Button>

      <AuthDivider />
      <GoogleButton label="Sign up with Google" />

      <p className="pt-2 text-center text-sm text-ink-300">
        Already have an account?{" "}
        <Link href={routes.login} className="font-medium text-ink-50 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
