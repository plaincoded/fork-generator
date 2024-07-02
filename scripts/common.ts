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
  const all = [];
  const byProtocol: { [key: string]: PoolByAdapter[] } = {};

  for (const file of files) {
    const content = fs.readFileSync(`data/${file}`, "utf-8");
    if (!JSON.parse(content)) continue;

    const protocols = JSON.parse(content);

    for (const protocol of protocols) {
      if (protocol.adapterId === adapter && protocol.chain === network) {
        all.push(protocol);
      }
    }
  }

  for (const pool of all) {
    if (!byProtocol[pool.protocolId]) byProtocol[pool.protocolId] = [];

    byProtocol[pool.protocolId].push(pool as PoolByAdapter);
  }

  return byProtocol;
}
