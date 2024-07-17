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
const NETWORK = 'eth'
const SCAN_KEY = process.env.ETH
const TEMPLATE = 'compound2'
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

async function getCompoundImplementations(
  proxyAddresses: string[],
  provider: ethers.JsonRpcProvider
): Promise<string[]> {
  const implementations: string[] = await Promise.all(
    proxyAddresses.map((proxyAddress) => {
      const proxyContract = new ethers.Contract(
        proxyAddress,
        [
          'function comptrollerImplementation() external view returns (address)',
        ],
        provider
      )

      return proxyContract.comptrollerImplementation()
    })
  )

  return implementations
}

// Main function
async function main() {
  const configs: Configs = {}
  const abiNameComptroller = getAbiName(0, TEMPLATE)
  const abiNameCToken = getAbiName(1, TEMPLATE)

  const protocols = getPoolsByAdapter(ADAPTER, NETWORK)

  // Check if events and function are correct
  const signatures = getSignatures(TEMPLATE)
  const implementations = await getCompoundImplementations(
    Object.values(protocols).map((item) => item[0].controller),
    provider
  )

  let protocolsFiltered = await filterPoolsBySignature(
    TEMPLATE,
    ADAPTER,
    protocols,
    signatures,
    NETWORK,
    provider,
    implementations
  )
  console.log('Event and Function Signatures checked!')

  for (const protocolId of Object.keys(protocolsFiltered)) {
    console.log('Processing protocol ' + protocolId)
    const pool = protocolsFiltered[protocolId][0]

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
      TEMPLATE,
      ADAPTER,
      networkMap[NETWORK],
      protocol,
      yamlContent
    )
  }
}

await main()
