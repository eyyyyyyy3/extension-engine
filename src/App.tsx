import reactLogo from "./assets/react.svg";
import React from "react";
import "./App.css";
import { Link } from "react-router-dom";
import { endpointContext } from "./EndpointContext";
import { useLocation } from "react-router-dom";

function App() {
  let location = useLocation();
  const endpoint = React.useContext(endpointContext);
  React.useEffect(() => {
    endpoint.updateSpace("app");
  }, [location]);


  return (
    <main className="container" >
      <div id="app-extension"></div>
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
      <Link to={"/one"}>Take me to the next page</Link>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>
    </main >
  );
}

export default App;
