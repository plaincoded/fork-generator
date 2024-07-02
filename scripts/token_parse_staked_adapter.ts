import { getPoolsByAdapter } from "./common";
const ADAPTER = "token_parse_staked_adapter";
const NETWORK = "base";

async function main() {
  const protocols = getPoolsByAdapter(ADAPTER, NETWORK);

  console.log(protocols);
}

await main();
