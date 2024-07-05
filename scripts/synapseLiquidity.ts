const yaml = require('js-yaml')
import { ethers } from 'ethers'
import { RPC, networkMap, scanUrl } from '../config'
import dotenv from 'dotenv'
import { ProtocolInfo, Configs } from '../types'
import {
  getPoolsByAdapter,
  getAbiName,
  getTxHash,
  getBlockNumber,
  generateYamlFile,
} from './common'

dotenv.config()

// Variables
const NETWORK = 'eth'
const SCAN_KEY = process.env.ETH
const ADAPTER = 'synapse_liquidity'

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

// Function to generate the output YAML with anchors and references
function generateYamlContent(
  abiNameFactory: string,
  abiNamePool: string,
  config: ProtocolInfo
): string {
  const yamlContent = {
    dataSources: [
      {
        '<<': '*refFactorySource',
        name: abiNameFactory,
        network: config.network,
        source: {
          address: config.sourceAddress,
          abi: abiNameFactory,
          startBlock: config.startBlock,
        },
      },
    ],
    templates: [
      {
        '<<': '*refPoolSource',
        name: abiNamePool,
        network: config.network,
      },
    ],
  }

  const yamlStr = yaml.dump(yamlContent, { noRefs: true })
  return yamlStr
    .replace(/'\<\<': '\*refFactorySource'/g, '<<: *refFactorySource')
    .replace(/'\<\<': '\*refPoolSource'/g, '<<: *refPoolSource')
}

// Main function
async function main() {
  const configs: Configs = {}
  const abiNameFactory = getAbiName(0, ADAPTER)
  const abiNamePool = getAbiName(1, ADAPTER)

  const protocols = getPoolsByAdapter(ADAPTER, NETWORK)

  for (const protocolId of Object.keys(protocols)) {
    console.log('Processing protocol ' + protocolId)
    const pool = protocols[protocolId][0]

    const txHash = await getTxHash(pool.controller, scanUrl[NETWORK], SCAN_KEY)
    const blockNumber = await getBlockNumber(txHash, provider)

    configs[protocolId] = {
      name: abiNameFactory,
      sourceAddress: pool.controller,
      startBlock: blockNumber,
      network: networkMap[NETWORK],
      module: pool.name.toLowerCase().replace(/\s+/g, '_'),
    }
  }

  // Generate YAML files
  for (const key of Object.keys(configs)) {
    const protocol = key.startsWith(`${NETWORK}_`)
      ? key.slice(`${NETWORK}_`.length)
      : key
    const yamlContent = generateYamlContent(
      abiNameFactory,
      abiNamePool,
      configs[key]
    )
    generateYamlFile(
      configs[key].module,
      ADAPTER,
      networkMap[NETWORK],
      protocol,
      yamlContent
    )
  }
}

await main()
