const yaml = require('js-yaml')
import { ethers } from 'ethers'
import { RPC, networkMap, scanUrl } from '../config'
import dotenv from 'dotenv'
import { ProtocolInfo } from '../types'
import {
  getAbiName,
  generateYamlFile,
  getPoolsByAdapter,
  getTxHash,
  getBlockNumber,
} from './common'

dotenv.config()

// Variables
const NETWORK = 'bsc'
const SCAN_KEY = process.env.BSC
const ADAPTER = 'curve_locked'

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

// Function to generate the output YAML with anchors and references
function generateYamlContent(abiName: string, configs: ProtocolInfo[]): string {
  const dataSources = {
    dataSources: configs.map((config: ProtocolInfo) => {
      return {
        '<<': '*refSource',
        name: config.name,
        network: config.network,
        source: {
          address: config.sourceAddress,
          abi: abiName,
          startBlock: config.startBlock,
        },
      }
    }),
  }

  const yamlStr = yaml.dump(dataSources, { noRefs: true })
  return yamlStr.replace(/'\<\<': '\*refSource'/g, '<<: *refSource')
}

// Main function
async function main() {
  const configs: any = {}
  const abiName = getAbiName(0, ADAPTER)
  const protocols = getPoolsByAdapter(ADAPTER, NETWORK)

  for (const protocolId of Object.keys(protocols)) {
    console.log('Starting protocol ' + protocolId)

    for (let i = 0; i < protocols[protocolId].length; i++) {
      if (!configs[protocolId]) {
        configs[protocolId] = []
      }

      const txHash = await getTxHash(
        protocols[protocolId][i].controller,
        scanUrl[NETWORK],
        SCAN_KEY
      )

      const blockNumber = await getBlockNumber(txHash, provider)

      configs[protocolId].push({
        name: abiName + configs[protocolId].length,
        sourceAddress: protocols[protocolId][i].controller,
        startBlock: blockNumber,
        network: networkMap[NETWORK],
        module: protocols[protocolId][i].name
          .toLowerCase()
          .replace(/\s+/g, '_'),
      })
    }
  }

  // Generate YAML files
  for (const key of Object.keys(configs)) {
    const protocol = key.startsWith(`${NETWORK}_`)
      ? key.slice(`${NETWORK}_`.length)
      : key
    const yamlContent = generateYamlContent(abiName, configs[key])
    generateYamlFile(
      configs[key][0].module,
      ADAPTER,
      networkMap[NETWORK],
      protocol,
      yamlContent
    )
  }
}

await main()
