import axios from "axios";
import { RPC, scanKeys } from "../config";
import { getPoolsByAdapter } from "./common";
import { wait } from "./utils/wait";
import { formatEventWithInputs } from "./utils/events";
import { ethers } from "ethers";
const ADAPTER = "token_parse_staked_adapter";
const NETWORK = "base";

const provider = new ethers.JsonRpcProvider(RPC[NETWORK]);

async function main() {
  const protocols = getPoolsByAdapter(ADAPTER, NETWORK);

  // console.log(protocols);
  const eventsByContract: any = {};
  const contractNames: { [key: string]: string } = {};

  for (const protocol in protocols) {
    const pools = protocols[protocol];

    for (const pool of pools) {
      const url = `https://api.basescan.org/api?module=contract&action=getabi&address=${pool.controller}&apikey=${scanKeys[NETWORK]}`;
      const result = await axios.get(url);
      if (!result.data) continue;
      const json = JSON.parse(result.data.result);

      const events = json.filter((x: any) => x.type === "event");
      for (const event of events) {
        const signature = formatEventWithInputs(event.name, event.inputs);
        if (!eventsByContract[pool.controller])
          eventsByContract[pool.controller] = { proxy: false, events: [] };
        eventsByContract[pool.controller].events.push(signature);

        if (event.name === "Upgraded") {
          eventsByContract[pool.controller].proxy = true;
        }
      }

      await wait(1000);
    }
  }

  console.log(eventsByContract);

  // Find underlying contracts
  for (const contract in eventsByContract) {
    if (!eventsByContract[contract].proxy) continue;
    const c = new ethers.Contract(
      contract as string,
      ["event Upgraded(address indexed implementation)"],
      provider
    );

    try {
      const res = await c.queryFilter(c.filters.Upgraded(), 10871647, "latest");
      // contractNames[res] = contract;

      console.log(contract, res);
    } catch (e) {
      console.log(e);
      console.log("No implementation for ", contract);
    }
  }
}

await main();
