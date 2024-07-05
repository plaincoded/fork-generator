const yaml = require('js-yaml')
import { ethers } from 'ethers'
import { RPC, networkMap, scanUrl } from '../config'
import dotenv from 'dotenv'
import { ProtocolInfo, Configs } from '../types'
import {
  getAbiName,
  generateYamlFile,
  getPoolsByAdapter,
  getTxHash,
  getBlockNumber,
} from './common'

dotenv.config()

// Variables
const NETWORK = 'eth'
const SCAN_KEY = process.env.ETH
const ADAPTER = 'compound_lending'

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

// Function to generate the output YAML with anchors and references
function generateYamlContent(
  abiNameComptroller: string,
  abiNameCToken: string,
  config: ProtocolInfo
): string {
  const yamlContent = {
    dataSources: [
      {
        '<<': '*refComptrollerSource',
        name: abiNameComptroller,
        network: config.network,
        source: {
          address: config.sourceAddress,
          abi: abiNameComptroller,
          startBlock: config.startBlock,
        },
      },
    ],
    templates: [
      {
        '<<': '*refCTokenSource',
        name: abiNameCToken,
        network: config.network,
      },
    ],
  }

  const yamlStr = yaml.dump(yamlContent, { noRefs: true })
  return yamlStr
    .replace(/'\<\<': '\*refComptrollerSource'/g, '<<: *refComptrollerSource')
    .replace(/'\<\<': '\*refCTokenSource'/g, '<<: *refCTokenSource')
}

// Main function
async function main() {
  const configs: Configs = {}
  const abiNameComptroller = getAbiName(0, ADAPTER)
  const abiNameCToken = getAbiName(1, ADAPTER)

  const protocols = getPoolsByAdapter(ADAPTER, NETWORK)

  for (const protocolId of Object.keys(protocols)) {
    console.log('Processing protocol ' + protocolId)
    const pool = protocols[protocolId][0]

    const txHash = await getTxHash(pool.controller, scanUrl[NETWORK], SCAN_KEY)
    const blockNumber = await getBlockNumber(txHash, provider)

    configs[protocolId] = {
      name: abiNameComptroller,
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
      abiNameComptroller,
      abiNameCToken,
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
