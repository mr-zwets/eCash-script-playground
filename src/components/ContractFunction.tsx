import React, { useState, useEffect } from 'react'
import { AbiFunction, NetworkProvider, Argument, Recipient, SignatureTemplate } from 'cashscript'
import { Form, InputGroup, Button, Card } from 'react-bootstrap'
import { readAsType, ExplorerString, Wallet, NamedUtxo, ContractInfo } from './shared'

interface Props {
  contractInfo: ContractInfo
  abi?: AbiFunction
  provider: NetworkProvider
  wallets: Wallet[]
  updateUtxosContract: (contractName: string) => void
}

const ContractFunction: React.FC<Props> = ({ contractInfo, abi, provider, wallets, updateUtxosContract }) => {
  const [functionArgs, setFunctionArgs] = useState<Argument[]>([])
  const [outputs, setOutputs] = useState<Recipient[]>([{ to: '', amount: 0 }])
  // transaction inputs, not the same as abi.inputs
  const [inputs, setInputs] = useState<NamedUtxo[]>([{ txid: '', vout: 0, satoshis: 0, name: ``, isP2pkh: false }])
  const [manualSelection, setManualSelection] = useState<boolean>(false)
  const [noAutomaticChange, setNoAutomaticChange] = useState<boolean>(false)
  const [namedUtxoList, setNamedUtxoList] = useState<NamedUtxo[]>([])

  const contract = contractInfo.contract
  const contractUtxos = contractInfo.utxos

  useEffect(() => {
    // Set empty strings as default values
    const newArgs = abi?.inputs.map(() => '') || [];
    setFunctionArgs(newArgs);
  }, [abi])

  useEffect(() => {
    if (!manualSelection) return;
    async function updateUtxos() {
      if (contractInfo.contract === undefined || contractUtxos === undefined) return
      const namedUtxosContract: NamedUtxo[] = contractUtxos.map((utxo, index) => ({ ...utxo, name: `${contract.name} UTXO ${index}`, isP2pkh: false }))
      let newNamedUtxoList = namedUtxosContract
      const walletUtxos = wallets.map(wallet => wallet?.utxos ?? [])
      for (let i = 0; i < (walletUtxos?.length ?? 0); i++) {
        const utxosWallet = walletUtxos?.[i];
        if(!utxosWallet) continue
        const namedUtxosWallet: NamedUtxo[] = utxosWallet.map((utxo, index) => (
          { ...utxo, name: `${wallets[i].walletName} UTXO ${index}`, isP2pkh: true, walletIndex: i }
        ))
        newNamedUtxoList = newNamedUtxoList.concat(namedUtxosWallet)
      }
      setNamedUtxoList(newNamedUtxoList);
    }
    updateUtxos()
  }, [manualSelection, contractInfo])

  function fillPrivKey(i: number, walletIndex: string) {
    const argsCopy = [...functionArgs];
    // if no wallet is selected in select form
    if (isNaN(Number(walletIndex))) argsCopy[i] = ''
    else {
      argsCopy[i] = new SignatureTemplate(wallets[Number(walletIndex)].privKey);
    }
    setFunctionArgs(argsCopy);
  }

  function selectInput(i: number, inputIndex: string) {
    const inputsCopy = [...inputs];
    // if no input is selected in select form
    if (isNaN(Number(inputIndex))) inputsCopy[i] = { txid: '', vout: 0, satoshis: 0, name: ``, isP2pkh: false }
    else {
      inputsCopy[i] = namedUtxoList[Number(inputIndex)];
    }
    setInputs(inputsCopy);
  }

  const argumentFields = abi?.inputs.map((input, i) => (
    <InputGroup key={`${input.name}-parameter-${i}`}>
      {input.type === 'sig' ? (
        <><Form.Control size="sm" id={`${input.name}-parameter-${i}`} disabled
          placeholder={`${input.type} ${input.name}`}
          aria-label={`${input.type} ${input.name}`}
        />
          <Form.Control as="select" size="sm" onChange={event => fillPrivKey(i, event.target.value)}>
            <option className="text-center" key={`NaN`} value={`NaN`}>select wallet</option>
            {wallets.map((wallet, walletIndex) => (
              <option className="text-center" key={`${walletIndex + wallet.walletName}`} value={`${walletIndex}`}>{wallet.walletName}</option>
            ))}
          </Form.Control></>
      ) : (
        <Form.Control size="sm" id={`${input.name}-parameter-${i}`}
          placeholder={`${input.type} ${input.name}`}
          aria-label={`${input.type} ${input.name}`}
          onChange={(event) => {
            const argsCopy = [...functionArgs];
            argsCopy[i] = readAsType(event.target.value, input.type);
            setFunctionArgs(argsCopy);
          }}
        />
      )}
    </InputGroup>
  )) || []

  const inputFields = [...Array(inputs.length)].map((element, i) => (
    <div key={`${abi?.name}-input-${i}`}>
      {`Input #${i}`}
      <InputGroup>
        <Form.Control size="sm"
          placeholder={i === 0 ? "contract UTXO" : "Add input"}
          aria-label={i === 0 ? "contract UTXO" : "Add input"}
          disabled
        />
        <Form.Control onChange={event => selectInput(i, event.target.value)} as="select" size="sm" >
          <option className="text-center" key='Nan' value={`NaN`}>select UTXO</option>
          {namedUtxoList.map((utxo, inputIndex) => (
            <option className="text-center" key={`${inputIndex + utxo.name}`} value={`${inputIndex}`}> {utxo.name} </option>
          ))}
        </Form.Control>
      </InputGroup>
    </div>
  ))

  const outputFields = outputs.map((output, index) => (
    <div  key={`${abi?.name}-output-${index}`}>
      {`Output #${index}`}
      <div>
        <InputGroup>
          <Form.Control size="sm"
            placeholder="Receiver address"
            aria-label="Receiver address"
            onChange={(event) => {
              const outputsCopy = [...outputs]
              const output = outputsCopy[index]
              output.to = event.target.value
              outputsCopy[index] = output
              setOutputs(outputsCopy)
            }}
          />
          <Form.Control size="sm"
            placeholder="Satoshi amount"
            aria-label="Satoshi amount"
            onChange={(event) => {
              const outputsCopy = [...outputs]
              const output = outputsCopy[index]
              output.amount = Number(event.target.value)
              outputsCopy[index] = output
              setOutputs(outputsCopy)
            }}
          />
        </InputGroup>
      </div>
    </div>
  ))

  async function sendTransaction() {
    if (!contract || !abi) return

    // try to send transaction and alert result
    try {
      // first step of constructing transaction
      const transaction = contract.functions[abi.name](...functionArgs)

      // if manualSelection is enabled, add the selected inputs
      const contractInputs = inputs.filter(input => !input.isP2pkh)
      let p2pkhInputs = inputs.filter(input => input.isP2pkh)
      if (manualSelection) {
        transaction.from(contractInputs)
        p2pkhInputs.forEach(p2pkhInput => {
          if(p2pkhInput !== undefined && p2pkhInput.walletIndex !== undefined){
            transaction.experimentalFromP2PKH(p2pkhInput, new SignatureTemplate(wallets[p2pkhInput.walletIndex].privKey))
          }
        })
      }

      // if noAutomaticChange is enabled, add this to the transaction in construction
      if (noAutomaticChange) transaction.withoutChange()
      transaction.to(outputs)
      const { txid } = await transaction.send()

      alert(`Transaction successfully sent: ${ExplorerString[provider.network]}/tx/${txid}`)
      console.log(`Transaction successfully sent: ${ExplorerString[provider.network]}/tx/${txid}`)
      updateUtxosContract(contract.name)
    } catch (e: any) {
      alert(e.message)
      console.error(e.message)
    }
  }

  function addOutput() {
    const outputsCopy = [...outputs]
    outputsCopy.push({ to: '', amount: 0 })
    setOutputs(outputsCopy)
  }
  function removeOutput() {
    const outputsCopy = [...outputs]
    outputsCopy.splice(-1)
    setOutputs(outputsCopy)
  }

  function addInput() {
    const inputsCopy = [...inputs]
    inputsCopy.push({ txid: '', vout: 0, satoshis: 0, name: ``, isP2pkh: false })
    setInputs(inputsCopy)
  }
  function removeInput() {
    const inputsCopy = [...inputs]
    inputsCopy.splice(-1)
    setInputs(inputsCopy)
  }

  return (
    <div>
      {contract &&
        <Card style={{ marginBottom: '10px' }}>
          <Card.Header>{abi?.name}</Card.Header>
          <Card.Body>
            <Card.Subtitle style={{ marginBottom: '5px' }}>Arguments</Card.Subtitle>
            <div>
              {argumentFields}
            </div>
            <Form style={{ marginTop: '10px', marginBottom: '5px' }}>
              <Form.Check
                type="switch"
                id={abi?.name}
                label="manual UTXO selection"
                onChange={() => setManualSelection(!manualSelection)}
              />
            </Form>
            {manualSelection ? (
              <><Card.Subtitle style={{ marginTop: '10px', marginBottom: '5px' }}>
                Transaction inputs{' '}
                <Button variant="outline-secondary" size="sm" disabled={inputs.length <= 1} onClick={removeInput}>-</Button>
                {' ' + inputs.length + ' '}
                <Button variant="outline-secondary" size="sm" onClick={addInput}>+</Button>
              </Card.Subtitle>
              {inputFields}</>
            ) : null}
            <Form style={{ marginTop: '10px', marginBottom: '5px' }}>
              <Form.Check
                type="switch"
                id={"noAutomaticChange" + abi?.name}
                label="disable automatic change output"
                onChange={() => setNoAutomaticChange(!noAutomaticChange)}
              />
            </Form>
            <Card.Subtitle style={{ marginTop: '10px', marginBottom: '5px' }}>
              Transaction outputs{' '}
              <Button variant="outline-secondary" size="sm" disabled={outputs.length <= 1} onClick={removeOutput}>-</Button>
              {' ' + outputs.length + ' '}
              <Button variant="outline-secondary" size="sm" onClick={addOutput}>+</Button>
            </Card.Subtitle>
            {outputFields}
            <Button variant="secondary" style={{ display: "block" }} size="sm" onClick={sendTransaction}>Send</Button>
          </Card.Body>
        </Card>
      }
    </div>
  )
}

export default ContractFunction
