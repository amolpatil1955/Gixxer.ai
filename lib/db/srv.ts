import "server-only";
import { Resolver } from "node:dns/promises";

/**
 * `mongodb+srv://` connection strings need SRV and TXT lookups. Some development machines
 * route DNS through a local stub (VPN clients, ad blockers, some ISP routers) that answers
 * A records but refuses SRV queries, so the driver fails with `querySrv ECONNREFUSED`
 * before it ever reaches Atlas. This expands the SRV record through public resolvers into
 * the equivalent standard connection string, exactly as the driver would have done.
 * Credentials, database name and query options are carried over untouched.
 */

const PUBLIC_RESOLVERS = ["8.8.8.8", "1.1.1.1"];

const SRV_URI = /^mongodb\+srv:\/\/(?:([^@/]*)@)?([^/?]+)(\/[^?]*)?(\?.*)?$/;

export function isSrvLookupFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /querySrv|queryTxt|_mongodb\._tcp/i.test(error.message) && /ECONNREFUSED|ESERVFAIL|ETIMEOUT|EREFUSED|ECANCELLED/i.test(error.message);
}

export interface SrvRecords {
  hosts: { name: string; port: number }[];
  txtOptions: string;
}

export async function lookupSrv(hostname: string, servers: string[] = PUBLIC_RESOLVERS): Promise<SrvRecords> {
  const resolver = new Resolver();
  resolver.setServers(servers);
  const [srv, txt] = await Promise.all([
    resolver.resolveSrv(`_mongodb._tcp.${hostname}`),
    resolver.resolveTxt(hostname).catch(() => [] as string[][]),
  ]);
  if (srv.length === 0) throw new Error("SRV lookup returned no hosts");
  return {
    hosts: srv.map((record) => ({ name: record.name, port: record.port })),
    txtOptions: txt.map((chunks) => chunks.join("")).join("&"),
  };
}

/** Builds the standard URI from an SRV one and its resolved records. Pure, for tests. */
export function expandSrvUri(uri: string, records: SrvRecords): string {
  const match = SRV_URI.exec(uri);
  if (!match) throw new Error("Not an SRV connection string");
  const [, credentials, , path = "/", query = ""] = match;
  const params = new URLSearchParams(records.txtOptions);
  // Options given in the URI take precedence over the TXT record, per the SRV specification.
  for (const [key, value] of new URLSearchParams(query.slice(1))) params.set(key, value);
  if (!params.has("tls") && !params.has("ssl")) params.set("tls", "true");
  const hosts = records.hosts.map((host) => `${host.name}:${host.port}`).join(",");
  return `mongodb://${credentials ? `${credentials}@` : ""}${hosts}${path}?${params.toString()}`;
}

export async function resolveSrvUri(uri: string): Promise<string> {
  const match = SRV_URI.exec(uri);
  const hostname = match?.[2];
  if (!hostname) throw new Error("Not an SRV connection string");
  return expandSrvUri(uri, await lookupSrv(hostname));
}
