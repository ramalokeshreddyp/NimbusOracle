import { useState } from "react";

function WeatherForm({ contract }) {
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!city.trim()) {
      setStatus("Enter a city name");
      return;
    }

    try {
      setIsLoading(true);
      setStatus("Submitting transaction...");

      const tx = await contract.requestWeather(city.trim(), { value: 0 });
      setStatus(`Transaction pending: ${tx.hash}`);

      const receipt = await tx.wait();
      setStatus(`Weather request submitted in block ${receipt.blockNumber}`);
      setCity("");
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section style={{ marginTop: 20, marginBottom: 20 }}>
      <h2>Request Weather</h2>
      <form onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="Enter city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={isLoading}
          style={{ marginRight: 8 }}
        />
        <button type="submit" disabled={isLoading}>Request</button>
      </form>
      {status && <p>{status}</p>}
    </section>
  );
}

export default WeatherForm;