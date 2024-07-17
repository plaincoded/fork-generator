import { ethers } from 'ethers'
import { getFactory } from './common'
import { RPC } from '../config'

const provider = new ethers.JsonRpcProvider(RPC['arb'])

const test = await getFactory(
  // '0x0a239644cb0bc954a8c7ee41b3d5cea01ba3b3a7e38213ac9295c9fe5ac6c46f',
  '0xd4ff51e139eab60e9bfc6fce31a6e78e0951a3eae8c90ffbc1b3b281779b43e3',
  provider
)

console.log(test)
