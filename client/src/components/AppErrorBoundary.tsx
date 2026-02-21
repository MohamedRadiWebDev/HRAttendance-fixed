import React from "react";
import { pushDiagnosticError } from "@/lib/errorHandling";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    pushDiagnosticError(error, "ErrorBoundary");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-6" dir="rtl">
          <div className="bg-card border rounded-xl p-6 text-center max-w-md">
            <h2 className="text-lg font-bold mb-2">حدث خطأ غير متوقع</h2>
            <p className="text-sm text-muted-foreground mb-4">تم تسجيل الخطأ. يمكنك تحديث الصفحة أو مراجعة صفحة التشخيص.</p>
            <button className="px-4 py-2 rounded bg-primary text-primary-foreground" onClick={() => window.location.reload()}>
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
