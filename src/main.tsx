import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { consumeSessionHandoff } from "./lib/suite";

consumeSessionHandoff();

createRoot(document.getElementById("root")!).render(<App />);
