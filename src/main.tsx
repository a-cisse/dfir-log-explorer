import React from "react";
import ReactDOM from "react-dom/client";
import { createBridge } from "./bridge";
import { App } from "./App";
import "@fontsource-variable/inter/wght.css";
import "./styles.css";

createBridge()
  .then((bridge) => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App bridge={bridge} />
      </React.StrictMode>,
    );
  })
  .catch(() => {
    document.getElementById("root")!.textContent =
      "Unable to initialize the application. Please restart it.";
  });
