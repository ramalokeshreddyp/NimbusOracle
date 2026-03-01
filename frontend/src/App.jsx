import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import WeatherOracleABI from "./contracts/WeatherOracle.json";
import WeatherForm from "./components/WeatherForm";
import WeatherReportsList from "./components/WeatherReportsList";

const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("0");
  const [network, setNetwork] = useState("");
  const [error, setError] = useState("");

  const contract = useMemo(() => {
    if (!signer || !contractAddress) return null;
    return new ethers.Contract(contractAddress, WeatherOracleABI, signer);
  }, [signer]);

  useEffect(() => {
    if (!window.ethereum) return;
    const p = new ethers.BrowserProvider(window.ethereum);
    setProvider(p);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) {
        setAccount("");
        setSigner(null);
        return;
      }
      setAccount(accounts[0]);
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  useEffect(() => {
    const loadAccountData = async () => {
      if (!provider || !account) return;
      const s = await provider.getSigner();
      setSigner(s);

      const [bal, net] = await Promise.all([provider.getBalance(account), provider.getNetwork()]);
      setBalance(ethers.formatEther(bal));
      setNetwork(`${net.name} (${net.chainId})`);
    };

    loadAccountData().catch((e) => setError(e.message || "Failed to load account data"));
  }, [provider, account]);

  const connectWallet = async () => {
    try {
      if (!provider) {
        setError("MetaMask is not installed");
        return;
      }

      setError("");
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length === 0) return;
      setAccount(accounts[0]);
    } catch (e) {
      setError(e.message || "Failed to connect wallet");
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>Decentralized Weather Oracle</h1>

      {!account ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div>
          <p><strong>Account:</strong> {account}</p>
          <p><strong>Balance:</strong> {Number(balance).toFixed(4)} ETH</p>
          <p><strong>Network:</strong> {network}</p>
        </div>
      )}

      {!contractAddress && (
        <p style={{ color: "crimson" }}>
          Missing VITE_CONTRACT_ADDRESS. Set it in frontend/.env before using requestWeather.
        </p>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {contract && account && <WeatherForm contract={contract} />}
      <WeatherReportsList />
    </div>
  );
}

export default App;