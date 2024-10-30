import { useState } from "react";
import reactLogo from "./assets/react.svg";
import "./App.css";

import { ExtensionService } from "./extension/extension-service";

async function love() {
  const extensionService = new ExtensionService();
  const extensionServiceL = extensionService.endpointLeft;
  //Something wrong with this function
  extensionServiceL.registerSpace("app", ["extension"]);
  const extensionHostControllerIdentifier = await extensionServiceL.loadExtensionHost();
  await extensionServiceL.loadExtension("vici.first", extensionHostControllerIdentifier);
  extensionServiceL.loadSpace("app");
  await extensionServiceL.unloadExtension("vici.first", extensionHostControllerIdentifier);
}

function App() {
  const [name, setName] = useState("");

  love();


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
      <div id="extension"></div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>
    </main>
  );
}

export default App;
