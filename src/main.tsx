import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const canRegisterPwa = import.meta.env.PROD
  && "serviceWorker" in navigator
  && (window.location.protocol === "https:" || window.location.hostname === "127.0.0.1");

if (canRegisterPwa) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch(() => undefined);
  });
}
