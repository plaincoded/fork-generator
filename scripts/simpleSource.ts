const yaml = require('js-yaml')
import { ethers } from 'ethers'
import { RPC, networkMap, scanKeys, scanUrl } from '../config'
import dotenv from 'dotenv'
import { ProtocolInfo } from '../types'
import {
  getAbiName,
  generateYamlFile,
  getPoolsByAdapter,
  getTxHash,
  getBlockNumber,
  fetchAbi,
  isProxy,
} from './common'
import { formatEventWithInputs } from './utils/events'
import { wait } from './utils/wait'

dotenv.config()

// Variables
// const NETWORK = 'bsc'
// const SCAN_KEY = process.env.BSC
// const ADAPTER = 'curve_locked'
const NETWORK = 'arb'
const SCAN_KEY = scanKeys[NETWORK]
const ADAPTER = 'token_parse_staked_adapter'
const EXPECTED_EVENT = 'Staked(indexed address,uint256)'

// Provider
const provider = new ethers.JsonRpcProvider(RPC[NETWORK])

// Function to generate the output YAML with anchors and references
function generateYamlContent(abiName: string, configs: ProtocolInfo[]): string {
  const dataSources = {
    dataSources: configs.map((config: ProtocolInfo) => {
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
    }),
  }

  const yamlStr = yaml.dump(dataSources, { noRefs: true })
  return yamlStr.replace(/'\<\<': '\*refSource'/g, '<<: *refSource')
}

// Main function
async function main() {
  const configs: any = {}
  const abiName = getAbiName(0, ADAPTER)
  const protocols = getPoolsByAdapter(ADAPTER, NETWORK)

  for (const protocolId of Object.keys(protocols)) {
    console.log('Starting protocol ' + protocolId)

    for (let i = 0; i < protocols[protocolId].length; i++) {
      if (!configs[protocolId]) {
        configs[protocolId] = []
      }

      const txHash = await getTxHash(
        protocols[protocolId][i].controller,
        scanUrl[NETWORK],
        SCAN_KEY
      )

      const blockNumber = await getBlockNumber(txHash, provider)
      const abi = await fetchAbi(protocols[protocolId][i].controller, NETWORK)
      const events = abi.filter((x: any) => x.type === 'event')
      const eventsList = events.map((x: any) =>
        formatEventWithInputs(x.name, x.inputs)
      )

      const proxy = isProxy(eventsList)

      if (proxy) {
        const storage = await provider.getStorage(
          protocols[protocolId][i].controller,
          '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
        )
        const implementation =
          '0x' + storage.slice(storage.length - 40, storage.length)

        console.log('Implementation:', implementation)
        console.log('Proxy:', protocols[protocolId][i].controller)

        const implementationAbi = await fetchAbi(implementation, NETWORK)
        const implementationEvents = implementationAbi.filter(
          (x: any) => x.type === 'event'
        )
        const implementationEventsList = implementationEvents.map((x: any) =>
          formatEventWithInputs(x.name, x.inputs)
        )

        console.log(implementationEventsList)

        await wait(2000)
        continue
      }

      console.log('Implementation:', protocols[protocolId][i].controller)
      console.log(eventsList)

      // if (
      //   !events.some(
      //     (x: any) => formatEventWithInputs(x.name, x.inputs) === EXPECTED_EVENT
      //   )
      // ) {

      //   continue;
      // }

      configs[protocolId].push({
        name: abiName + configs[protocolId].length,
        sourceAddress: protocols[protocolId][i].controller,
        startBlock: blockNumber,
        network: networkMap[NETWORK],
        module: protocols[protocolId][i].name
          .toLowerCase()
          .replace(/\s+/g, '_'),
      })
    }
  }

  // Generate YAML files
  for (const key of Object.keys(configs)) {
    const protocol = key.startsWith(`${NETWORK}_`)
      ? key.slice(`${NETWORK}_`.length)
      : key
    const yamlContent = generateYamlContent(abiName, configs[key])
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
