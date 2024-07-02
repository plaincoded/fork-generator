import fs from "fs";

export type PoolByAdapter = {
  chain: string;
  controller: string;
  id: string;
  protocolId: string;
  name: string;
  adapterId: string;
};

export function getPoolsByAdapter(
  adapter: string,
  network: string
): { [key: string]: PoolByAdapter[] } {
  const files = fs.readdirSync("data");
  const byProtocol: { [key: string]: PoolByAdapter[] } = {};

  for (const file of files) {
    const content = fs.readFileSync(`data/${file}`, "utf-8");
    if (!JSON.parse(content)) continue;

    const contents = JSON.parse(content);

    for (const pool of contents) {
      // If it's not of our interest, continue loop and do nothing
      if (pool.adapterId !== adapter && pool.chain !== network) continue;
      if (!byProtocol[pool.protocolId]) byProtocol[pool.protocolId] = [];
      byProtocol[pool.protocolId].push(pool as PoolByAdapter);
    }
  }

  return byProtocol;
}
