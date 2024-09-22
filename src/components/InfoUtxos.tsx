import React from 'react'
import { Utxo } from 'cashscript'

interface Props {
  utxos: Utxo[] | undefined,
}

const InfoUtxos: React.FC<Props> = ({ utxos }) => {
  return (
    <>
      {utxos?.map((utxo, index) => {
        return (
        <div style={{ marginLeft: "20px", marginTop: "5px" }} key={`utxo-index${index}`}>
          <b>{`----- UTXO ${index} -----`}</b> <br />
          {"amount: " + utxo.satoshis + "sats"} <br />
        </div>)})}
    </>
  )
}

export default InfoUtxos
