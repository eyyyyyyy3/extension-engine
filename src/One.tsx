import React from "react";
import "./App.css";
import { Link } from "react-router-dom";
import { endpointContext } from "./EndpointContext";
import { useLocation } from "react-router-dom";

function One() {
  let location = useLocation();
  const endpoint = React.useContext(endpointContext);
  React.useEffect(() => {
    endpoint.updateSpace("one");
  }, [location]);
  return (
    <main className="container">
      <div id="one-extension"></div>
      <h1>Welcome to Tauri + React</h1>
      <Link to={"/"}>Take me to the main page</Link>
    </main>
  );
}

export default One;
