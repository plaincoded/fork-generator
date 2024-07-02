const yaml = require('js-yaml')
import axios from 'axios'
import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { RPC, networkMap, scanUrl } from '../config'
import dotenv from 'dotenv'
import { ProtocolInfo, FactoryProtocol } from '../types'

dotenv.config()

// Variables
const NETWORK = 'eth'
const SCAN_KEY = process.env.ETH
const ADAPTER = 'uniswap2_liquidity'

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
  const files = fs.readdirSync('data')
  const uniswap2 = []
  const aggregated: any = {}
  const factories: FactoryProtocol = {}
  const abiNameFactory = getAbiName(0)
  const abiNamePair = getAbiName(1)

  for (const file of files) {
    const content = fs.readFileSync(`data/${file}`, 'utf-8')
    if (!JSON.parse(content)) continue

    const protocols = JSON.parse(content)

    for (const protocol of protocols) {
      if (protocol.adapterId === ADAPTER && protocol.chain === NETWORK) {
        uniswap2.push(protocol)
      }
    }
  }

  for (const protocol of uniswap2) {
    if (!aggregated[protocol.protocolId]) aggregated[protocol.protocolId] = []

    aggregated[protocol.protocolId].push(protocol)
  }

  // Get the Factory address and generate first results
  for (const protocolId of Object.keys(aggregated)) {
    const pool = aggregated[protocolId][0]

    const contract = new ethers.Contract(
      pool.controller as string,
      [
        'function factory() external view returns (address)',
        'function factoryAddress() external view returns (address)',
      ],
      provider
    )

    try {
      const res = await contract.factory()
      factories[protocolId] = {
        name: abiNameFactory,
        sourceAddress: res,
        startBlock: 0,
        network: networkMap[NETWORK],
        module: pool.name.toLowerCase().replace(/\s+/g, '_'),
      }
    } catch (e) {
      try {
        const res = await contract.factoryAddress()
        factories[protocolId] = {
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
  for (const key of Object.keys(factories)) {
    const protocol = factories[key]
    console.log('calling Scan for: ', protocol.sourceAddress)
    const call = await axios.get(
      `${scanUrl[NETWORK]}/api?module=contract&action=getcontractcreation&apikey=${SCAN_KEY}&contractaddresses=${protocol.sourceAddress}`
    )

    if (!call.data.result) continue
    if (!call.data.result[0]) continue

    const txHash = call.data.result[0].txHash

    try {
      const tx = await provider.getTransaction(txHash)
      factories[key].startBlock = tx?.blockNumber ?? 0
    } catch (e) {
      console.log('error fetching transaction')
    }
  }
  console.log(factories)

  // Generate YAML files
  for (const key of Object.keys(factories)) {
    const protocol = key.startsWith(`${NETWORK}_`)
      ? key.slice(`${NETWORK}_`.length)
      : key
    const yamlContent = generateYamlContent(
      abiNameFactory,
      abiNamePair,
      factories[key]
    )
    generateYamlFile(factories[key], protocol, yamlContent)
  }
}

await main()
