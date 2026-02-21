import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, AlertTriangle, CalendarCheck, Trash2 } from "lucide-react";
import { useAttendanceRecords } from "@/hooks/use-attendance";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEmployees } from "@/hooks/use-employees";
import { format, parse } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useAttendanceStore, type AttendanceStoreState } from "@/store/attendanceStore";
import { useToast } from "@/hooks/use-toast";
import {
  buildBackupPayload,
  createBackupZip,
  readBackupZip,
  restoreAttendanceRecords,
  restoreSerializablePunches,
} from "@/backup/backupService";
import { clearPersistedState, getLastSavedAt } from "@/store/persistence";

export default function Dashboard() {
  const { toast } = useToast();
  const wipeData = useAttendanceStore((state: AttendanceStoreState) => state.wipeData);
  const getSnapshot = useAttendanceStore((state: AttendanceStoreState) => state.getSnapshot);
  const setEmployees = useAttendanceStore((state: AttendanceStoreState) => state.setEmployees);
  const setPunches = useAttendanceStore((state: AttendanceStoreState) => state.setPunches);
  const setRules = useAttendanceStore((state: AttendanceStoreState) => state.setRules);
  const setLeaves = useAttendanceStore((state: AttendanceStoreState) => state.setLeaves);
  const setAdjustments = useAttendanceStore((state: AttendanceStoreState) => state.setAdjustments);
  const setAttendanceRecords = useAttendanceStore((state: AttendanceStoreState) => state.setAttendanceRecords);
  const setOfficialHolidays = useAttendanceStore((state: AttendanceStoreState) => state.setOfficialHolidays);
  const setConfig = useAttendanceStore((state: AttendanceStoreState) => state.setConfig);
  const [dateInput, setDateInput] = useState({ start: "", end: "" });
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const hasInitialized = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const parseDateInput = (value: string) => {
    if (!value) return null;
    const parsed = parse(value, "dd/MM/yyyy", new Date());
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const fallback = new Date(value);
    if (!Number.isNaN(fallback.getTime())) return fallback;
    return null;
  };

  useEffect(() => {
    const storedStart = localStorage.getItem("attendanceStartDate");
    const storedEnd = localStorage.getItem("attendanceEndDate");
    if (storedStart && storedEnd) {
      setDateRange({ start: storedStart, end: storedEnd });
      setDateInput({
        start: format(new Date(storedStart), "dd/MM/yyyy"),
        end: format(new Date(storedEnd), "dd/MM/yyyy"),
      });
    }
    hasInitialized.current = true;
  }, []);

  useEffect(() => {
    setLastSavedAt(getLastSavedAt());
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { savedAt?: string } | undefined;
      if (detail?.savedAt) setLastSavedAt(detail.savedAt);
    };
    window.addEventListener("attendance:persistence-saved", handler);
    return () => window.removeEventListener("attendance:persistence-saved", handler);
  }, []);

  const { data: attendanceData } = useAttendanceRecords(
    dateRange.start,
    dateRange.end,
    "",
    1,
    0,
    false
  );

  const { data: allEmployees } = useEmployees();

  useEffect(() => {
    if (!dateRange.start || !dateRange.end) return;
    localStorage.setItem("attendanceStartDate", dateRange.start);
    localStorage.setItem("attendanceEndDate", dateRange.end);
  }, [dateRange]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    if (!dateRange.start && !dateRange.end) {
      localStorage.removeItem("attendanceStartDate");
      localStorage.removeItem("attendanceEndDate");
    }
  }, [dateRange]);

  const records = (attendanceData as any)?.data || [];

  const safeDateMs = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  };

  const rangeDays = (() => {
    const s = safeDateMs(dateRange.start);
    const e = safeDateMs(dateRange.end);
    if (s === null || e === null || e < s) return 0;
    return Math.floor((e - s) / 86400000) + 1;
  })();

  const totals = records.reduce(
    (acc: any, r: any) => {
      const penalties = Array.isArray(r?.penalties) ? r.penalties : [];
      const byType = { late: 0, early: 0, missing: 0, absenceDays: 0 };
      for (const p of penalties) {
        const v = Number(p?.value || 0);
        if (!Number.isFinite(v)) continue;
        if (p?.type === "تأخير") byType.late += v;
        else if (p?.type === "انصراف مبكر") byType.early += v;
        else if (p?.type === "سهو بصمة") byType.missing += v;
        else if (p?.type === "غياب") byType.absenceDays += v;
      }

      // Dashboard: show raw absence days (NOT weighted). Weighting is a summary/export business rule.
      acc.late += byType.late;
      acc.early += byType.early;
      acc.missing += byType.missing;
      acc.absenceDays += byType.absenceDays;
      acc.totalPenalties += byType.late + byType.early + byType.missing + byType.absenceDays * 2;

      const code = String(r?.employeeCode || "").trim();
      const empName = String(r?.employeeName || "").trim() || String((allEmployees || []).find((e: any) => String(e?.code || "").trim() === code)?.nameAr || "").trim() || code;
      if (byType.absenceDays > 0) acc.absenceByEmployee.set(`${code}__${empName}`, (acc.absenceByEmployee.get(`${code}__${empName}`) || 0) + byType.absenceDays);
      if (byType.late > 0) acc.lateByEmployee.set(`${code}__${empName}`, (acc.lateByEmployee.get(`${code}__${empName}`) || 0) + byType.late);
      return acc;
    },
    { late: 0, early: 0, missing: 0, absenceDays: 0, totalPenalties: 0, absenceByEmployee: new Map<string, number>(), lateByEmployee: new Map<string, number>() }
  );

  const topFromMap = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

  const topAbsentEmployees = topFromMap(totals.absenceByEmployee).map(({ name, value }) => {
    const [code, empName] = String(name).split("__");
    return { name: empName || code, value, code };
  });
  const topLateEmployees = topFromMap(totals.lateByEmployee).map(({ name, value }) => {
    const [code, empName] = String(name).split("__");
    return { name: empName || code, value, code };
  });

  const stats = [
    { title: "إجمالي الموظفين", value: allEmployees?.length || 0, icon: Users, color: "blue" as const, trend: "", trendUp: true },
    { title: "عدد أيام الفترة", value: rangeDays, icon: CalendarCheck, color: "green" as const, trend: "", trendUp: true },
    { title: "إجمالي التأخيرات", value: totals.late, icon: Clock, color: "orange" as const, trend: "", trendUp: true },
    { title: "إجمالي الغياب", value: totals.absenceDays, icon: AlertTriangle, color: "red" as const, trend: "", trendUp: false },
  ];

  const chartData = [
    { name: "تأخير", value: totals.late },
    { name: "انصراف مبكر", value: totals.early },
    { name: "سهو بصمة", value: totals.missing },
    { name: "غياب", value: totals.absenceDays },
  ];

  // (We intentionally keep only one chart; "Top departments" is shown as ranked lists.)

  const handleExportBackup = () => {
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
      selectedModules: [
        "employees",
        "punches",
        "rules",
        "leaves",
        "adjustments",
        "officialHolidays",
        "attendanceRecords",
        "config",
      ],
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

  const handleImportBackup = async (file: File) => {
    try {
      const payload = await readBackupZip(file);
      const modules = payload.modules;
      if (modules.employees) setEmployees(modules.employees);
      if (modules.punches) setPunches(restoreSerializablePunches(modules.punches));
      if (modules.rules) setRules(modules.rules);
      if (modules.leaves) setLeaves(modules.leaves);
      if (modules.adjustments) setAdjustments(modules.adjustments);
      if (modules.officialHolidays) setOfficialHolidays(modules.officialHolidays);
      if (modules.attendanceRecords) setAttendanceRecords(restoreAttendanceRecords(modules.attendanceRecords));
      if (modules.config) setConfig(modules.config as any);
      toast({ title: "تم الاستيراد", description: "تم استعادة البيانات بنجاح." });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل قراءة الملف.", variant: "destructive" });
    }
  };

  const handleClearData = async () => {
    if (!window.confirm("هل أنت متأكد من مسح كافة بيانات الموقع؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    await clearPersistedState();
    wipeData();
    toast({ title: "تم المسح", description: "تم مسح كافة البيانات بنجاح." });
    window.location.reload();
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="لوحة التحكم" />
        
        <main className="flex-1 overflow-y-auto p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-2xl font-bold font-display">لوحة التحكم</h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg p-1">
                  <Input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={dateInput.start}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDateInput(prev => ({ ...prev, start: value }));
                      if (!value) {
                        setDateRange(prev => ({ ...prev, start: undefined }));
                        return;
                      }
                      const parsed = parseDateInput(value);
                      if (parsed) {
                        setDateRange(prev => ({ ...prev, start: format(parsed, "yyyy-MM-dd") }));
                      }
                    }}
                    className="border-none bg-transparent h-8 w-36"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={dateInput.end}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDateInput(prev => ({ ...prev, end: value }));
                      if (!value) {
                        setDateRange(prev => ({ ...prev, end: undefined }));
                        return;
                      }
                      const parsed = parseDateInput(value);
                      if (parsed) {
                        setDateRange(prev => ({ ...prev, end: format(parsed, "yyyy-MM-dd") }));
                      }
                    }}
                    className="border-none bg-transparent h-8 w-36"
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, i) => (
              <StatCard key={i} {...stat} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold font-display">توزيع الحالات حسب الفترة المختارة</h3>
              </div>
              <div className="h-[300px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '10px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', boxShadow: '0 10px 20px -10px rgb(0 0 0 / 0.35)' }}
                      cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
              <h3 className="text-lg font-bold font-display mb-6">أكثر الموظفين</h3>
              <div className="h-[300px] w-full flex items-center justify-center" dir="ltr">
                <div className="w-full space-y-4" dir="rtl">
                  <div>
                    <div className="text-sm font-semibold mb-2">الأكثر غيابًا</div>
                    <div className="space-y-2">
                      {(topAbsentEmployees.length ? topAbsentEmployees : [{ name: "-", value: 0, code: "" }]).map((d: any) => (
                        <div key={`abs-${d.code || d.name}`} className="flex items-center gap-3">
                          <div className="text-sm text-muted-foreground truncate w-44" title={d.code ? `${d.name} (${d.code})` : d.name}>
                            {d.code ? `${d.name} (${d.code})` : d.name}
                          </div>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, (d.value / Math.max(1, topAbsentEmployees[0]?.value || 1)) * 100)}%`, background: "hsl(var(--destructive))" }}
                            />
                          </div>
                          <div className="text-sm font-bold tabular-nums w-10 text-left">{d.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <div className="text-sm font-semibold mb-2">الأكثر تأخيرًا</div>
                    <div className="space-y-2">
                      {(topLateEmployees.length ? topLateEmployees : [{ name: "-", value: 0, code: "" }]).map((d: any) => (
                        <div key={`late-${d.code || d.name}`} className="flex items-center gap-3">
                          <div className="text-sm text-muted-foreground truncate w-44" title={d.code ? `${d.name} (${d.code})` : d.name}>
                            {d.code ? `${d.name} (${d.code})` : d.name}
                          </div>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, (d.value / Math.max(1, topLateEmployees[0]?.value || 1)) * 100)}%`, background: "hsl(var(--primary))" }}
                            />
                          </div>
                          <div className="text-sm font-bold tabular-nums w-10 text-left">{d.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="font-display">إدارة البيانات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-muted-foreground">
                      {lastSavedAt ? `آخر حفظ: ${format(new Date(lastSavedAt), "dd/MM/yyyy HH:mm")}` : "لم يتم حفظ أي بيانات بعد."}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          handleImportBackup(file);
                          event.currentTarget.value = "";
                        }}
                      />
                      <Button variant="outline" onClick={handleExportBackup}>
                        تصدير نسخة احتياطية
                      </Button>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        استيراد نسخة احتياطية
                      </Button>
                      <Button variant="destructive" className="gap-2" onClick={handleClearData}>
                        <Trash2 className="w-4 h-4" />
                        مسح كل البيانات
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
