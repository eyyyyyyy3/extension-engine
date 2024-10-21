import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import * as Comlink from "comlink";
import { ExtensionService, EndpointLeft } from "./extension/extension-service";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  const extensionService = new ExtensionService();
  const extensionServiceL = extensionService.endpointLeft;
  extensionServiceL.loadExtensionHost().then((data) => console.log(data));

  return (
    <main className="container">
      <div id="extension"></div>
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>
    </main>
  );
}

export default App;
