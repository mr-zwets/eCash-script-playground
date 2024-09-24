import { binToHex, decodeCashAddress } from "@bitauth/libauth";
import { Network, NetworkProvider, Utxo } from "cashscript";
import { ChronikClientNode } from 'chronik-client';
const chronik = new ChronikClientNode("https://chronik.pay2stay.com/xec");

export default class ChronikNetworkProvider implements NetworkProvider {
  constructor(
    public network: Network = Network.MAINNET,
  ){}
  async getUtxos(address: string): Promise<Utxo[]> {
    const scriptHashObj = decodeCashAddress(address)
    if(typeof scriptHashObj == "string") throw new Error("decodeCashAddress")
    const chronikUtxosResponse = await chronik.script("p2sh", binToHex(scriptHashObj.payload)).utxos()
    const utxos: Utxo[] = chronikUtxosResponse.utxos.map(chronikUtxo =>
    ({
      satoshis : chronikUtxo.value,
      txid: chronikUtxo.outpoint.txid,
      vout: chronikUtxo.outpoint.outIdx
    })
    )
    return utxos
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
    const { txid } = await chronik.broadcastTx(txHex)
    return txid
  }
}