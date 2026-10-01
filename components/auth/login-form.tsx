"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/lib/auth/actions";
import { routes } from "@/lib/auth/routes";
import { loginSchema, type LoginInput } from "@/lib/auth/validation";
import { AuthDivider } from "./auth-divider";
import { GoogleButton } from "./google-button";
import { PasswordInput } from "./password-input";

interface LoginFormProps {
  nextPath: string;
  notice?: string;
}

export function LoginForm({ nextPath, notice }: LoginFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(values, nextPath);
      // A successful action redirects; only failures come back.
      if (result && !result.ok) {
        setServerError(result.message);
        const [field, message] = Object.entries(result.fieldErrors ?? {})[0] ?? [];
        if (field === "email" || field === "password") {
          setError(field, { type: "server", message });
          setFocus(field);
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-busy={isPending}>
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {serverError ? <Alert>{serverError}</Alert> : null}

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

      <Field id="password" label="Password" error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder="Your password"
          disabled={isPending}
          {...fieldAria("password", errors.password?.message)}
          {...register("password")}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={isPending} loadingLabel="Signing in…">
        Sign in
      </Button>

      <AuthDivider />
      <GoogleButton label="Continue with Google" />

      <p className="pt-2 text-center text-sm text-ink-300">
        New to Gixxer.ai?{" "}
        <Link href={routes.register} className="font-medium text-ink-50 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
