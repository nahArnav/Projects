import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ArenaPage } from "./pages/ArenaPage";
import { AuditorPage } from "./pages/AuditorPage";
import { HomePage } from "./pages/HomePage";
import { InterceptorPage } from "./pages/Interceptor";
import { ReferencePage } from "./pages/ReferencePage";
import { VaccinePage } from "./pages/Vaccine";

export default function App() {
  return (
    <div className="min-h-screen bg-canvas text-parchment">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(197,160,89,0.05),transparent_24%)]" />
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="auditor" element={<AuditorPage />} />
          <Route path="reference" element={<ReferencePage />} />
          <Route path="arena" element={<ArenaPage />} />
          <Route path="interceptor" element={<InterceptorPage />} />
          <Route path="vaccine" element={<VaccinePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </div>
  );
}
