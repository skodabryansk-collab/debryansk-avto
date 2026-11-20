import { createRoot } from "react-dom/client";
import { setAuthResponseHandler, setAuthTokenGetter } from "@workspace/api-client-react";
import { processSessionResponse } from "./lib/session-client";
import App from "./App";
import "./index.css";

setAuthTokenGetter(() => (
  typeof window === "undefined" ? null : window.localStorage.getItem("admin_token")
));
setAuthResponseHandler((response, sentToken) => {
  processSessionResponse(response, sentToken, "admin_token");
});

createRoot(document.getElementById("root")!).render(<App />);
