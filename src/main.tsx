import { createRoot } from "react-dom/client";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/pages.css";
import "./styles/au.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
