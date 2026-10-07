import "server-only";
import mongoose, { Schema, Types, type Model } from "mongoose";

/*
 * The record of one admin signing in as another account. Written when the
 * session starts and closed when it ends, so there is always an answer to who
 * looked at whose account, when, and why. Nothing here is ever deleted by the
 * app, and nothing in it is shown to the account that was accessed unless the
 * owner chooses to.
 */

export interface ImpersonationDoc {
  /** The admin who started it. */
  actorId: Types.ObjectId;
  actorEmail: string;
  /** The account that was entered. */
  targetId: Types.ObjectId;
  targetEmail: string;
  reason: string;
  startedAt: Date;
  /** Null while the session is still open. */
  endedAt: Date | null;
  /** How it finished: the admin stopped, it timed out, or the admin's own session was revoked. */
  endedBy: "admin" | "expired" | "revoked" | null;
  ip: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const impersonationSchema = new Schema<ImpersonationDoc>(
  {
    actorId: { type: Schema.Types.ObjectId, required: true, index: true },
    actorEmail: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    targetEmail: { type: String, required: true },
    reason: { type: String, default: "", maxlength: 300 },
    startedAt: { type: Date, required: true, default: () => new Date() },
    endedAt: { type: Date, default: null },
    endedBy: { type: String, enum: ["admin", "expired", "revoked", null], default: null },
    ip: { type: String, default: null, maxlength: 64 },
  },
  { timestamps: true, collection: "impersonations" },
);
impersonationSchema.index({ startedAt: -1 });

export const ImpersonationModel: Model<ImpersonationDoc> =
  (mongoose.models.Impersonation as Model<ImpersonationDoc> | undefined) ??
  mongoose.model<ImpersonationDoc>("Impersonation", impersonationSchema);
