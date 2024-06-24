import axios from 'axios'
import { ethers } from 'ethers'
import fs from 'fs'
import { RPC, networkMap } from '../config'

// Variables
const ADAPTER = 'uniswap2_liquidity'
const NETWORK = 'base'
const SCAN_KEY = 'SWY52HBFE7RB3JSY26Q3616947I4AIX5CA'
const SCAN_URL = `https://api.basescan.org/api?module=contract&action=getcontractcreation&apikey=${SCAN_KEY}`

// Types
type ProtocolInfo = {
  factoryAddress: string
  startBlock: number
  network: string
}

type FactoryProtocol = {
  [key: string]: ProtocolInfo
}

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

// Function to generate YAML content and write to a file
function generateYamlFile(data: ProtocolInfo, protocol: string) {
  const yamlContent = `
    config:
      - &network ${networkMap[NETWORK]}
      - &factoryAddress '${data.factoryAddress}'
      - &startBlock ${data.startBlock}
      `

  const filename = `dist/${networkMap[NETWORK]}/${protocol}.yaml`

  fs.writeFileSync(filename, yamlContent, 'utf8')
  console.log(`Generated ${filename}`)
}

// Main function
async function main() {
  const files = fs.readdirSync('data')
  const uniswap2 = []
  const aggregated: any = {}
  const factories: FactoryProtocol = {}

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
      ['function factory() external view returns (address)'],
      provider
    )

    try {
      const res = await contract.factory()
      factories[protocolId] = {
        factoryAddress: res,
        startBlock: 0,
        network: NETWORK,
      }
    } catch (e) {
      console.log("it didn't work")
    }
  }

  // Add start block to results using scan
  for (const key of Object.keys(factories)) {
    const protocol = factories[key]
    console.log('calling Scan for: ', protocol.factoryAddress)
    const call = await axios.get(
      SCAN_URL + `&contractaddresses=${protocol.factoryAddress}`
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
    generateYamlFile(factories[key], key)
  }
}

await main()
