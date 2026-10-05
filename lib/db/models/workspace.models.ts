import "server-only";
import mongoose, { Schema, Types, type Model } from "mongoose";

/*
 * Every workspace document carries `userId` and every query in the repositories
 * filters on it. That filter is the tenant boundary: there is no code path that
 * reads a chat, file, image or bot without the owner's id in the query.
 *
 * Document types are written by hand rather than inferred with
 * `InferSchemaType`: inferring nine schemas with nested arrays made the
 * TypeScript checker run out of memory, and explicit interfaces are clearer
 * for readers anyway.
 */

function model<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export const MESSAGE_ROLES = ["user", "assistant"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const MESSAGE_STATUSES = ["complete", "streaming", "stopped", "error"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_FEEDBACK = ["up", "down"] as const;
export type MessageFeedback = (typeof MESSAGE_FEEDBACK)[number];

export interface ConversationDoc {
  userId: Types.ObjectId;
  title: string;
  /** The message the conversation currently ends on. Branching moves it. */
  activeLeafId: Types.ObjectId | null;
  /** Pinned chats sit at the top of the sidebar. */
  pinned: boolean;
  /** The project this chat belongs to, whose instructions every turn inherits. */
  projectId: Types.ObjectId | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120, default: "New chat" },
    activeLeafId: { type: Schema.Types.ObjectId, default: null },
    pinned: { type: Boolean, default: false },
    projectId: { type: Schema.Types.ObjectId, default: null },
    lastMessageAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, collection: "conversations" },
);
conversationSchema.index({ userId: 1, lastMessageAt: -1 });
conversationSchema.index({ userId: 1, projectId: 1, lastMessageAt: -1 });

export interface MessageAttachment {
  fileId: Types.ObjectId;
  name: string;
}

export const ARTIFACT_KINDS = ["image", "file"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** Something the assistant made during a turn: a generated image or a built document. */
export interface MessageArtifact {
  kind: ArtifactKind;
  /** The image's or file's id in its own collection. */
  refId: Types.ObjectId;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  prompt: string;
  preview: string;
}

export interface MessageCitation {
  fileId: Types.ObjectId;
  fileName: string;
  locator: string;
}

export interface MessageDoc {
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MessageRole;
  content: string;
  /** Tree structure: editing a message adds a sibling under the same parent. */
  parentId: Types.ObjectId | null;
  status: MessageStatus;
  provider: string | null;
  /** The model's reasoning in Think mode, kept so the thought panel survives a reload. */
  reasoning: string;
  /** The reader's verdict on an assistant reply. */
  feedback: MessageFeedback | null;
  attachments: MessageAttachment[];
  citations: MessageCitation[];
  artifacts: MessageArtifact[];
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageDoc>(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    role: { type: String, enum: MESSAGE_ROLES, required: true },
    content: { type: String, default: "", maxlength: 200_000 },
    parentId: { type: Schema.Types.ObjectId, default: null },
    status: { type: String, enum: MESSAGE_STATUSES, default: "complete" },
    provider: { type: String, default: null },
    reasoning: { type: String, default: "", maxlength: 60_000 },
    feedback: { type: String, enum: [...MESSAGE_FEEDBACK, null], default: null },
    attachments: {
      type: [new Schema<MessageAttachment>({ fileId: { type: Schema.Types.ObjectId, required: true }, name: { type: String, required: true } }, { _id: false })],
      default: [],
    },
    citations: {
      type: [
        new Schema<MessageCitation>(
          {
            fileId: { type: Schema.Types.ObjectId, required: true },
            fileName: { type: String, required: true },
            locator: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    artifacts: {
      type: [
        new Schema<MessageArtifact>(
          {
            kind: { type: String, enum: ARTIFACT_KINDS, required: true },
            refId: { type: Schema.Types.ObjectId, required: true },
            name: { type: String, required: true },
            mime: { type: String, required: true },
            size: { type: Number, default: 0 },
            width: { type: Number, default: null },
            height: { type: Number, default: null },
            prompt: { type: String, default: "" },
            preview: { type: String, default: "", maxlength: 2000 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true, collection: "messages" },
);
messageSchema.index({ conversationId: 1, createdAt: 1 });

export const ConversationModel = model<ConversationDoc>("Conversation", conversationSchema);
export const MessageModel = model<MessageDoc>("Message", messageSchema);

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export interface ProjectDoc {
  userId: Types.ObjectId;
  name: string;
  /** Instructions every chat in the project inherits, ahead of the user's own. */
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    instructions: { type: String, default: "", maxlength: 4000 },
  },
  { timestamps: true, collection: "projects" },
);
projectSchema.index({ userId: 1, updatedAt: -1 });

export const ProjectModel = model<ProjectDoc>("Project", projectSchema);

/* ------------------------------------------------------------------ */
/* Scheduled prompts                                                   */
/* ------------------------------------------------------------------ */

export const SCHEDULE_CADENCES = ["daily", "weekdays", "weekly", "monthly"] as const;
export type ScheduleCadence = (typeof SCHEDULE_CADENCES)[number];

export interface ScheduleDoc {
  userId: Types.ObjectId;
  name: string;
  prompt: string;
  cadence: ScheduleCadence;
  /** Wall-clock time in the owner's zone. */
  hour: number;
  minute: number;
  /** IANA zone the wall-clock time is expressed in, e.g. "Europe/Berlin". */
  timeZone: string;
  active: boolean;
  nextRunAt: Date;
  lastRunAt: Date | null;
  lastConversationId: Types.ObjectId | null;
  lastError: string | null;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleSchema = new Schema<ScheduleDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    prompt: { type: String, required: true, maxlength: 4000 },
    cadence: { type: String, enum: SCHEDULE_CADENCES, required: true },
    hour: { type: Number, required: true, min: 0, max: 23 },
    minute: { type: Number, required: true, min: 0, max: 59 },
    timeZone: { type: String, required: true, maxlength: 64 },
    active: { type: Boolean, default: true },
    nextRunAt: { type: Date, required: true },
    lastRunAt: { type: Date, default: null },
    lastConversationId: { type: Schema.Types.ObjectId, default: null },
    lastError: { type: String, default: null },
    runCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "schedules" },
);
scheduleSchema.index({ active: 1, nextRunAt: 1 });
scheduleSchema.index({ userId: 1, createdAt: -1 });

export const ScheduleModel = model<ScheduleDoc>("Schedule", scheduleSchema);

/* ------------------------------------------------------------------ */
/* Per-user settings                                                   */
/* ------------------------------------------------------------------ */

export const RESPONSE_TONES = ["default", "concise", "friendly", "professional", "detailed"] as const;
export type ResponseTone = (typeof RESPONSE_TONES)[number];

export interface UserSettingsDoc {
  userId: Types.ObjectId;
  tone: ResponseTone;
  /** What the assistant should call the user. Empty means their first name. */
  nickname: string;
  /** Standing instructions added to every chat. */
  customInstructions: string;
  /** Enabled plugin ids, see lib/plugins/catalog.ts. */
  plugins: string[];
  createdAt: Date;
  updatedAt: Date;
}

const userSettingsSchema = new Schema<UserSettingsDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    tone: { type: String, enum: RESPONSE_TONES, default: "default" },
    nickname: { type: String, default: "", maxlength: 40 },
    customInstructions: { type: String, default: "", maxlength: 1500 },
    plugins: { type: [String], default: [] },
  },
  { timestamps: true, collection: "user_settings" },
);

export const UserSettingsModel = model<UserSettingsDoc>("UserSettings", userSettingsSchema);

/* ------------------------------------------------------------------ */
/* Files and knowledge                                                 */
/* ------------------------------------------------------------------ */

export const FILE_KINDS = ["pdf", "docx", "txt", "csv", "xlsx", "xls", "image"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const FILE_STATUSES = ["uploaded", "indexing", "indexed", "failed"] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

/**
 * Where a file belongs. `library` files are the user's shared documents (Library page, the
 * Library knowledge plugin). `chat` files were attached in, or generated by, one conversation
 * and are bound to it. `bot` files are a chatbot's uploaded knowledge. Retrieval across "all
 * files" only ever reads `library` files, so nothing from one chat leaks into another.
 */
export const FILE_SCOPES = ["library", "chat", "bot"] as const;
export type FileScope = (typeof FILE_SCOPES)[number];

export interface FileDoc {
  userId: Types.ObjectId;
  scope: FileScope;
  /** The conversation a `chat` file belongs to. Null until the first message that carries it. */
  conversationId: Types.ObjectId | null;
  name: string;
  mime: string;
  size: number;
  kind: FileKind;
  storageId: Types.ObjectId;
  status: FileStatus;
  /** Pages for documents, sheets for workbooks. */
  pages: number | null;
  sheets: string[];
  chunkCount: number;
  preview: string;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<FileDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    scope: { type: String, enum: FILE_SCOPES, default: "library" },
    conversationId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true, trim: true, maxlength: 255 },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: FILE_KINDS, required: true },
    storageId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: FILE_STATUSES, default: "uploaded" },
    pages: { type: Number, default: null },
    sheets: { type: [String], default: [] },
    chunkCount: { type: Number, default: 0 },
    preview: { type: String, default: "", maxlength: 600 },
    error: { type: String, default: null },
  },
  { timestamps: true, collection: "files" },
);
fileSchema.index({ userId: 1, createdAt: -1 });
fileSchema.index({ userId: 1, scope: 1, conversationId: 1 });

/**
 * A slice of text the retrieval step can rank. Chunks belong either to a
 * workspace file (fileId) or to a bot's knowledge source (botId + sourceId).
 */
export interface ChunkDoc {
  userId: Types.ObjectId;
  fileId: Types.ObjectId | null;
  botId: Types.ObjectId | null;
  sourceId: Types.ObjectId | null;
  sourceName: string;
  index: number;
  text: string;
  /** Human-readable position: "p.17", "Sheet1!A2:D9", "section 3". */
  locator: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const chunkSchema = new Schema<ChunkDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    fileId: { type: Schema.Types.ObjectId, default: null, index: true },
    botId: { type: Schema.Types.ObjectId, default: null, index: true },
    sourceId: { type: Schema.Types.ObjectId, default: null },
    sourceName: { type: String, required: true },
    index: { type: Number, required: true },
    text: { type: String, required: true, maxlength: 8000 },
    locator: { type: String, required: true },
    embedding: { type: [Number], default: undefined },
  },
  { timestamps: true, collection: "chunks" },
);

export const FileModel = model<FileDoc>("File", fileSchema);
export const ChunkModel = model<ChunkDoc>("Chunk", chunkSchema);

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

export interface ImageDoc {
  userId: Types.ObjectId;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  model: string;
  mime: string;
  storageId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<ImageDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    prompt: { type: String, required: true, maxlength: 2000 },
    seed: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    model: { type: String, required: true },
    mime: { type: String, required: true },
    storageId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true, collection: "images" },
);
imageSchema.index({ userId: 1, createdAt: -1 });

export const ImageModel = model<ImageDoc>("Image", imageSchema);

/* ------------------------------------------------------------------ */
/* Chatbot Pro                                                         */
/* ------------------------------------------------------------------ */

export const BOT_TONES = ["friendly", "professional", "concise"] as const;
export type BotTone = (typeof BOT_TONES)[number];
export const BOT_STATUSES = ["draft", "live"] as const;
export type BotStatus = (typeof BOT_STATUSES)[number];
export const WIDGET_POSITIONS = ["left", "right"] as const;
export type WidgetPosition = (typeof WIDGET_POSITIONS)[number];

export interface BotDoc {
  userId: Types.ObjectId;
  name: string;
  /** Public, unguessable identifier the widget uses. Never the ObjectId. */
  publicKey: string;
  status: BotStatus;
  avatarLetter: string;
  welcomeMessage: string;
  businessName: string;
  businessInfo: string;
  instructions: string;
  tone: BotTone;
  suggestedQuestions: string[];
  /** What the bot is for; shapes its default instructions. See lib/bots/constants.ts. */
  useCase: string;
  /** `preset` is one of the themes in lib/bots/themes.ts. */
  theme: { accent: string; position: WidgetPosition; preset: string };
  behavior: { collectLeads: boolean; citeSources: boolean; knowledgeOnly: boolean };
  /** Origins allowed to embed the widget. Empty means any origin. */
  allowedOrigins: string[];
  /** Set when the creation wizard was completed. */
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const botSchema = new Schema<BotDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    publicKey: { type: String, required: true, unique: true },
    status: { type: String, enum: BOT_STATUSES, default: "draft" },
    avatarLetter: { type: String, default: "", maxlength: 2 },
    welcomeMessage: { type: String, default: "Hi! How can I help?", maxlength: 300 },
    businessName: { type: String, default: "", maxlength: 80 },
    businessInfo: { type: String, default: "", maxlength: 4000 },
    instructions: { type: String, default: "", maxlength: 4000 },
    tone: { type: String, enum: BOT_TONES, default: "friendly" },
    suggestedQuestions: { type: [String], default: [] },
    useCase: { type: String, default: "support", maxlength: 32 },
    theme: {
      accent: { type: String, default: "#2563eb" },
      position: { type: String, enum: WIDGET_POSITIONS, default: "right" },
      preset: { type: String, default: "clarity", maxlength: 32 },
    },
    publishedAt: { type: Date, default: null },
    behavior: {
      collectLeads: { type: Boolean, default: true },
      citeSources: { type: Boolean, default: true },
      knowledgeOnly: { type: Boolean, default: true },
    },
    allowedOrigins: { type: [String], default: [] },
  },
  { timestamps: true, collection: "bots" },
);
botSchema.index({ userId: 1, createdAt: -1 });

export const SOURCE_TYPES = ["file", "url", "text"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
/** pending -> crawling (websites only) -> processing -> indexed, or failed at any point. `indexing` is the legacy name of processing. */
export const SOURCE_STATUSES = ["pending", "crawling", "processing", "indexing", "indexed", "failed"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export interface BotSourceDoc {
  botId: Types.ObjectId;
  userId: Types.ObjectId;
  type: SourceType;
  name: string;
  /** The file for `file` sources, the address for `url` sources. */
  fileId: Types.ObjectId | null;
  url: string | null;
  /** The website address normalised for duplicate checks. */
  urlKey: string | null;
  status: SourceStatus;
  chunkCount: number;
  /** Pages read, for website sources. */
  pageCount: number;
  /** The crawler's job id while a crawl runs. */
  jobId: string | null;
  crawlStartedAt: Date | null;
  lastCrawledAt: Date | null;
  /** Title of the site's first page, for display. */
  title: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const botSourceSchema = new Schema<BotSourceDoc>(
  {
    botId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, enum: SOURCE_TYPES, required: true },
    name: { type: String, required: true, maxlength: 255 },
    fileId: { type: Schema.Types.ObjectId, default: null },
    url: { type: String, default: null, maxlength: 2000 },
    urlKey: { type: String, default: null, maxlength: 2000 },
    status: { type: String, enum: SOURCE_STATUSES, default: "pending" },
    chunkCount: { type: Number, default: 0 },
    pageCount: { type: Number, default: 0 },
    jobId: { type: String, default: null, maxlength: 200 },
    crawlStartedAt: { type: Date, default: null },
    lastCrawledAt: { type: Date, default: null },
    title: { type: String, default: null, maxlength: 300 },
    error: { type: String, default: null },
  },
  { timestamps: true, collection: "bot_sources" },
);
botSourceSchema.index({ botId: 1, userId: 1, urlKey: 1 });

export interface BotMessageDoc {
  role: MessageRole;
  content: string;
  sources: string[];
  createdAt: Date;
}

export interface BotConversationDoc {
  botId: Types.ObjectId;
  userId: Types.ObjectId;
  /** Random id held by the visitor's browser. Never tied to a workspace account. */
  sessionId: string;
  messages: BotMessageDoc[];
  origin: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const botConversationSchema = new Schema<BotConversationDoc>(
  {
    botId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    sessionId: { type: String, required: true },
    messages: {
      type: [
        new Schema<BotMessageDoc>(
          {
            role: { type: String, enum: MESSAGE_ROLES, required: true },
            content: { type: String, required: true, maxlength: 20_000 },
            sources: { type: [String], default: [] },
            createdAt: { type: Date, default: () => new Date() },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    origin: { type: String, default: null },
    lastMessageAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, collection: "bot_conversations" },
);
botConversationSchema.index({ botId: 1, sessionId: 1 }, { unique: true });
botConversationSchema.index({ botId: 1, lastMessageAt: -1 });

export interface LeadDoc {
  botId: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: Types.ObjectId;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<LeadDoc>(
  {
    botId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, default: "", maxlength: 120 },
    email: { type: String, required: true, maxlength: 254 },
    message: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true, collection: "leads" },
);
leadSchema.index({ botId: 1, createdAt: -1 });

export const BotModel = model<BotDoc>("Bot", botSchema);
export const BotSourceModel = model<BotSourceDoc>("BotSource", botSourceSchema);
export const BotConversationModel = model<BotConversationDoc>("BotConversation", botConversationSchema);
export const LeadModel = model<LeadDoc>("Lead", leadSchema);
