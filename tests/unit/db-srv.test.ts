import { describe, expect, it } from "vitest";
import { expandSrvUri, isSrvLookupFailure } from "@/lib/db/srv";

describe("SRV connection string fallback", () => {
  const records = {
    hosts: [
      { name: "ac-1-shard-00-00.x.mongodb.net", port: 27017 },
      { name: "ac-1-shard-00-01.x.mongodb.net", port: 27017 },
    ],
    txtOptions: "authSource=admin&replicaSet=atlas-abc-shard-0",
  };

  it("expands hosts, keeps credentials and database, merges TXT options and defaults to TLS", () => {
    const out = expandSrvUri("mongodb+srv://user:p%40ss@cluster.x.mongodb.net/gixxer?appName=Gixxer", records);
    expect(out).toBe(
      "mongodb://user:p%40ss@ac-1-shard-00-00.x.mongodb.net:27017,ac-1-shard-00-01.x.mongodb.net:27017/gixxer?authSource=admin&replicaSet=atlas-abc-shard-0&appName=Gixxer&tls=true",
    );
  });

  it("lets URI options override the TXT record and keeps an explicit tls setting", () => {
    const out = expandSrvUri("mongodb+srv://cluster.x.mongodb.net/?authSource=other&tls=false", records);
    expect(out).toContain("authSource=other");
    expect(out).toContain("tls=false");
    expect(out).not.toContain("tls=true");
    expect(out.startsWith("mongodb://ac-1-shard-00-00")).toBe(true);
  });

  it("rejects anything that is not an SRV string", () => {
    expect(() => expandSrvUri("mongodb://localhost/db", records)).toThrow();
  });

  it("recognises only resolver failures", () => {
    expect(isSrvLookupFailure(new Error("querySrv ECONNREFUSED _mongodb._tcp.cluster.x.mongodb.net"))).toBe(true);
    expect(isSrvLookupFailure(new Error("querySrv ENOTFOUND _mongodb._tcp.nope.mongodb.net"))).toBe(false);
    expect(isSrvLookupFailure(new Error("Authentication failed"))).toBe(false);
    expect(isSrvLookupFailure("nope")).toBe(false);
  });
});
