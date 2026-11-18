import { createRoot } from "react-dom/client";
import { StoreProvider } from "./state/store";
import App from "./App";
import "./styles.css";
createRoot(document.getElementById("root")!).render(<StoreProvider><App /></StoreProvider>);
