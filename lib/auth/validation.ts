import { z } from "zod";

/** Shared between the browser (instant feedback) and the server (source of truth). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 80;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

export const passwordSchema = z
  .string()
  .min(1, "Password is required")
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/\p{L}/u, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name")
  .max(NAME_MAX_LENGTH, "Name is too long")
  .regex(/^[\p{L}\p{M}\d' .\-]+$/u, "Name contains unsupported characters");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(PASSWORD_MAX_LENGTH, "Password is too long"),
});

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterValues = z.output<typeof registerSchema>;
