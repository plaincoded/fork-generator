export type ProtocolInfo = {
  name: string
  sourceAddress: string
  startBlock: number
  network: string
  module: string
}

export type FactoryProtocol = {
  [key: string]: ProtocolInfo
}
