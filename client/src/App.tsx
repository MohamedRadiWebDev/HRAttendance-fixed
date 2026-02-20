import { Switch, Route } from "wouter";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Employees from "@/pages/Employees";
import Attendance from "@/pages/Attendance";
import AttendanceHeatmap from "@/pages/AttendanceHeatmap";
import Import from "@/pages/Import";
import Rules from "@/pages/Rules";
import Adjustments from "@/pages/Adjustments";
import Effects from "@/pages/Effects";
import Leaves from "@/pages/Leaves";
import BackupRestore from "@/pages/BackupRestore";
import Diagnostics from "@/pages/Diagnostics";
import { clearPersistedState, exportIncompatibleBackup, getStorageCompatibility } from "@/store/persistence";
import { useToast } from "@/hooks/use-toast";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { pushDiagnosticError } from "@/lib/errorHandling";

function Router() {

  useEffect(() => {
    const onError = (event: ErrorEvent) => pushDiagnosticError(event.error || event.message, "window.error");
    const onUnhandled = (event: PromiseRejectionEvent) => pushDiagnosticError(event.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/employees" component={Employees} />
      <Route path="/attendance" component={Attendance} />
      <Route path="/attendance-heatmap" component={AttendanceHeatmap} />
      <Route path="/import" component={Import} />
      <Route path="/rules" component={Rules} />
      <Route path="/adjustments" component={Adjustments} />
      <Route path="/bulk-adjustments" component={Effects} />
      <Route path="/effects-import" component={Effects} />
      <Route path="/effects" component={Effects} />
      <Route path="/leaves" component={Leaves} />
      <Route path="/backup" component={BackupRestore} />
      <Route path="/diagnostics" component={Diagnostics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { toast } = useToast();
  const [showIncompatible, setShowIncompatible] = useState(false);

  useEffect(() => {
    const compatibility = getStorageCompatibility();
    if (compatibility.status === "incompatible") {
      setShowIncompatible(true);
    }
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { message?: string } | undefined;
      if (!detail?.message) return;
      toast({ title: "تنبيه", description: detail.message, variant: "destructive" });
    };
    const incompatibleHandler = () => setShowIncompatible(true);
    window.addEventListener("attendance:persistence-error", handler);
    window.addEventListener("attendance:persistence-incompatible", incompatibleHandler);
    return () => {
      window.removeEventListener("attendance:persistence-error", handler);
      window.removeEventListener("attendance:persistence-incompatible", incompatibleHandler);
    };
  }, [toast]);


  useEffect(() => {
    const appErrorHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { message?: string } | undefined;
      if (!detail?.message) return;
      toast({ title: "خطأ تشغيلي", description: detail.message, variant: "destructive" });
    };
    window.addEventListener("app:error", appErrorHandler);
    return () => window.removeEventListener("app:error", appErrorHandler);
  }, [toast]);
  const handleExportIncompatible = async () => {
    const blob = await exportIncompatibleBackup();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "storage_backup.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearStorage = async () => {
    await clearPersistedState();
    setShowIncompatible(false);
    window.location.reload();
  };

  return (
    <TooltipProvider>
      <Toaster />
      <AppErrorBoundary>
        <Router />
      </AppErrorBoundary>
      <AlertDialog open={showIncompatible}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>البيانات المخزنة غير متوافقة</AlertDialogTitle>
            <AlertDialogDescription>
              تم العثور على بيانات مخزنة بإصدار غير مدعوم. يمكنك تصدير نسخة احتياطية أو مسح التخزين والمتابعة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel onClick={() => setShowIncompatible(false)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleExportIncompatible}>تصدير نسخة احتياطية</AlertDialogAction>
            <AlertDialogAction onClick={handleClearStorage}>مسح التخزين</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

export default App;
