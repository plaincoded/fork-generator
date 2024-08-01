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
import fs from 'fs'
import path from 'path'

dotenv.config()

// Variables
const NETWORK = 'eth'
const SCAN_KEY = process.env.ETH
const TEMPLATE = 'aave2_lending'
const ADAPTER = 'aave_proxy_lending'

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

// Function to generate the output YAML with anchors and references
function generateYamlContent(
  abiNameAddressProviderRegistry: string,
  abiNameAddressProvider: string,
  abiNameLendingPool: string,
  abiNameAToken: string,
  config: ProtocolInfo
): string {
  const yamlContent = {
    dataSources: [
      {
        '<<': '*refLendingPoolAddressProviderRegistry',
        name: abiNameAddressProviderRegistry,
        network: config.network,
        source: {
          address: config.sourceAddress,
          abi: abiNameAddressProviderRegistry,
          startBlock: config.startBlock,
        },
      },
    ],
    templates: [
      {
        '<<': '*refLendingPoolAddressProvider',
        name: abiNameAddressProvider,
        network: config.network,
      },
      {
        '<<': '*refLendingPool',
        name: abiNameLendingPool,
        network: config.network,
      },
      {
        '<<': '*refAtoken',
        name: abiNameAToken,
        network: config.network,
      },
    ],
  }

  const yamlStr = yaml.dump(yamlContent, { noRefs: true })
  return yamlStr
    .replace(
      /'\<\<': '\*refLendingPoolAddressProviderRegistry'/g,
      '<<: *refLendingPoolAddressProviderRegistry'
    )
    .replace(
      /'\<\<': '\*refLendingPoolAddressProvider'/g,
      '<<: *refLendingPoolAddressProvider'
    )
    .replace(/'\<\<': '\*refLendingPool'/g, '<<: *refLendingPool')
    .replace(/'\<\<': '\*refAtoken'/g, '<<: *refAtoken')
}

// Main function
async function main() {
  const configs: Configs = {}
  const abiNameAddressProviderRegistry = getAbiName(0, TEMPLATE)
  const abiNameAddressProvider = getAbiName(1, TEMPLATE)
  const abiNameLendingPool = getAbiName(2, TEMPLATE)
  const abiNameAToken = getAbiName(3, TEMPLATE)

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
    console.log('Processing protocol ' + protocolId)
    const pool = protocolsFiltered[protocolId][0]

    // Get Registry contract from config file
    const filePath = path.join(
      __dirname,
      '..',
      'templates',
      TEMPLATE,
      'config.json'
    )
    const registryConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'))

    let addressProviderRegistry: string

    if (registryConfig[NETWORK] && registryConfig[NETWORK][pool.controller]) {
      addressProviderRegistry = registryConfig[NETWORK][pool.controller]
    } else {
      console.log(`Protocol ${protocolId} does not have a registry`)
      continue
    }

    const txHash = await getTxHash(
      addressProviderRegistry,
      scanUrl[NETWORK],
      SCAN_KEY
    )
    const blockNumber = await getBlockNumber(txHash, provider)

    configs[protocolId] = {
      name: abiNameAddressProvider,
      sourceAddress: addressProviderRegistry,
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
      abiNameAddressProviderRegistry,
      abiNameAddressProvider,
      abiNameLendingPool,
      abiNameAToken,
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
