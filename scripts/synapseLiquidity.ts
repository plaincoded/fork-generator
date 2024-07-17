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
  getSignatures,
  filterPoolsBySignature,
} from './common'

dotenv.config()

// Variables
const NETWORK = 'eth'
const SCAN_KEY = process.env.ETH
const TEMPLATE = 'synapse_liquidity'
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

async function getFactory(txHash: string | null): Promise<string> {
  if (txHash === null) {
    return ethers.ZeroAddress
  }

  const receipt = await provider.getTransactionReceipt(txHash)

  if (receipt == null) {
    return ethers.ZeroAddress
  }

  const eventSignature = ethers.id('NewSwapPool(address,address,address[])')

  // Iterate through the logs in the receipt
  for (let log of receipt.logs) {
    // Check if the log topics match the event signature
    if (log.topics[0] === eventSignature) {
      // Return the address of the contract that emitted the event
      return log.address
    }
  }

  return ethers.ZeroAddress
}

// Main function
async function main() {
  const configs: Configs = {}
  const abiNameFactory = getAbiName(0, TEMPLATE)
  const abiNamePool = getAbiName(1, TEMPLATE)

  const protocols = getPoolsByAdapter(ADAPTER, NETWORK)

  // Filter only the first pool
  const protocolsOnePool: any = {}

  for (const protocol in protocols) {
    if (protocols.hasOwnProperty(protocol)) {
      protocolsOnePool[protocol] = [protocols[protocol][0]]
    }
  }

  // Check if events and function are correct
  const signatures = getSignatures(TEMPLATE)

  let protocolsFiltered = await filterPoolsBySignature(
    TEMPLATE,
    ADAPTER,
    protocolsOnePool,
    signatures,
    NETWORK,
    provider
  )
  console.log('Event and Function Signatures checked!')

  for (const protocolId of Object.keys(protocolsFiltered)) {
    console.log('Processing protocol ' + protocolId)
    const pool = protocolsFiltered[protocolId][0]

    const poolTxHash = await getTxHash(
      pool.controller,
      scanUrl[NETWORK],
      SCAN_KEY
    )
    const factoryAddress = await getFactory(poolTxHash)

    const factoryTxHash = await getTxHash(
      factoryAddress,
      scanUrl[NETWORK],
      SCAN_KEY
    )
    const blockNumber = await getBlockNumber(factoryTxHash, provider)

    configs[protocolId] = {
      name: abiNameFactory,
      sourceAddress: factoryAddress,
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
      TEMPLATE,
      ADAPTER,
      networkMap[NETWORK],
      protocol,
      yamlContent
    )
  }
}

await main()
