const yaml = require("js-yaml");
import fs from "fs";
import { ethers } from "ethers";
import axios from "axios";
import path from "path";
import { ProtocolInfo } from "../types";
import { networkMap, scanKeys, scanUrl } from "../config";

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
      if (pool.adapterId !== adapter || pool.chain !== network) continue;
      if (!byProtocol[pool.protocolId]) byProtocol[pool.protocolId] = [];
      byProtocol[pool.protocolId].push(pool as PoolByAdapter);
    }
  }

  return byProtocol;
}

export async function getBlockNumber(
  txHash: string | null,
  provider: ethers.JsonRpcProvider
): Promise<number> {
  if (txHash === null) {
    return 0;
  }

  const tx = await provider.getTransaction(txHash);
  return tx?.blockNumber ?? 0;
}

export async function getTxHash(
  address: string,
  scanUrl: string,
  scanKey: string | undefined
): Promise<string | null> {
  if (address === ethers.ZeroAddress) {
    return null;
  }

  const call = await axios.get(
    `${scanUrl}/api?module=contract&action=getcontractcreation&apikey=${scanKey}&contractaddresses=${address}`
  );

  return call.data.result[0].txHash;
}

// Get ABI name
export function getAbiName(refPosition: number, adapter: string): string {
  // Routes to template
  const templatePath = path.join(__dirname, "../templates", `${adapter}.yaml`);

  // Load YAML files
  let baseDataSource = yaml.load(fs.readFileSync(templatePath, "utf8"));

  return baseDataSource.refs[refPosition].source.abi;
}

// Function to generate YAML content and write to a file
export function generateYamlFile(
  module: string,
  adapter: string,
  network: string,
  protocol: string,
  content: string
) {
  // Create directories if they don't exist
  if (!fs.existsSync(`dist/${adapter}/${protocol}.${module}/${network}`)) {
    fs.mkdirSync(`dist/${adapter}/${protocol}.${module}/${network}`, {
      recursive: true,
    });
  }

  // Write the output YAML to a file
  const outputPath = path.join(
    __dirname,
    "../",
    `dist/${adapter}/${protocol}.${module}/${network}/${adapter}.yaml`
  );
  fs.writeFileSync(outputPath, content, "utf8");

  console.log(`YAML file generated at: ${outputPath}`);
}

export async function fetchAbi(
  contract: string,
  network: keyof typeof networkMap
) {
  const url = `${scanUrl[network]}/api?module=contract&action=getabi&address=${contract}&apikey=${scanKeys[network]}`;
  const result = await axios.get(url);
  return JSON.parse(result.data.result);
}

export function isProxy(events: string[]): boolean {
  return events.includes("Upgraded(indexed address implementation)");
}
