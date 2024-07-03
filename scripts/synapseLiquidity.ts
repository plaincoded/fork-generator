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
const NETWORK = 'eth'
const SCAN_KEY = process.env.ETH
const ADAPTER = 'synapse_liquidity'

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

async function getTx(
  address: string
): Promise<ethers.TransactionResponse | null> {
  const call = await axios.get(
    `${scanUrl[NETWORK]}/api?module=contract&action=getcontractcreation&apikey=${SCAN_KEY}&contractaddresses=${address}`
  )

  const txHash = call.data.result[0].txHash
  const tx = await provider.getTransaction(txHash)

  return tx
}

// Main function
async function main() {
  const configs: Configs = {}
  const abiNameFactory = getAbiName(0)
  const abiNamePool = getAbiName(1)

  const protocols = getPoolsByAdapter(ADAPTER, NETWORK)

  for (const protocolId of Object.keys(protocols)) {
    const pool = protocols[protocolId][0]

    configs[protocolId] = {
      name: abiNameFactory,
      sourceAddress: pool.controller,
      startBlock: 0,
      network: networkMap[NETWORK],
      module: pool.name.toLowerCase().replace(/\s+/g, '_'),
    }
  }

  // Add start block to results using scan
  for (const key of Object.keys(configs)) {
    const config = configs[key]

    // Get contract creator (factory)
    console.log('calling Scan for: ', config.sourceAddress)
    let tx = await getTx(config.sourceAddress)
    const factoryAddress = tx?.to ?? ethers.ZeroAddress
    configs[key].sourceAddress = factoryAddress

    // Get start block creation of factory
    console.log('calling Scan for: ', factoryAddress)
    tx = await getTx(factoryAddress)
    configs[key].startBlock = tx?.blockNumber ?? 0
  }
  console.log(configs)

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
    generateYamlFile(configs[key], protocol, yamlContent)
  }
}

await main()
