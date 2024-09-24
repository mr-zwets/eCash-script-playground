import { Network, NetworkProvider, Utxo } from "cashscript";
import { ChronikClientNode } from 'chronik-client';
const chronik = new ChronikClientNode("https://chronik.pay2stay.com/xec");

export default class ChronikNetworkProvider implements NetworkProvider {
  constructor(
    public network: Network = Network.MAINNET,
  ){}
  async getUtxos(address: string): Promise<Utxo[]> {
    return await chronik.address(address).utxos()
  }

  async getBlockHeight(): Promise<number> {
    const { tipHeight } = await chronik.blockchainInfo();
    return tipHeight;
  }

  async getRawTransaction(txid: string): Promise<string> {
    const { rawTx } = await chronik.rawTx(txid)
    return rawTx as string;
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    return await await chronik.broadcastTx(txHex)
  }
}