import { withDb } from "./helpers/db";

/** Start every end-to-end run from an empty users collection in the dedicated e2e database. */
export default async function globalSetup(): Promise<void> {
  await withDb(async (client) => {
    await client.db().collection("users").deleteMany({});
  });
}
