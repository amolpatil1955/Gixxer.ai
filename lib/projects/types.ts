/** Serialisable project shapes for client components. */
export interface ProjectDto {
  id: string;
  name: string;
  instructions: string;
  /** How many chats live in it. */
  conversationCount: number;
  createdAt: string;
  updatedAt: string;
}

/** The little the sidebar needs to offer "Move to project". */
export interface ProjectSummaryDto {
  id: string;
  name: string;
}
