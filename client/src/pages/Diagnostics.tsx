import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { clearDiagnosticErrors, getDiagnosticErrors, type DiagnosticError } from "@/lib/errorHandling";

export default function Diagnostics() {
  const [errors, setErrors] = useState<DiagnosticError[]>(getDiagnosticErrors());

  useEffect(() => {
    const handler = () => setErrors(getDiagnosticErrors());
    window.addEventListener("app:error", handler);
    return () => window.removeEventListener("app:error", handler);
  }, []);

  return (
    <div className="flex h-screen bg-background" dir="rtl">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="التشخيص" />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">آخر الأخطاء المسجلة داخل الجلسة الحالية فقط</div>
              <Button variant="outline" onClick={() => { clearDiagnosticErrors(); setErrors([]); }}>مسح</Button>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
              {errors.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد أخطاء مسجلة.</p>
              ) : (
                errors.map((error) => (
                  <div key={error.id} className="border rounded-lg p-3 text-xs">
                    <div className="font-semibold">{error.message}</div>
                    <div className="text-muted-foreground">{error.timestamp} — {error.source}</div>
                    {error.stack && <pre className="mt-2 whitespace-pre-wrap text-[11px]">{error.stack}</pre>}
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
