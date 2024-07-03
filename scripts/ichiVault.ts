const yaml = require('js-yaml')
import axios from 'axios'
import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { RPC, networkMap, scanUrl } from '../config'
import dotenv from 'dotenv'
import { ProtocolInfo, Configs } from '../types'
import { getPoolsByAdapter } from './common'

dotenv.config()

// Variables
const NETWORK = 'base'
const SCAN_KEY = process.env.BASE
const ADAPTER = 'ichi_v1_vault_yield'

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

// Get ABI name
function getAbiName(refPosition: number): string {
  // Routes to template
  const templatePath = path.join(__dirname, '../templates', `${ADAPTER}.yaml`)

  // Load YAML files
  let baseDataSource = yaml.load(fs.readFileSync(templatePath, 'utf8'))

  return baseDataSource.refs[refPosition].source.abi
}

// Function to generate the output YAML with anchors and references
function generateYamlContent(
  abiNameFactory: string,
  abiNameVault: string,
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
        '<<': '*refVaultSource',
        name: abiNameVault,
        network: config.network,
      },
    ],
  }

  const yamlStr = yaml.dump(yamlContent, { noRefs: true })
  return yamlStr
    .replace(/'\<\<': '\*refFactorySource'/g, '<<: *refFactorySource')
    .replace(/'\<\<': '\*refVaultSource'/g, '<<: *refVaultSource')
}

// Function to generate YAML content and write to a file
function generateYamlFile(
  config: ProtocolInfo,
  protocol: string,
  content: string
) {
  // Create directories if they don't exist
  if (
    !fs.existsSync(
      `dist/${ADAPTER}/${protocol}.${config.module}/${networkMap[NETWORK]}`
    )
  ) {
    fs.mkdirSync(
      `dist/${ADAPTER}/${protocol}.${config.module}/${networkMap[NETWORK]}`,
      { recursive: true }
    )
  }

  // Write the output YAML to a file
  const outputPath = path.join(
    __dirname,
    '../',
    `dist/${ADAPTER}/${protocol}.${config.module}/${networkMap[NETWORK]}/${ADAPTER}.yaml`
  )
  fs.writeFileSync(outputPath, content, 'utf8')

  console.log(`YAML file generated at: ${outputPath}`)
}

// Main function
async function main() {
  const configs: Configs = {}
  const abiNameFactory = getAbiName(0)
  const abiNameVault = getAbiName(1)

  const protocols = getPoolsByAdapter(ADAPTER, NETWORK)

  for (const protocolId of Object.keys(protocols)) {
    const pool = protocols[protocolId][0]

    const contract = new ethers.Contract(
      pool.controller as string,
      [
        'function factory() external view returns (address)',
        'function ichiVaultFactory() external view returns (address)',
      ],
      provider
    )

    try {
      const res = await contract.factory()
      configs[protocolId] = {
        name: abiNameFactory,
        sourceAddress: res,
        startBlock: 0,
        network: networkMap[NETWORK],
        module: pool.name.toLowerCase().replace(/\s+/g, '_'),
      }
    } catch (e) {
      try {
        const res = await contract.ichiVaultFactory()
        configs[protocolId] = {
          name: abiNameFactory,
          sourceAddress: res,
          startBlock: 0,
          network: networkMap[NETWORK],
          module: pool.name.toLowerCase().replace(/\s+/g, '_'),
        }
      } catch (e) {
        console.log(
          `${protocolId}: Factory not found for pool ${pool.controller}`
        )
      }
    }
  }

  // Add start block to results using scan
  for (const key of Object.keys(configs)) {
    const config = configs[key]
    console.log('calling Scan for: ', config.sourceAddress)
    const call = await axios.get(
      `${scanUrl[NETWORK]}/api?module=contract&action=getcontractcreation&apikey=${SCAN_KEY}&contractaddresses=${config.sourceAddress}`
    )

    if (!call.data.result) continue
    if (!call.data.result[0]) continue

    const txHash = call.data.result[0].txHash

    try {
      const tx = await provider.getTransaction(txHash)
      configs[key].startBlock = tx?.blockNumber ?? 0
    } catch (e) {
      console.log('error fetching transaction')
    }
  }
  console.log(configs)

  // Generate YAML files
  for (const key of Object.keys(configs)) {
    const protocol = key.startsWith(`${NETWORK}_`)
      ? key.slice(`${NETWORK}_`.length)
      : key
    const yamlContent = generateYamlContent(
      abiNameFactory,
      abiNameVault,
      configs[key]
    )
    generateYamlFile(configs[key], protocol, yamlContent)
  }
}

await main()
