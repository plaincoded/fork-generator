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
  getSignatures,
  filterPoolsBySignature,
} from './common'

dotenv.config()

// Variables
const NETWORK = 'arb'
const SCAN_KEY = process.env.ARB
const TEMPLATE = 'solidly_liquidity'
const ADAPTER = 'solidly_liquidity'

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

// Function to generate the output YAML with anchors and references
function generateYamlContent(
  abiNameFactory: string,
  abiNamePair: string,
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
        '<<': '*refPairSource',
        name: abiNamePair,
        network: config.network,
      },
    ],
  }

  const yamlStr = yaml.dump(yamlContent, { noRefs: true })
  return yamlStr
    .replace(/'\<\<': '\*refFactorySource'/g, '<<: *refFactorySource')
    .replace(/'\<\<': '\*refPairSource'/g, '<<: *refPairSource')
}

// Main function
async function main() {
  const configs: Configs = {}
  const abiNameFactory = getAbiName(0, TEMPLATE)
  const abiNamePair = getAbiName(1, TEMPLATE)
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

  // Get the Factory address and generate first results
  for (const protocolId of Object.keys(protocolsFiltered)) {
    console.log('Processing protocol ' + protocolId)
    const pool = protocolsFiltered[protocolId][0]

    const contract = new ethers.Contract(
      pool.controller as string,
      [
        'function factory() external view returns (address)',
        'function factoryAddress() external view returns (address)',
      ],
      provider
    )

    let factory = ethers.ZeroAddress

    try {
      factory = await contract.factory()
    } catch (e) {
      try {
        factory = await contract.factoryAddress()
      } catch (e) {
        console.log(
          `${protocolId}: Factory not found for pool ${pool.controller}`
        )
      }
    }

    const txHash = await getTxHash(factory, scanUrl[NETWORK], SCAN_KEY)
    const blockNumber = await getBlockNumber(txHash, provider)

    configs[protocolId] = {
      name: abiNameFactory,
      sourceAddress: factory,
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
      abiNamePair,
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
