// RPC providers
export const RPC = {
  eth: 'https://eth-archive.rpc.l0vd.com/WqmTWeEwnjTjxByuwHJI6NYb',
  base: 'https://wider-dimensional-waterfall.base-mainnet.quiknode.pro/db429331102c11009ada09fbe0cb4ee69a797548/',
  arb: 'https://arbitrum-archive.rpc.l0vd.com/cMaydpNCD6qFEnpx860y7MrrJsvgZYaP',
  op: 'https://optimism-mainnet-archive.rpc.l0vd.com/tuqlaKMJP3IvI3kTZ6caWMcK',
  bsc: 'https://bsc-mainnet-archive.rpc.l0vd.com',
  matic: 'https://polygon.rpc.l0vd.com/sWa9wzawTaDH1uu7YlQMY09m',
  avax: 'https://avalanche-archive.rpc.l0vd.com/iwGAa6si958U0AcMnvdziPyuiOaGs2gk',
}

// Network map from debank to subgraph manifest (yaml)
export const networkMap = {
  eth: 'mainnet',
  base: 'base',
  arb: 'arbitrum',
  op: 'optimism',
  bsc: 'bsc',
  matic: 'polygon',
  avax: 'avalanche',
}

// scanner url
export const scanUrl = {
  eth: 'https://api.etherscan.io',
  base: 'https://api.basescan.org',
  arb: 'https://api.arbiscan.io',
  op: 'https://api-optimistic.etherscan.io',
  bsc: 'https://api.bscscan.com',
  matic: 'https://api.polygonscan.com',
  avax: 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan',
}

export const scanKeys = {
  eth: 'MJGH5JXG7YUSEA61ZTNY6E5DQI7UT4AX2E',
  base: 'SWY52HBFE7RB3JSY26Q3616947I4AIX5CA',
  arb: '7RY611IY1QWM9P431M2KPADK3H42NQS8G4',
  op: 'VKBTMAUYVUAP3S8SMU8I9BFY894K1YI42H',
  bsc: 'PF43GR93QDJ3F81CU1RWDNQN78Y2QFD37K',
  matic: '83CESRBIWD1RU874BB8QHQCIG4J93K9PHW',
  avax: '',
}
