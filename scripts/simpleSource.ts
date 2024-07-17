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
  getSignatures,
  filterPoolsBySignature,
  getFactory,
} from './common'

dotenv.config()

// Variables
const NETWORK = 'eth'
const SCAN_KEY = process.env.ETH
const TEMPLATE = 'tokenized_vault_yield'
const ADAPTER = 'ragetrade_yield'

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
  const abiName = getAbiName(0, TEMPLATE)
  const protocols = getPoolsByAdapter(ADAPTER, NETWORK)

  // Check if events and function are correct
  const signatures = getSignatures(TEMPLATE)

  let protocolsFiltered = await filterPoolsBySignature(
    TEMPLATE,
    ADAPTER,
    protocols,
    signatures,
    NETWORK,
    provider
  )
  console.log('Event and Function Signatures checked!')

  for (const protocolId of Object.keys(protocolsFiltered)) {
    console.log('Starting protocol ' + protocolId)

    for (let i = 0; i < protocolsFiltered[protocolId].length; i++) {
      const txHash = await getTxHash(
        protocols[protocolId][i].controller,
        scanUrl[NETWORK],
        SCAN_KEY
      )

      // If created by a Factory, we skip this fork
      const factory = await getFactory(txHash, provider)
      if (factory !== null) {
        console.log(
          `Protocol ${protocolId} NOT generated, it uses factory: ${factory}`
        )

        break
      }

      const blockNumber = await getBlockNumber(txHash, provider)

      if (!configs[protocolId]) {
        configs[protocolId] = []
      }

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
      TEMPLATE,
      ADAPTER,
      networkMap[NETWORK],
      protocol,
      yamlContent
    )
  }
}

await main()
