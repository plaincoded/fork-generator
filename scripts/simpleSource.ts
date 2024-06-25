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
const ADAPTER = 'compound_lending2'

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

// Function to generate YAML content and write to a file
function generateYamlFile(data: ProtocolInfo[], protocol: string) {
  // Create directories if they don't exist
  if (!fs.existsSync(`dist/${ADAPTER}`)) {
    fs.mkdirSync(`dist/${ADAPTER}`)
  }

  if (!fs.existsSync(`dist/${ADAPTER}/${networkMap[NETWORK]}`)) {
    fs.mkdirSync(`dist/${ADAPTER}/${networkMap[NETWORK]}`)
  }

  // Create files
  let yamlContent: string = ''
  for (let i = 0; i < data.length; i++) {
    yamlContent =
      yamlContent +
      `
      config${i}:
        - &network ${data[i].network}
        - &sourceAddress '${data[i].sourceAddress}'
        - &startBlock ${data[i].startBlock}
        `
  }

  const filename = `dist/${ADAPTER}/${
    networkMap[NETWORK]
  }/${protocol}.${data[0].module
    .toLowerCase()
    .replace(/\s+/g, '_')}.${ADAPTER}.yaml`

  fs.writeFileSync(filename, yamlContent, 'utf8')
  console.log(`Generated ${filename}`)
}

// Main function
async function main() {
  const files = fs.readdirSync('data')
  const raw = []
  const aggregated: any = {}

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

  for (const protocol of raw) {
    if (!aggregated[protocol.protocolId]) aggregated[protocol.protocolId] = []

    aggregated[protocol.protocolId].push({
      sourceAddress: protocol.controller,
      startBlock: 0,
      network: NETWORK,
      module: protocol.name,
    })
  }

  // Add start block to results using scan
  for (const key of Object.keys(aggregated)) {
    const protocols = aggregated[key]
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
  console.log(aggregated)

  // Generate YAML files
  for (const key of Object.keys(aggregated)) {
    generateYamlFile(aggregated[key], key)
  }
}

await main()
