export type ProtocolInfo = {
  sourceAddress: string
  startBlock: number
  network: string
  module: string
}

export type FactoryProtocol = {
  [key: string]: ProtocolInfo
}
