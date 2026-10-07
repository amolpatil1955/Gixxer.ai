import "server-only";
import { AuthServiceError } from "./errors";
import { getDummyPasswordHash, hashPassword, verifyPassword } from "./password";
import {
  applyAdminBootstrap,
  createUser,
  findUserByEmail,
  isDuplicateKeyError,
  recordLogin,
  type UserRecord,
} from "./user-repository";
import type { RegisterValues } from "./validation";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  sessionVersion: number;
}

function toAuthenticatedUser(user: UserRecord): AuthenticatedUser {
  return { id: user.id, name: user.name, email: user.email, image: user.image, sessionVersion: user.sessionVersion };
}

/**
 * Creates a credentials account. Relies on the unique email index for
 * correctness under concurrent requests rather than a check-then-insert.
 */
export async function registerUser(
  input: Pick<RegisterValues, "name" | "email" | "password">,
): Promise<AuthenticatedUser> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await createUser({ name: input.name, email: input.email, passwordHash });
    return toAuthenticatedUser(user);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AuthServiceError("EMAIL_TAKEN", "An account with this email already exists.");
    }
    throw error;
  }
}

/**
 * Returns the user when the email/password pair is valid, otherwise null.
 * Unknown emails still run a hash comparison so timing does not reveal
 * whether an account exists.
 */
export async function verifyCredentials(email: string, password: string): Promise<AuthenticatedUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) {
    await verifyPassword(password, await getDummyPasswordHash());
    return null;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  await recordLogin(user.id);
  // A listed owner gets the admin role here, so a fresh database needs no hand editing.
  await applyAdminBootstrap(user.email);
  return toAuthenticatedUser(user);
}
