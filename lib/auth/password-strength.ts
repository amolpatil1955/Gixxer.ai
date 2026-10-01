import { PASSWORD_MIN_LENGTH } from "./validation";

export interface PasswordStrength {
  /** 0 (empty) to 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
}

/** Lightweight, dependency-free strength heuristic for UI feedback only. */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { score: password.length === 0 ? 0 : 1, label: "Too short" };
  }

  let points = 0;
  if (password.length >= 12) points += 1;
  if (password.length >= 16) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^\p{L}\d]/u.test(password)) points += 1;
  if (/^(.)\1+$/.test(password)) points = 0;

  if (points <= 1) return { score: 1, label: "Weak" };
  if (points === 2) return { score: 2, label: "Fair" };
  if (points === 3) return { score: 3, label: "Good" };
  return { score: 4, label: "Strong" };
}
