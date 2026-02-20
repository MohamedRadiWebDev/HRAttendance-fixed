import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, AlertTriangle, CheckCircle, Trash2, ShieldCheck } from "lucide-react";
import { useAttendanceRecords } from "@/hooks/use-attendance";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useEmployees } from "@/hooks/use-employees";
import { format, parse } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

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

  const rangeRecords = (attendanceData as any)?.data || [];

  const dayCount = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return 0;
    const s = new Date(dateRange.start);
    const e = new Date(dateRange.end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 0;
  }, [dateRange.end, dateRange.start]);

  const aggregates = useMemo(() => {
    const sum = { late: 0, early: 0, missing: 0, absenceWeighted: 0, penaltiesTotal: 0 };
    for (const r of rangeRecords as any[]) {
      const penalties = Array.isArray(r.penalties) ? r.penalties : [];
      for (const p of penalties) {
        const t = String(p?.type || "");
        const v = Number(p?.value ?? p?.minutes ?? p?.days ?? 0) || 0;
        if (t === "late_arrival") sum.late += v;
        if (t === "early_leave") sum.early += v;
        if (t === "missing_stamp") sum.missing += v;
        if (t === "absence") sum.absenceWeighted += v * 2;
      }
    }
    sum.penaltiesTotal = sum.late + sum.early + sum.missing + sum.absenceWeighted;
    return sum;
  }, [rangeRecords]);

  const topDepartments = useMemo(() => {
    const empByCode = new Map((allEmployees || []).map((e: any) => [String(e.code), e]));
    const mapAbsent = new Map<string, number>();
    const mapLate = new Map<string, number>();
    for (const r of rangeRecords as any[]) {
      const emp = empByCode.get(String(r.employeeCode)) as any;
      const dept = String(emp?.department || "غير محدد");
      const penalties = Array.isArray(r.penalties) ? r.penalties : [];
      for (const p of penalties) {
        const t = String(p?.type || "");
        const v = Number(p?.value ?? p?.minutes ?? p?.days ?? 0) || 0;
        if (t === "absence") mapAbsent.set(dept, (mapAbsent.get(dept) || 0) + v);
        if (t === "late_arrival") mapLate.set(dept, (mapLate.get(dept) || 0) + v);
      }
    }
    const top = (m: Map<string, number>) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));
    return { absence: top(mapAbsent), late: top(mapLate) };
  }, [allEmployees, rangeRecords]);

  const stats = [
    { title: "عدد الموظفين", value: allEmployees?.length || 0, icon: Users, color: "blue" as const, trend: "", trendUp: true },
    { title: "عدد أيام الفترة", value: dayCount, icon: ShieldCheck, color: "green" as const, trend: "", trendUp: true },
    { title: "إجمالي التأخيرات", value: aggregates.late, icon: Clock, color: "orange" as const, trend: "", trendUp: true },
    { title: "إجمالي الغياب (×2)", value: aggregates.absenceWeighted, icon: AlertTriangle, color: "red" as const, trend: "", trendUp: false },
  ];

  const chartData = topDepartments.absence;
  const pieData = topDepartments.late;

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
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="لوحة التحكم" />
        
        <main className="flex-1 overflow-y-auto p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-2xl font-bold font-display">لوحة التحكم</h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 bg-slate-50 border border-border rounded-lg p-1">
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
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-border/50 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold font-display">توزيع الحالات حسب الفترة المختارة</h3>
              </div>
              <div className="h-[300px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      cursor={{fill: '#f1f5f9'}}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm">
              <h3 className="text-lg font-bold font-display mb-6">توزيع الحالات اليومية</h3>
              <div className="h-[300px] w-full flex items-center justify-center" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {pieData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="text-sm font-bold mr-auto">{item.value}</span>
                  </div>
                ))}
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
