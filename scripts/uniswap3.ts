const yaml = require('js-yaml')
import { ethers } from 'ethers'
import { RPC, networkMap, scanUrl } from '../config'
import dotenv from 'dotenv'
import { ProtocolInfo } from '../types'
import {
  getPoolsByAdapter,
  getTxHash,
  getBlockNumber,
  getAbiName,
  generateYamlFile,
} from './common'

dotenv.config()

// Variables
const NETWORK = 'arb'
const SCAN_KEY = process.env.ARB
const ADAPTER = 'uniswap3_liquidity'

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

async function getFactory(poolAddress: string): Promise<string> {
  const poolContract = new ethers.Contract(
    poolAddress,
    ['function factory() external view returns (address)'],
    provider
  )

  const factory = await poolContract.factory()
  return factory
}

async function getPositionManager(txHash: string | null): Promise<string> {
  if (txHash === null) {
    return ethers.ZeroAddress
  }

  const receipt = await provider.getTransactionReceipt(txHash)

  if (receipt == null) {
    return ethers.ZeroAddress
  }

  const eventSignature = ethers.id(
    'IncreaseLiquidity(uint256,uint128,uint256,uint256)'
  )

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

// Function to generate the output YAML with anchors and references
function generateYamlContent(
  abiNameFactory: string,
  abiNamePositionManager: string,
  configFactory: ProtocolInfo,
  configPositionManager: ProtocolInfo
): string {
  const yamlContent = {
    dataSources: [
      {
        '<<': '*refFactorySource',
        name: abiNameFactory,
        network: configFactory.network,
        source: {
          address: configFactory.sourceAddress,
          abi: abiNameFactory,
          startBlock: configFactory.startBlock,
        },
      },
      {
        '<<': '*refPositionManagerSource',
        name: abiNamePositionManager,
        network: configPositionManager.network,
        source: {
          address: configPositionManager.sourceAddress,
          abi: abiNamePositionManager,
          startBlock: configPositionManager.startBlock,
        },
      },
    ],
  }

  const yamlStr = yaml.dump(yamlContent, { noRefs: true })
  return yamlStr
    .replace(/'\<\<': '\*refFactorySource'/g, '<<: *refFactorySource')
    .replace(
      /'\<\<': '\*refPositionManagerSource'/g,
      '<<: *refPositionManagerSource'
    )
}

// Main function
async function main() {
  const configs: any = {}
  const abiNameFactory = getAbiName(0, ADAPTER)
  const abiNamePositionManager = getAbiName(1, ADAPTER)

  const protocols = getPoolsByAdapter(ADAPTER, NETWORK)

  for (const protocolId of Object.keys(protocols)) {
    console.log(`starting Protocol ${protocolId}`)
    const pool = protocols[protocolId][0]

    // Factory config
    const factory = await getFactory(pool.controller)
    const factoryTxHash = await getTxHash(factory, scanUrl[NETWORK], SCAN_KEY)
    const factoryBlockNumber = await getBlockNumber(factoryTxHash, provider)

    const configFactory = {
      name: abiNameFactory,
      sourceAddress: factory,
      startBlock: factoryBlockNumber,
      network: networkMap[NETWORK],
      module: pool.name.toLowerCase().replace(/\s+/g, '_'),
    }

    for (let i = 0; i < protocols[protocolId].length; i++) {
      const pool = protocols[protocolId][i]

      // Position Manager config
      const poolTxHash = await getTxHash(
        pool.controller,
        scanUrl[NETWORK],
        SCAN_KEY
      )
      const positionManager = await getPositionManager(poolTxHash)

      if (
        positionManager == ethers.ZeroAddress &&
        i < protocols[protocolId].length - 1
      )
        continue

      const positionManagerTxHash = await getTxHash(
        positionManager,
        scanUrl[NETWORK],
        SCAN_KEY
      )
      const positionManagerBlockNumber = await getBlockNumber(
        positionManagerTxHash,
        provider
      )

      const configPositionManager = {
        name: abiNamePositionManager,
        sourceAddress: positionManager,
        startBlock: positionManagerBlockNumber,
        network: networkMap[NETWORK],
        module: pool.name.toLowerCase().replace(/\s+/g, '_'),
      }
      configs[protocolId] = [configFactory, configPositionManager]

      if (configPositionManager.sourceAddress === ethers.ZeroAddress) {
        console.log(`Position Manager from Protocol ${protocolId} NOT found!`)
      }

      break
    }
  }

  // Generate YAML files
  for (const key of Object.keys(configs)) {
    const protocol = key.startsWith(`${NETWORK}_`)
      ? key.slice(`${NETWORK}_`.length)
      : key
    const yamlContent = generateYamlContent(
      abiNameFactory,
      abiNamePositionManager,
      configs[key][0],
      configs[key][1]
    )
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
