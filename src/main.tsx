import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import One from "./One";
import { createBrowserRouter, RouterProvider, useLocation } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "one",
        element: <One />,
      }
    ]
  }
])

import { ExtensionService } from "./extension/extension-service";


async function love() {
  const extensionService = new ExtensionService();
  const extensionServiceL = extensionService.endpointLeft;
  extensionServiceL.registerSpace("app", ["extension"]);
  const extensionHostControllerIdentifier = await extensionServiceL.loadExtensionHost();
  await extensionServiceL.loadExtension("vici.first", extensionHostControllerIdentifier);
  extensionServiceL.loadSpace("app");
  // extensionServiceL.unloadExtension("vici.first", extensionHostControllerIdentifier);
}

love();



ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);

