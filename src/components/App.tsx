// Components
import React, { useState } from 'react';
import { Artifact, ElectrumNetworkProvider, NetworkProvider } from 'cashscript';
import Header from './Header'
import Main from './Main'
import Footer from './Footer';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import WalletInfo from './Wallets';
import { Wallet, ContractInfo } from './shared';
import NewContract from './NewContract';
import Contracts from './Contracts';
import TransactionBuilder from './TransactionBuilder';

function App() {
  const [provider, setProvider] = useState<NetworkProvider>(new ElectrumNetworkProvider("testnet"))
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[] | undefined>(undefined);
  const [contracts, setContracts] = useState<ContractInfo[] | undefined>(undefined)
  const [code, setCode] = useState<string>(
`pragma cashscript ^0.6.5;
// language version before BCH-specific upgrades
    
contract Escrow(bytes20 arbiter, bytes20 buyer, bytes20 seller) {
  function spend(pubkey pk, sig s) {
    // required for pre-image introspection 
    require(hash160(pk) == arbiter);
    require(checkSig(s, pk));

    // Create and enforce outputs
    int minerFee = 1000; // hardcoded fee
    bytes8 amount = bytes8(int(bytes(tx.value)) - minerFee);
    bytes34 buyerOutput = new OutputP2PKH(amount, buyer);
    bytes34 sellerOutput = new OutputP2PKH(amount, seller);
    require(tx.hashOutputs == hash256(buyerOutput) || tx.hashOutputs == hash256(sellerOutput));
  }
}
`);

  async function updateUtxosContract (nameContract: string) {
    const contractIndex = contracts?.findIndex(contractInfo => contractInfo.contract.name == nameContract)
    if (contractIndex == undefined) return
    const currentContract = contracts?.[contractIndex].contract
    if (!currentContract) return
    // create a separate lists for utxos and mutate entry
    const utxosList = contracts.map(contract => contract.utxos ?? [])
    const contractUtxos = await currentContract.getUtxos();
    utxosList[contractIndex] = contractUtxos
    // map is the best way to deep clone array of complex objects
    const newContracts: ContractInfo[] = contracts.map((contractInfo,index) => (
      { ...contractInfo, utxos:utxosList[index] }
    ))
    setContracts(newContracts)
  }

  async function updateAllUtxosContracts () {
    if(!contracts) return

    const utxosPromises = contracts.map(contractInfo => {
      const contractUtxos = contractInfo.contract.getUtxos();
      return contractUtxos ?? []
    })
    const utxosContracts = await Promise.all(utxosPromises)
    // map is the best way to deep clone array of complex objects
    const newContracts: ContractInfo[] = contracts.map((contractInfo,index) => (
      { ...contractInfo, utxos:utxosContracts?.[index]}
    ))
    setContracts(newContracts)
  }

  return (
    <>
      <div className="App" style={{ backgroundColor: '#eee', color: '#000', padding: '0px 32px' }}>
        <Header />
        <Tabs
          defaultActiveKey="editor"
          id="uncontrolled-tab-example"
          className="mb-2 mt-4 justify-content-center"
          style={{ display: "inline-flex", marginLeft: "calc(100vw - 1100px)" }}
        >
          <Tab eventKey="editor" title="Editor">
            <Main code={code} setCode={setCode} artifacts={artifacts} setArtifacts={setArtifacts} setContracts={setContracts} updateAllUtxosContracts={updateAllUtxosContracts}/>
          </Tab>
          <Tab eventKey="newcontract" title="New Contract">
            <NewContract artifacts={artifacts} provider={provider} setProvider={setProvider} contracts={contracts} setContracts={setContracts} updateUtxosContract={updateUtxosContract} />
          </Tab>
          <Tab eventKey="contracts" title="Contracts">
            <Contracts contracts={contracts} setContracts={setContracts} updateUtxosContract={updateUtxosContract} />
          </Tab>
          <Tab eventKey="wallets" title="Wallets">
            <WalletInfo provider={provider} wallets={wallets} setWallets={setWallets}/>
          </Tab>
          <Tab eventKey="transactionBuilder" title="TransactionBuilder">
            <TransactionBuilder provider={provider} wallets={wallets} contracts={contracts} updateUtxosContract={updateUtxosContract}/>
          </Tab>
        </Tabs>
      </div>
      <Footer />
    </>
  );
}

export default App;
