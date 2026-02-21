import { useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAttendanceStore } from "@/store/attendanceStore";
import {
  buildBackupPayload,
  createBackupZip,
  readBackupZip,
  restoreAttendanceRecords,
  restoreSerializablePunches,
  type BackupModuleKey,
} from "@/backup/backupService";
import { format } from "date-fns";

type RestoreMode = "replace" | "merge";

const MODULE_LABELS: Record<BackupModuleKey, string> = {
  employees: "الموظفين",
  punches: "سجلات البصمة",
  attendanceRecords: "نتائج المعالجة",
  rules: "القواعد",
  leaves: "الإجازات",
  adjustments: "التسويات",
  officialHolidays: "الإجازات الرسمية",
  config: "الإعدادات",
};

export default function BackupRestore() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getSnapshot = useAttendanceStore((state) => state.getSnapshot);
  const setEmployees = useAttendanceStore((state) => state.setEmployees);
  const setPunches = useAttendanceStore((state) => state.setPunches);
  const setRules = useAttendanceStore((state) => state.setRules);
  const setLeaves = useAttendanceStore((state) => state.setLeaves);
  const setAdjustments = useAttendanceStore((state) => state.setAdjustments);
  const setAttendanceRecords = useAttendanceStore((state) => state.setAttendanceRecords);
  const setConfig = useAttendanceStore((state) => state.setConfig);
  const setOfficialHolidays = useAttendanceStore((state) => state.setOfficialHolidays);
  const config = useAttendanceStore((state) => state.config);

  const [selectedModules, setSelectedModules] = useState<Record<BackupModuleKey, boolean>>({
    employees: true,
    punches: true,
    attendanceRecords: true,
    rules: true,
    leaves: true,
    adjustments: true,
    officialHolidays: true,
    config: true,
  });
  const [restorePreview, setRestorePreview] = useState<{
    meta: any;
    modules: Record<string, any>;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("replace");
  const [restoreSelection, setRestoreSelection] = useState<Record<BackupModuleKey, boolean>>({
    employees: true,
    punches: true,
    attendanceRecords: true,
    rules: true,
    leaves: true,
    adjustments: true,
    officialHolidays: true,
    config: true,
  });

  const employees = useAttendanceStore((state) => state.employees);
  const punches = useAttendanceStore((state) => state.punches);
  const attendanceRecords = useAttendanceStore((state) => state.attendanceRecords);
  const rules = useAttendanceStore((state) => state.rules);
  const leaves = useAttendanceStore((state) => state.leaves);
  const adjustments = useAttendanceStore((state) => state.adjustments);
  const officialHolidays = useAttendanceStore((state) => state.officialHolidays);

  const moduleCounts = {
    employees: employees.length,
    punches: punches.length,
    attendanceRecords: attendanceRecords.length,
    rules: rules.length,
    leaves: leaves.length,
    adjustments: adjustments.length,
    officialHolidays: officialHolidays.length,
    config: 1,
  };

  const handleExport = () => {
    const selected = (Object.keys(selectedModules) as BackupModuleKey[]).filter(
      (key) => selectedModules[key]
    );
    if (selected.length === 0) {
      toast({ title: "خطأ", description: "يرجى اختيار وحدة واحدة على الأقل.", variant: "destructive" });
      return;
    }
    const snapshot = getSnapshot();
    const payload = buildBackupPayload({
      state: {
        employees: snapshot.employees,
        punches: snapshot.punches,
        rules: snapshot.rules,
        leaves: snapshot.leaves,
        adjustments: snapshot.adjustments,
        officialHolidays: snapshot.officialHolidays,
        attendanceRecords: snapshot.attendanceRecords,
        config: snapshot.config,
      },
      selectedModules: selected,
    });
    const blob = createBackupZip(payload);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup_${format(new Date(), "yyyyMMdd_HHmm")}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم التصدير", description: "تم إنشاء النسخة الاحتياطية بنجاح." });
  };

  const handleSelectFile = async (file: File) => {
    try {
      const payload = await readBackupZip(file);
      setRestorePreview(payload);
      const selection = { ...restoreSelection };
      (Object.keys(MODULE_LABELS) as BackupModuleKey[]).forEach((key) => {
        selection[key] = Boolean(payload.modules?.[key]);
      });
      setRestoreSelection(selection);
      toast({ title: "تم التحميل", description: "تم قراءة بيانات النسخة الاحتياطية." });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل قراءة الملف.", variant: "destructive" });
    }
  };

  const handleRestore = () => {
    if (!restorePreview) return;
    const errors: string[] = [];
    const selected = (Object.keys(restoreSelection) as BackupModuleKey[]).filter(
      (key) => restoreSelection[key]
    );
    if (selected.length === 0) {
      toast({ title: "خطأ", description: "يرجى اختيار وحدات للاستعادة.", variant: "destructive" });
      return;
    }

    const current = getSnapshot();
    const modules = restorePreview.modules;

    const safeApply = (label: string, action: () => void) => {
      try {
        action();
      } catch (error: any) {
        errors.push(`${label}: ${error?.message || "فشل الاستعادة"}`);
      }
    };

    if (restoreSelection.employees && modules.employees) {
      safeApply("الموظفين", () => {
        if (restoreMode === "replace") {
          setEmployees(modules.employees);
        } else {
          const map = new Map(current.employees.map((emp) => [String(emp.code), emp]));
          modules.employees.forEach((emp: any) => {
            if (!map.has(String(emp.code))) map.set(String(emp.code), emp);
          });
          setEmployees(Array.from(map.values()));
        }
      });
    }
    if (restoreSelection.punches && modules.punches) {
      safeApply("سجلات البصمة", () => {
        const restoredPunches = restoreSerializablePunches(modules.punches);
        if (restoreMode === "replace") {
          setPunches(restoredPunches);
        } else {
          const map = new Map(
            current.punches.map((punch) => [`${punch.employeeCode}__${punch.punchDatetime.getTime()}`, punch])
          );
          restoredPunches.forEach((punch) => {
            const key = `${punch.employeeCode}__${punch.punchDatetime.getTime()}`;
            if (!map.has(key)) map.set(key, punch);
          });
          setPunches(Array.from(map.values()));
        }
      });
    }
    if (restoreSelection.rules && modules.rules) {
      safeApply("القواعد", () => {
        if (restoreMode === "replace") {
          setRules(modules.rules);
        } else {
          const map = new Map(current.rules.map((rule) => [rule.id, rule]));
          modules.rules.forEach((rule: any) => {
            if (rule.id != null && map.has(rule.id)) {
              map.set(rule.id, rule);
            } else {
              map.set(rule.id ?? `${rule.name}_${rule.scope}_${rule.startDate}_${rule.endDate}`, rule);
            }
          });
          setRules(Array.from(map.values()));
        }
      });
    }
    if (restoreSelection.leaves && modules.leaves) {
      safeApply("الإجازات", () => {
        if (restoreMode === "replace") {
          setLeaves(modules.leaves);
        } else {
          const map = new Map(
            current.leaves.map((leave) => [`${leave.scope}|${leave.scopeValue}|${leave.startDate}|${leave.endDate}|${leave.type}`, leave])
          );
          modules.leaves.forEach((leave: any) => {
            const key = `${leave.scope}|${leave.scopeValue}|${leave.startDate}|${leave.endDate}|${leave.type}`;
            if (!map.has(key)) map.set(key, leave);
          });
          setLeaves(Array.from(map.values()));
        }
      });
    }
    if (restoreSelection.adjustments && modules.adjustments) {
      safeApply("التسويات", () => {
        if (restoreMode === "replace") {
          setAdjustments(modules.adjustments);
        } else {
          const map = new Map(
            current.adjustments.map(
              (adj) => [`${adj.employeeCode}|${adj.date}|${adj.type}|${adj.fromTime}|${adj.toTime}|${adj.source}`, adj]
            )
          );
          modules.adjustments.forEach((adj: any) => {
            const key = `${adj.employeeCode}|${adj.date}|${adj.type}|${adj.fromTime}|${adj.toTime}|${adj.source}`;
            if (!map.has(key)) map.set(key, adj);
          });
          setAdjustments(Array.from(map.values()));
        }
      });
    }
    if (restoreSelection.officialHolidays && modules.officialHolidays) {
      safeApply("الإجازات الرسمية", () => {
        if (restoreMode === "replace") {
          setOfficialHolidays(modules.officialHolidays);
        } else {
          const map = new Map(
            current.officialHolidays.map((holiday: any) => [`${holiday.date}|${holiday.name}`, holiday])
          );
          modules.officialHolidays.forEach((holiday: any) => {
            const key = `${holiday.date}|${holiday.name}`;
            if (!map.has(key)) map.set(key, holiday);
          });
          setOfficialHolidays(Array.from(map.values()));
        }
      });
    }
    if (restoreSelection.attendanceRecords && modules.attendanceRecords) {
      safeApply("نتائج المعالجة", () => {
        const restoredRecords = restoreAttendanceRecords(modules.attendanceRecords);
        if (restoreMode === "replace") {
          setAttendanceRecords(restoredRecords);
        } else {
          const map = new Map(
            current.attendanceRecords.map((record) => [`${record.employeeCode}|${record.date}`, record])
          );
          restoredRecords.forEach((record: any) => {
            const key = `${record.employeeCode}|${record.date}`;
            if (!map.has(key)) map.set(key, record);
          });
          setAttendanceRecords(Array.from(map.values()));
        }
      });
    }
    if (restoreSelection.config && modules.config) {
      safeApply("الإعدادات", () => {
        if (restoreMode === "replace") {
          setConfig({ ...(modules.config || {}) });
        } else {
          setConfig({ ...current.config, ...(modules.config || {}) });
        }
      });
    }

    if (errors.length > 0) {
      toast({ title: "تمت الاستعادة مع أخطاء", description: errors.join(" | "), variant: "destructive" });
    } else {
      toast({ title: "تمت الاستعادة", description: "تم استعادة البيانات بنجاح." });
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="النسخ الاحتياطي والاستعادة" />
        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>تصدير نسخة احتياطية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(MODULE_LABELS) as BackupModuleKey[]).map((key) => (
                  <label key={key} className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedModules[key]}
                      onCheckedChange={(value) =>
                        setSelectedModules((prev) => ({ ...prev, [key]: Boolean(value) }))
                      }
                    />
                    <span className="text-sm font-medium">{MODULE_LABELS[key]}</span>
                    <span className="text-xs text-muted-foreground">({moduleCounts[key]})</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleExport}>تصدير النسخة الاحتياطية</Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={config.autoBackupEnabled}
                    onCheckedChange={(value) =>
                      setConfig({ ...config, autoBackupEnabled: value })
                    }
                  />
                  <span>نسخ تلقائي إلى المتصفح (اختياري)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>استعادة نسخة احتياطية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".zip"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handleSelectFile(file);
                    }
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  اختيار ملف النسخة الاحتياطية
                </Button>
                <Select value={restoreMode} onValueChange={(value) => setRestoreMode(value as RestoreMode)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace">استبدال بالكامل</SelectItem>
                    <SelectItem value="merge">دمج دون تكرار</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {restorePreview && (
                <div className="space-y-3 border rounded-lg p-4 bg-muted/40/60">
                  <div className="text-sm text-muted-foreground">
                    تاريخ النسخة: {restorePreview.meta?.createdAt || "-"}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(Object.keys(MODULE_LABELS) as BackupModuleKey[]).map((key) => (
                      <label key={key} className="flex items-center gap-3">
                        <Checkbox
                          checked={restoreSelection[key]}
                          onCheckedChange={(value) =>
                            setRestoreSelection((prev) => ({ ...prev, [key]: Boolean(value) }))
                          }
                        />
                        <span className="text-sm font-medium">{MODULE_LABELS[key]}</span>
                        <span className="text-xs text-muted-foreground">
                          ({restorePreview.meta?.recordCounts?.[key] ?? (restorePreview.modules?.[key]?.length ?? 0)})
                        </span>
                      </label>
                    ))}
                  </div>
                  <Button onClick={handleRestore}>استعادة البيانات المحددة</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
