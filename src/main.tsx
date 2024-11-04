import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import One from "./One";
import { createBrowserRouter, RouterProvider, useLocation } from "react-router-dom";
import { extensionServiceL, endpointContext } from "./EndpointContext";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "one",
    element: <One />,
  }
])


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <endpointContext.Provider value={extensionServiceL}>
      <RouterProvider router={router} />
    </endpointContext.Provider>
  </React.StrictMode>,
);

