import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AttendanceStoreProvider } from "@/store/attendanceStore";

createRoot(document.getElementById("root")!).render(
  <AttendanceStoreProvider>
    <App />
  </AttendanceStoreProvider>
);
