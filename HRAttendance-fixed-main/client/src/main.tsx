import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AttendanceStoreProvider } from "@/store/attendanceStore";
import { applyTheme, getSavedTheme } from "@/lib/theme";

applyTheme(getSavedTheme());

createRoot(document.getElementById("root")!).render(
  <AttendanceStoreProvider>
    <App />
  </AttendanceStoreProvider>
);
