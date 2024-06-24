import axios from "axios";
import { ethers } from "ethers";
import fs from "fs";

const RPC =
  "https://wider-dimensional-waterfall.base-mainnet.quiknode.pro/db429331102c11009ada09fbe0cb4ee69a797548/";

const SCAN = "SWY52HBFE7RB3JSY26Q3616947I4AIX5CA";

const provider = new ethers.JsonRpcProvider(RPC);

async function main() {
  const chain = "base";
  const files = fs.readdirSync("data");
  const uniswap2 = [];
  const aggregated: any = {};
  const factories: {
    [key: string]: {
      factoryAddress: string;
      startBlock: number;
      network: string;
    };
  } = {};

  for (const file of files) {
    const content = fs.readFileSync(`data/${file}`, "utf-8");
    if (!JSON.parse(content)) continue;
    // console.log(content);

    const protocols = JSON.parse(content);

    for (const protocol of protocols) {
      if (
        protocol.adapterId === "uniswap2_liquidity" &&
        protocol.chain === chain
      ) {
        // console.log("match!");
        // console.log(protocol);
        uniswap2.push(protocol);
      }
    }
  }

  for (const protocol of uniswap2) {
    if (!aggregated[protocol.protocolId]) aggregated[protocol.protocolId] = [];

    aggregated[protocol.protocolId].push(protocol);
  }

  for (const protocolId of Object.keys(aggregated)) {
    const pool = aggregated[protocolId][0];

    const contract = new ethers.Contract(
      pool.controller as string,
      ["function factory() external view returns (address)"],
      provider
    );

    try {
      const res = await contract.factory();
      factories[protocolId] = {
        factoryAddress: res,
        startBlock: 0,
        network: chain,
      };
    } catch (e) {
      console.log("it didn't work");
    }
  }

  for (const key of Object.keys(factories)) {
    const protocol = factories[key];
    const url = `https://api.basescan.org/api?module=contract&action=getcontractcreation&contractaddresses=${protocol.factoryAddress}&apikey=${SCAN}`;
    console.log("calling Base Scan for: ", protocol.factoryAddress);
    const call = await axios.get(url);

    if (!call.data.result) continue;
    if (!call.data.result[0]) continue;

    const txHash = call.data.result[0].txHash;

    try {
      const tx = await provider.getTransaction(txHash);
      factories[key].startBlock = tx?.blockNumber ?? 0;
    } catch (e) {
      console.log("error fetching transaction");
    }
  }
  console.log(factories);

  for (const key of Object.keys(factories)) {
    const protocol = factories[key];

    fs.mkdirSync(`dist/${protocol.network}/${key}`, { recursive: true });
    const contents = `
      config:
        - &network ${chain}
        - &factoryAddress '0x5FA0060FcfEa35B31F7A5f6025F0fF399b98Edf1'
        - &startBlock 12630117
  `;
    fs.writeFileSync(`dist/${protocol.network}/${key}/${key}.yaml`, contents);
  }
}

await main();
