import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useEmployees } from "@/hooks/use-employees";
import { useAttendanceStore } from "@/store/attendanceStore";
import type { AttendanceRecord } from "@shared/schema";

const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const normalizeArabic = (value: string) => {
  return value
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .trim()
    .toLowerCase();
};

const toDateKey = (date: Date) => format(date, "yyyy-MM-dd");

const buildDateRange = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const dates: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(toDateKey(cursor));
  }
  return dates;
};

const formatDayLabel = (dateStr: string) => {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  const name = dayNames[date.getDay()];
  return `${name} ${format(date, "MM/dd")}`;
};

const getPenaltySummary = (record?: AttendanceRecord | null) => {
  if (!record?.penalties || !Array.isArray(record.penalties)) return { total: 0, items: [] as string[] };
  const items = record.penalties.map((penalty: any) => {
    const value = penalty?.value ?? "";
    return `${penalty?.type ?? "مخالفة"}: ${value}`;
  });
  const total = record.penalties.reduce((sum: number, penalty: any) => sum + (Number(penalty?.value) || 0), 0);
  return { total, items };
};

const getStatusDisplay = (record?: AttendanceRecord | null) => {
  const status = record?.status || "-";
  const labels: Record<string, string> = {
    "Present": "حضور",
    "Absent": "غياب",
    "Late": "تأخير",
    "Excused": "مأذون",
    "Friday": "جمعة",
    "Friday Attended": "جمعة (حضور)",
    "Comp Day": "يوم بالبدل",
    "Official Holiday": "إجازة رسمية",
  };
  return labels[status] || status;
};

const getCellStyle = (record?: AttendanceRecord | null) => {
  if (!record) return "bg-muted/40 text-slate-400 border-slate-200";
  const penalties = Array.isArray(record.penalties) ? record.penalties : [];
  const hasAbsencePenalty = penalties.some((penalty: any) => String(penalty?.type).includes("غياب"));

  if (record.status === "Absent" || hasAbsencePenalty) {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (record.status === "Late" || penalties.length > 0) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (record.status === "Official Holiday") {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (record.status === "Friday" || record.status === "Friday Attended" || record.status === "Comp Day") {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }
  if (record.status === "Excused") {
    return "bg-indigo-100 text-indigo-800 border-indigo-200";
  }
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
};

export default function AttendanceHeatmap() {
  const { data: employees } = useEmployees();
  const attendanceRecords = useAttendanceStore((state) => state.attendanceRecords);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", search: "", sector: "all", branch: "all", department: "all" });

  useEffect(() => {
    const now = new Date();
    const start = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
    const end = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
    setFilters((prev) => ({
      ...prev,
      startDate: prev.startDate || start,
      endDate: prev.endDate || end,
    }));
  }, []);

  const sectors = useMemo(
    () => Array.from(new Set(employees?.map((emp) => emp.sector).filter((value): value is string => Boolean(value)) || [])),
    [employees]
  );
  const branches = useMemo(
    () => Array.from(new Set(employees?.map((emp) => emp.branch).filter((value): value is string => Boolean(value)) || [])),
    [employees]
  );
  const departments = useMemo(
    () => Array.from(new Set(employees?.map((emp) => emp.department).filter((value): value is string => Boolean(value)) || [])),
    [employees]
  );

  const dates = useMemo(() => buildDateRange(filters.startDate, filters.endDate), [filters.startDate, filters.endDate]);

  const filteredEmployees = useMemo(() => {
    const search = normalizeArabic(filters.search);
    return (employees || []).filter((emp) => {
      const matchesSearch = !search
        || normalizeArabic(emp.nameAr || "").includes(search)
        || normalizeArabic(emp.code || "").includes(search);
      const matchesSector = filters.sector === "all" || emp.sector === filters.sector;
      const matchesBranch = filters.branch === "all" || emp.branch === filters.branch;
      const matchesDepartment = filters.department === "all" || emp.department === filters.department;
      return matchesSearch && matchesSector && matchesBranch && matchesDepartment;
    });
  }, [employees, filters.search, filters.sector, filters.branch, filters.department]);

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceRecords.forEach((record) => {
      map.set(`${record.employeeCode}__${record.date}`, record);
    });
    return map;
  }, [attendanceRecords]);

  const rowHeight = 48;
  const leftColumnWidth = 220;
  const cellWidth = 44;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);

  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      if (!containerRef.current) return;
      setViewportHeight(containerRef.current.clientHeight);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const visibleRange = useMemo(() => {
    const total = filteredEmployees.length;
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
    const endIndex = Math.min(total, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 5);
    return { startIndex, endIndex };
  }, [filteredEmployees.length, scrollTop, viewportHeight]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="خريطة الحضور" />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>تصفية الخريطة</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">من</label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">إلى</label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">بحث بالاسم أو الكود</label>
                  <Input
                    placeholder="مثال: أحمد أو 101"
                    value={filters.search}
                    onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">القطاع</label>
                  <Select
                    value={filters.sector}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, sector: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="القطاع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل القطاعات</SelectItem>
                      {sectors.map((sector) => (
                        <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الفرع</label>
                  <Select
                    value={filters.branch}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, branch: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الفروع</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الإدارة</label>
                  <Select
                    value={filters.department}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, department: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="الإدارة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الإدارات</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department} value={department}>{department}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <CardTitle>نظرة عامة بالحضور</CardTitle>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">عدد الموظفين: {filteredEmployees.length}</Badge>
                  <Badge variant="outline">الأيام: {dates.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {!filters.startDate || !filters.endDate || dates.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">يرجى تحديد فترة صالحة أولاً.</div>
                ) : (
                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <div className="flex bg-muted/40 border-b border-border/50">
                      <div
                        className="sticky right-0 z-10 bg-muted/40 border-l border-border/50 flex items-center px-3 text-xs font-semibold text-muted-foreground"
                        style={{ width: leftColumnWidth }}
                      >
                        الموظف
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex" style={{ width: dates.length * cellWidth }}>
                          {dates.map((date) => (
                            <div
                              key={date}
                              className="text-[10px] text-muted-foreground text-center border-l border-border/40 py-2"
                              style={{ width: cellWidth }}
                            >
                              {formatDayLabel(date)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      ref={containerRef}
                      className="relative overflow-auto"
                      style={{ height: "520px" }}
                      onScroll={(event) => setScrollTop((event.target as HTMLDivElement).scrollTop)}
                    >
                      <div style={{ height: filteredEmployees.length * rowHeight, position: "relative" }}>
                        {filteredEmployees.slice(visibleRange.startIndex, visibleRange.endIndex).map((employee, index) => {
                          const rowIndex = visibleRange.startIndex + index;
                          const top = rowIndex * rowHeight;
                          return (
                            <div
                              key={employee.code}
                              className="flex items-center border-b border-border/40 bg-card"
                              style={{ position: "absolute", top, left: 0, right: 0, height: rowHeight }}
                            >
                              <div
                                className="sticky right-0 z-10 bg-card border-l border-border/50 px-3 flex flex-col justify-center"
                                style={{ width: leftColumnWidth }}
                              >
                                <span className="text-xs font-semibold">{employee.nameAr}</span>
                                <span className="text-[11px] text-muted-foreground">{employee.code}</span>
                              </div>
                              <div className="flex" style={{ width: dates.length * cellWidth }}>
                                {dates.map((date) => {
                                  const record = recordMap.get(`${employee.code}__${date}`);
                                  const label = getStatusDisplay(record);
                                  const penalties = getPenaltySummary(record);
                                  const hasOvernight = Boolean(record?.notes?.includes("مبيت"));
                                  return (
                                    <Tooltip key={`${employee.code}-${date}`}>
                                      <TooltipTrigger asChild>
                                        <div
                                          className={`border-l border-border/30 flex items-center justify-center text-[9px] font-semibold relative ${getCellStyle(record)}`}
                                          style={{ width: cellWidth, height: rowHeight }}
                                        >
                                          {label !== "-" ? label : ""}
                                          {hasOvernight && (
                                            <span className="absolute top-1 left-1 rounded-full bg-purple-600 text-white text-[8px] px-1">
                                              مبيت
                                            </span>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs text-xs leading-relaxed">
                                        <div className="font-semibold mb-1">
                                          {employee.code} - {employee.nameAr}
                                        </div>
                                        <div className="text-muted-foreground mb-2">
                                          {date} ({formatDayLabel(date).split(" ")[0]})
                                        </div>
                                        <div className="space-y-1">
                                          <div>الدخول: {record?.checkIn ? format(new Date(record.checkIn), "HH:mm") : "-"}</div>
                                          <div>الخروج: {record?.checkOut ? format(new Date(record.checkOut), "HH:mm") : "-"}</div>
                                          <div>ساعات العمل: {record?.totalHours?.toFixed(2) ?? "-"}</div>
                                          <div>الإضافي: {record?.overtimeHours?.toFixed(2) ?? "-"}</div>
                                          <div>الملاحظات: {record?.notes || "-"}</div>
                                          <div>الحالة: {label}</div>
                                          <div>الخصومات: {penalties.items.length > 0 ? penalties.items.join(" | ") : "-"}</div>
                                          <div>إجمالي الخصم: {penalties.total || 0}</div>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
