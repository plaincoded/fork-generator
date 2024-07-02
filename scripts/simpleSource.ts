const yaml = require('js-yaml')
import path from 'path'
import axios from 'axios'
import { ethers } from 'ethers'
import fs from 'fs'
import { RPC, networkMap, scanUrl } from '../config'
import dotenv from 'dotenv'
import { ProtocolInfo } from '../types'

dotenv.config()

// Variables
const NETWORK = 'eth'
const SCAN_KEY = process.env.ETH
const ADAPTER = 'uniswap2_farming'

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

// Get ABI name
function getAbiName(): string {
  // Routes to template
  const templatePath = path.join(__dirname, '../templates', `${ADAPTER}.yaml`)

  // Load YAML files
  let baseDataSource = yaml.load(fs.readFileSync(templatePath, 'utf8'))

  return baseDataSource.refs[0].source.abi
}

// Function to generate the output YAML with anchors and references
function generateYamlContent(abiName: string, configs: ProtocolInfo[]): string {
  const dataSources = configs.map((config: ProtocolInfo) => {
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
  })

  const yamlStr = yaml.dump(dataSources, { noRefs: true })
  return yamlStr.replace(/'\<\<': '\*refSource'/g, '<<: *refSource')
}

function generateYamlFile(protocol: string, module: string, content: string) {
  // Create directories if they don't exist
  if (
    !fs.existsSync(
      `dist/${ADAPTER}/${protocol}.${module}/${networkMap[NETWORK]}`
    )
  ) {
    fs.mkdirSync(
      `dist/${ADAPTER}/${protocol}.${module}/${networkMap[NETWORK]}`,
      { recursive: true }
    )
  }

  // Write the output YAML to a file
  const outputPath = path.join(
    __dirname,
    '../',
    `dist/${ADAPTER}/${protocol}.${module}/${networkMap[NETWORK]}/${ADAPTER}.yaml`
  )
  fs.writeFileSync(outputPath, content, 'utf8')

  console.log(`YAML file generated at: ${outputPath}`)
}

// Main function
async function main() {
  const files = fs.readdirSync('data')
  const raw = []
  const configs: any = {}
  const abiName = getAbiName()

  for (const file of files) {
    const content = fs.readFileSync(`data/${file}`, 'utf-8')
    if (!JSON.parse(content)) continue

    const protocols = JSON.parse(content)

    for (const protocol of protocols) {
      if (protocol.adapterId === ADAPTER && protocol.chain === NETWORK) {
        raw.push(protocol)
      }
    }
  }

  for (let i = 0; i < raw.length; i++) {
    if (!configs[raw[i].protocolId]) {
      configs[raw[i].protocolId] = []
    }

    configs[raw[i].protocolId].push({
      name: abiName + configs[raw[i].protocolId].length,
      sourceAddress: raw[i].controller,
      startBlock: 0,
      network: networkMap[NETWORK],
      module: raw[i].name.toLowerCase().replace(/\s+/g, '_'),
    })
  }

  // Add start block to results using scan
  for (const key of Object.keys(configs)) {
    const protocols = configs[key]
    for (const protocol of protocols) {
      console.log('calling Scan for: ', protocol.sourceAddress)

      const call = await axios.get(
        `${scanUrl[NETWORK]}/api?module=contract&action=getcontractcreation&apikey=${SCAN_KEY}&contractaddresses=${protocol.sourceAddress}`
      )

      if (!call.data.result) continue
      if (!call.data.result[0]) continue

      const txHash = call.data.result[0].txHash

      try {
        const tx = await provider.getTransaction(txHash)
        protocol.startBlock = tx?.blockNumber ?? 0
      } catch (e) {
        console.log('error fetching transaction')
      }
    }
  }
  console.log(configs)

  // Generate YAML files
  for (const key of Object.keys(configs)) {
    const protocol = key.startsWith(`${NETWORK}_`)
      ? key.slice(`${NETWORK}_`.length)
      : key
    const yamlContent = generateYamlContent(abiName, configs[key])
    generateYamlFile(protocol, configs[key][0].module, yamlContent)
  }
}

await main()
