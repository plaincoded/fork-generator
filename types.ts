export type ProtocolInfo = {
  name: string
  sourceAddress: string
  startBlock: number
  network: string
  module: string
}

export type Configs = {
  [key: string]: ProtocolInfo
}
