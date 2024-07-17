const yaml = require('js-yaml')
import fs from 'fs'
import { ethers } from 'ethers'
import axios from 'axios'
import path from 'path'
import { Signatures } from '../types'
import { networkMap, scanKeys, scanUrl } from '../config'
import { formatEventWithInputs } from './utils/events'
import { wait } from './utils/wait'

export type PoolByAdapter = {
  chain: string
  controller: string
  id: string
  protocolId: string
  name: string
  adapterId: string
}

export function getPoolsByAdapter(
  adapter: string,
  network: string
): { [key: string]: PoolByAdapter[] } {
  const files = fs.readdirSync('data')
  const byProtocol: { [key: string]: PoolByAdapter[] } = {}

  for (const file of files) {
    const content = fs.readFileSync(`data/${file}`, 'utf-8')
    if (!JSON.parse(content)) continue

    const contents = JSON.parse(content)

    for (const pool of contents) {
      // If it's not of our interest, continue loop and do nothing
      if (pool.adapterId !== adapter || pool.chain !== network) continue
      if (!byProtocol[pool.protocolId]) byProtocol[pool.protocolId] = []
      byProtocol[pool.protocolId].push(pool as PoolByAdapter)
    }
  }

  return byProtocol
}

export async function filterPoolsBySignature(
  template: string,
  adapter: string,
  pools: {
    [key: string]: PoolByAdapter[]
  },
  signatures: Signatures,
  network: keyof typeof networkMap,
  provider: ethers.JsonRpcProvider,
  implementations: string[] | null = null
): Promise<{ [key: string]: PoolByAdapter[] }> {
  let result: { [key: string]: PoolByAdapter[] } = {}
  let failedProtocols: string[] = []
  let failedModules: string[] = []

  for (const protocol of Object.keys(pools)) {
    console.log(`Filtering signatures to protocol ${protocol}`)

    for (let i = 0; i < pools[protocol].length; i++) {
      let abi: any
      if (implementations == null) {
        abi = await fetchAbi(pools[protocol][i].controller, network)
      } else {
        abi = await fetchAbi(implementations[i], network)
      }

      if (!abi) {
        console.log(`Protocol ${protocol} has contracts NOT verified`)

        if (!failedProtocols.includes(protocol)) {
          failedProtocols.push(protocol)
          failedModules.push(pools[protocol][i].name)
        }

        continue
      }

      const events = abi.filter((item: any) => item.type === 'event')
      const functions = abi.filter((item: any) => item.type === 'function')

      let eventsList = events.map((x: any) =>
        formatEventWithInputs(x.name, x.inputs)
      )
      let functionsList = functions.map((x: any) =>
        formatEventWithInputs(x.name, x.inputs)
      )

      if (isProxy(eventsList)) {
        const implementation = await getImplementation(
          pools[protocol][i].controller,
          provider
        )

        const abi = await fetchAbi(implementation, network)

        if (!abi) {
          console.log(`Protocol ${protocol} has contracts NOT verified`)

          if (!failedProtocols.includes(protocol)) {
            failedProtocols.push(protocol)
            failedModules.push(pools[protocol][i].name)
          }

          continue
        }

        const events = abi.filter((item: any) => item.type === 'event')
        const functions = abi.filter((item: any) => item.type === 'function')

        eventsList = events.map((x: any) =>
          formatEventWithInputs(x.name, x.inputs)
        )
        functionsList = functions.map((x: any) =>
          formatEventWithInputs(x.name, x.inputs)
        )
      }

      if (!signatures.events.every((item) => eventsList.includes(item))) {
        console.log(`Event signature NOT matching: ${protocol}`)

        if (!failedProtocols.includes(protocol)) {
          failedProtocols.push(protocol)
          failedModules.push(pools[protocol][i].name)
        }

        continue
      }

      if (!signatures.functions.every((item) => functionsList.includes(item))) {
        console.log(`Function signature NOT matching: ${protocol}`)

        if (!failedProtocols.includes(protocol)) {
          failedProtocols.push(protocol)
          failedModules.push(pools[protocol][i].name)
        }

        continue
      }

      if (!result[protocol]) {
        result[protocol] = []
      }

      result[protocol].push(pools[protocol][i])
    }

    await wait(1000)
  }

  logFailedProtocols(template, adapter, network, failedProtocols, failedModules)

  return result
}

export async function getImplementation(
  proxy: string,
  provider: ethers.JsonRpcProvider
): Promise<string> {
  const storage = await provider.getStorage(
    proxy,
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
  )

  return '0x' + storage.slice(storage.length - 40, storage.length)
}

export async function getBlockNumber(
  txHash: string | null,
  provider: ethers.JsonRpcProvider
): Promise<number> {
  if (txHash === null) {
    return 0
  }

  const tx = await provider.getTransaction(txHash)
  return tx?.blockNumber ?? 0
}

export async function getTxHash(
  address: string,
  scanUrl: string,
  scanKey: string | undefined
): Promise<string | null> {
  if (address === ethers.ZeroAddress) {
    return null
  }

  const call = await axios.get(
    `${scanUrl}/api?module=contract&action=getcontractcreation&apikey=${scanKey}&contractaddresses=${address}`
  )

  return call.data.result[0].txHash
}

export async function getFactory(
  txHash: string | null,
  provider: ethers.JsonRpcProvider
): Promise<string | null> {
  if (txHash === null) {
    return null
  }

  const tx = await provider.getTransaction(txHash)

  if (!tx || tx.to === null) {
    return null
  }

  const code = await provider.getCode(tx.to)

  if (code === '0x') {
    return null
  }

  return tx.to
}

// Get ABI name
export function getAbiName(refPosition: number, template: string): string {
  // Routes to template
  const templatePath = path.join(
    __dirname,
    '..',
    'templates',
    template,
    `${template}.yaml`
  )

  // Load YAML files
  let baseDataSource = yaml.load(fs.readFileSync(templatePath, 'utf8'))

  return baseDataSource.refs[refPosition].source.abi
}

// Function to generate YAML content and write to a file
export function generateYamlFile(
  module: string,
  template: string,
  adapter: string,
  network: string,
  protocol: string,
  content: string
) {
  // Create directories if they don't exist
  if (
    !fs.existsSync(
      `dist/${template}/${adapter}/${protocol}.${module}/${network}`
    )
  ) {
    fs.mkdirSync(
      `dist/${template}/${adapter}/${protocol}.${module}/${network}`,
      {
        recursive: true,
      }
    )
  }

  // Write the output YAML to a file
  const outputPath = path.join(
    __dirname,
    '../',
    `dist/${template}/${adapter}/${protocol}.${module}/${network}/${template}.yaml`
  )
  fs.writeFileSync(outputPath, content, 'utf8')

  console.log(`YAML file generated at: ${outputPath}`)
}

export async function fetchAbi(
  contract: string,
  network: keyof typeof networkMap
) {
  const url = `${scanUrl[network]}/api?module=contract&action=getabi&address=${contract}&apikey=${scanKeys[network]}`
  try {
    const result = await axios.get(url)
    return JSON.parse(result.data.result)
  } catch (err) {
    console.log(`Contract ${contract} NOT verified`)
    return null
  }
}

export function isProxy(events: string[]): boolean {
  return events.includes('Upgraded(indexed address)')
}

export function getSignatures(template: string): Signatures {
  const filePath = path.join(__dirname, '..', 'templates', template, 'sig.json')
  const signaturesJson = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(signaturesJson)
}

export function logFailedProtocols(
  template: string,
  adapter: string,
  network: string,
  protocols: string[],
  modules: string[]
) {
  // Create directories if they don't exist
  if (!fs.existsSync(`logs/${template}/${adapter}/${network}`)) {
    fs.mkdirSync(`logs/${template}/${adapter}/${network}`, {
      recursive: true,
    })
  }

  const content = protocols.map((item, index) => {
    return {
      template,
      adapter,
      network,
      protocol: item,
      module: modules[index],
    }
  })

  const outputPath = path.join(
    __dirname,
    '../',
    `logs/${template}/${adapter}/${network}/${template}.${adapter}.yaml`
  )
  fs.writeFileSync(outputPath, JSON.stringify(content), 'utf8')
}
