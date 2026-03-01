import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloClient, ApolloProvider, InMemoryCache } from "@apollo/client";
import App from "./App";

const subgraphUri = import.meta.env.VITE_SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/weather-oracle";

const client = new ApolloClient({
  uri: subgraphUri,
  cache: new InMemoryCache()
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);