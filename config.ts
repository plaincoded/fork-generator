// RPC providers
export const RPC = {
  eth: 'https://eth-archive.rpc.l0vd.com/WqmTWeEwnjTjxByuwHJI6NYb',
  base: 'https://wider-dimensional-waterfall.base-mainnet.quiknode.pro/db429331102c11009ada09fbe0cb4ee69a797548/',
  arb: 'https://arbitrum-one.g.allthatnode.com/archive/evm',
  op: 'https://optimism-mainnet-archive.rpc.l0vd.com/tuqlaKMJP3IvI3kTZ6caWMcK',
  bsc: 'https://bsc-mainnet-archive.rpc.l0vd.com',
  matic: 'https://polygon.rpc.l0vd.com/sWa9wzawTaDH1uu7YlQMY09m',
  avax: 'https://avalanche.drpc.org',
}

// Network map from debank to subgraph manifest (yaml)
export const networkMap = {
  eth: 'mainnet',
  base: 'base',
  arb: 'arbitrum',
  op: 'optimism',
  bsc: 'bsc',
  matic: 'polygon',
  avax: 'avax',
}

// scanner url
export const scanUrl = {
  eth: 'https://api.etherscan.io',
  base: 'https://api.basescan.org',
  arb: 'https://api.arbiscan.io',
  op: 'https://api-optimistic.etherscan.io',
  bsc: 'https://api.bscscan.com',
  matic: 'https://api.polygonscan.com',
  avax: 'avax',
}
