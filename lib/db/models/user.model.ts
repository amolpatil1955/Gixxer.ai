import "server-only";
import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

export const AUTH_PROVIDERS = ["credentials", "google"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/**
 * What an account may do. An admin may read the user list and sign in as another
 * account for support; everything else about the two roles is identical.
 */
export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    /** Null for accounts created through an OAuth provider. */
    passwordHash: { type: String, default: null },
    image: { type: String, default: null },
    provider: { type: String, enum: AUTH_PROVIDERS, required: true, default: "credentials" },
    role: { type: String, enum: USER_ROLES, required: true, default: "user" },
    /** Incrementing this invalidates every existing session for the user. */
    sessionVersion: { type: Number, required: true, default: 1 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "users" },
);

export type UserSchema = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserSchema>;

export const UserModel: Model<UserSchema> =
  (mongoose.models.User as Model<UserSchema> | undefined) ?? mongoose.model<UserSchema>("User", userSchema);
