import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import * as XLSX from "xlsx";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useLeaves,
  useCreateLeave,
  useDeleteLeave,
  useImportLeaves,
  useOfficialHolidays,
  useCreateOfficialHoliday,
  useDeleteOfficialHoliday,
} from "@/hooks/use-data";
import { useEmployees } from "@/hooks/use-employees";
import { format, parse, isValid } from "date-fns";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useUpdateAttendanceRecord } from "@/hooks/use-attendance";

const TYPE_LABELS: Record<string, string> = {
  official: "اجازة رسمية",
  collections: "اجازات التحصيل",
};

const SCOPE_LABELS: Record<string, string> = {
  all: "الكل",
  sector: "قطاع",
  department: "إدارة",
  section: "قسم",
  branch: "فرع",
  emp: "موظف",
};

export default function Leaves() {
  const { data: leaves } = useLeaves();
  const { data: employees } = useEmployees();
  const { data: officialHolidays } = useOfficialHolidays();
  const createOfficialHoliday = useCreateOfficialHoliday();
  const deleteOfficialHoliday = useDeleteOfficialHoliday();
  const updateAttendanceRecord = useUpdateAttendanceRecord();
  const createLeave = useCreateLeave();
  const deleteLeave = useDeleteLeave();
  const importLeaves = useImportLeaves();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attendanceRecords = useAttendanceStore((state) => state.attendanceRecords);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({
    employeeCode: "",
    date: "",
    from: "",
    to: "",
    type: "",
    notes: "",
  });
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "" });
  const [selectedHolidayDate, setSelectedHolidayDate] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"official" | "other">("official");

  const [form, setForm] = useState({
    type: "official",
    scope: "all",
    scopeValue: "",
    startDate: "",
    endDate: "",
    note: "",
  });

  const rows = useMemo(() => leaves || [], [leaves]);
  const holidayRecordMap = useMemo(() => {
    const map = new Map<string, any>();
    if (!selectedHolidayDate) return map;
    attendanceRecords
      .filter((record) => record.date === selectedHolidayDate)
      .forEach((record) => {
        map.set(record.employeeCode, record);
      });
    return map;
  }, [attendanceRecords, selectedHolidayDate]);

  const handleCreate = async () => {
    if (!form.startDate || !form.endDate) {
      toast({ title: "خطأ", description: "يرجى تحديد الفترة", variant: "destructive" });
      return;
    }
    if (form.scope !== "all" && !form.scopeValue) {
      toast({ title: "خطأ", description: "يرجى تحديد قيمة النطاق", variant: "destructive" });
      return;
    }
    await createLeave.mutateAsync({
      type: form.type,
      scope: form.scope,
      scopeValue: form.scope === "all" ? null : form.scopeValue,
      startDate: form.startDate,
      endDate: form.endDate,
      note: form.note || null,
    });
    toast({ title: "تم الحفظ", description: "تم إضافة الإجازة" });
    setForm((prev) => ({ ...prev, scopeValue: "", note: "" }));
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      rows.map((leave: any) => ({
        النوع: leave.type,
        النطاق: leave.scope,
        القيمة: leave.scopeValue || "",
        من: leave.startDate,
        إلى: leave.endDate,
        ملاحظة: leave.note || "",
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leaves");
    XLSX.writeFile(workbook, "leaves.xlsx");
  };

  const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "");
  const guessHeader = (headers: string[], candidates: string[]) => {
    const normalized = headers.map((header) => ({ header, key: normalizeHeader(header) }));
    const found = normalized.find((item) => candidates.includes(item.key));
    return found?.header || "";
  };

  const parseDateValue = (value: any) => {
    if (!value) return null;
    if (value instanceof Date && isValid(value)) {
      return format(value, "yyyy-MM-dd");
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const parsed = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      const direct = parse(trimmed, "yyyy-MM-dd", new Date());
      if (isValid(direct)) return format(direct, "yyyy-MM-dd");
      const alt = parse(trimmed, "dd/MM/yyyy", new Date());
      if (isValid(alt)) return format(alt, "yyyy-MM-dd");
      const fallback = new Date(trimmed);
      return isValid(fallback) ? format(fallback, "yyyy-MM-dd") : null;
    }
    return null;
  };

  const normalizeLeaveType = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "official" || trimmed === "اجازة رسمية") return "official";
    if (trimmed === "collections" || trimmed === "اجازات التحصيل") return "collections";
    return "";
  };

  const hasOverlap = (start: string, end: string, otherStart: string, otherEnd: string) => {
    return !(end < otherStart || start > otherEnd);
  };

  const getWorkedOnHoliday = (record: any) => {
    if (!record) return false;
    if (record.workedOnOfficialHoliday !== null && record.workedOnOfficialHoliday !== undefined) {
      return Boolean(record.workedOnOfficialHoliday);
    }
    return Boolean(record.checkIn || record.checkOut)
      || (typeof record.totalHours === "number" && record.totalHours > 0)
      || Boolean(record.missionStart && record.missionEnd);
  };

  const handleAddOfficialHoliday = async () => {
    if (!holidayForm.date || !holidayForm.name) {
      toast({ title: "خطأ", description: "يرجى تحديد التاريخ واسم الإجازة.", variant: "destructive" });
      return;
    }
    await createOfficialHoliday.mutateAsync({
      date: holidayForm.date,
      name: holidayForm.name,
    });
    setHolidayForm({ date: "", name: "" });
    toast({ title: "تمت الإضافة", description: "تم حفظ الإجازة الرسمية." });
  };

  const handleFilePreview = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
    if (data.length === 0) {
      toast({ title: "تنبيه", description: "الملف فارغ", variant: "destructive" });
      return;
    }
    const headers = Object.keys(data[0]);
    setImportHeaders(headers);
    setImportRows(data);
    setImportPreview(data.slice(0, 10));
    setMapping({
      employeeCode: guessHeader(headers, ["الكود", "كود", "employeecode", "code", "id", "employeeid"]),
      date: guessHeader(headers, ["التاريخ", "date", "day"]),
      from: guessHeader(headers, ["من", "from", "start"]),
      to: guessHeader(headers, ["الى", "إلى", "to", "end"]),
      type: guessHeader(headers, ["النوع", "type"]),
      notes: guessHeader(headers, ["ملاحظات", "ملاحظة", "notes", "note"]),
    });
  };

  const handleImport = async () => {
    if (!mapping.employeeCode || !mapping.date || !mapping.type) {
      toast({ title: "خطأ", description: "يرجى تحديد الأعمدة الأساسية (الكود، التاريخ، النوع).", variant: "destructive" });
      return;
    }
    const employeeMap = new Map((employees || []).map((emp) => [String(emp.code), emp]));
    const invalid: { rowIndex: number; reason: string }[] = [];
    const rowsToImport = importRows.map((row, index) => {
      const employeeCode = String(row[mapping.employeeCode] || "").trim();
      const dateValue = parseDateValue(row[mapping.date]);
      const fromValue = mapping.from ? parseDateValue(row[mapping.from]) : null;
      const toValue = mapping.to ? parseDateValue(row[mapping.to]) : null;
      const typeValue = normalizeLeaveType(String(row[mapping.type] || ""));
      const notesValue = mapping.notes ? String(row[mapping.notes] || "").trim() : "";

      if (!employeeCode || !employeeMap.has(employeeCode)) {
        invalid.push({ rowIndex: index + 2, reason: "كود الموظف غير معروف" });
        return null;
      }
      const startDate = fromValue || dateValue;
      const endDate = toValue || dateValue;
      if (!startDate || !endDate) {
        invalid.push({ rowIndex: index + 2, reason: "تاريخ غير صالح" });
        return null;
      }
      if (!typeValue) {
        invalid.push({ rowIndex: index + 2, reason: "نوع الإجازة غير صالح" });
        return null;
      }

      const existingLeaves = rows.filter((leave: any) => leave.scope === "emp" && leave.scopeValue === employeeCode);
      const overlap = existingLeaves.some((leave: any) => hasOverlap(startDate, endDate, leave.startDate, leave.endDate));
      if (overlap) {
        invalid.push({ rowIndex: index + 2, reason: "تداخل مع إجازة موجودة" });
        return null;
      }

      return {
        type: typeValue,
        scope: "emp",
        scopeValue: employeeCode,
        startDate,
        endDate,
        note: notesValue || null,
      };
    }).filter(Boolean);

    if (rowsToImport.length === 0) {
      toast({ title: "خطأ", description: "لا توجد صفوف صالحة للاستيراد.", variant: "destructive" });
      return;
    }

    await importLeaves.mutateAsync({ rows: rowsToImport as any });
    if (invalid.length > 0) {
      toast({
        title: "تم الاستيراد مع تحذيرات",
        description: `تم استيراد ${rowsToImport.length} صفوف، مع ${invalid.length} صفوف غير صالحة.`,
        variant: "destructive",
      });
    } else {
      toast({ title: "نجاح", description: "تم استيراد الإجازات" });
    }
    setImportPreview([]);
    setImportRows([]);
    setImportHeaders([]);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="إدارة الإجازات" />
        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "official" | "other")}>
            <div className="flex justify-end">
              <Link href="/effects"><Button variant="outline">إدارة المؤثرات</Button></Link>
            </div>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="official">الإجازات الرسمية</TabsTrigger>
              <TabsTrigger value="other">الإجازات الأخرى</TabsTrigger>
            </TabsList>
            <TabsContent value="official" className="space-y-6">
              <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">تاريخ الإجازة الرسمية</label>
                <Input
                  type="date"
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">اسم الإجازة</label>
                <Input
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: عيد العمال"
                />
              </div>
              <Button onClick={handleAddOfficialHoliday}>إضافة إجازة رسمية</Button>
            </div>

            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/40 text-muted-foreground font-medium">
                  <tr>
                    <th className="px-4 py-3">التاريخ</th>
                    <th className="px-4 py-3">الاسم</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {(officialHolidays || []).map((holiday) => (
                    <tr key={holiday.id}>
                      <td className="px-4 py-3">{holiday.date}</td>
                      <td className="px-4 py-3">{holiday.name}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" onClick={() => deleteOfficialHoliday.mutateAsync(holiday.id)}>
                          حذف
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(officialHolidays || []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                        لا توجد إجازات رسمية مسجلة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {(officialHolidays || []).map((holiday) => (
                <div key={holiday.id} className="border border-border/50 rounded-xl p-4">
                  <div className="text-sm text-muted-foreground">{holiday.date}</div>
                  <div className="font-semibold">{holiday.name}</div>
                  <Button variant="ghost" onClick={() => deleteOfficialHoliday.mutateAsync(holiday.id)}>
                    حذف
                  </Button>
                </div>
              ))}
              {(officialHolidays || []).length === 0 && (
                <div className="text-center text-muted-foreground">لا توجد إجازات رسمية مسجلة</div>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <Select value={selectedHolidayDate} onValueChange={setSelectedHolidayDate}>
                <SelectTrigger className="w-full md:w-60">
                  <SelectValue placeholder="اختر تاريخ إجازة" />
                </SelectTrigger>
                <SelectContent>
                  {(officialHolidays || []).map((holiday) => (
                    <SelectItem key={holiday.id} value={holiday.date}>
                      {holiday.date} - {holiday.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                يجب معالجة الحضور لإظهار حالة الموظفين في الإجازة الرسمية.
              </span>
            </div>

            {selectedHolidayDate && (
              <div className="space-y-3">
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-muted/40 text-muted-foreground font-medium">
                      <tr>
                        <th className="px-4 py-3">الكود</th>
                        <th className="px-4 py-3">الاسم</th>
                        <th className="px-4 py-3">حضر؟</th>
                        <th className="px-4 py-3">يوم بالبدل</th>
                        <th className="px-4 py-3">تجاوز يدوي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {(employees || []).map((employee) => {
                        const record = holidayRecordMap.get(employee.code);
                        const worked = record ? getWorkedOnHoliday(record) : false;
                        return (
                          <tr key={employee.code}>
                            <td className="px-4 py-3">{employee.code}</td>
                            <td className="px-4 py-3">{employee.nameAr}</td>
                            <td className="px-4 py-3">{record ? (worked ? "نعم" : "لا") : "-"}</td>
                            <td className="px-4 py-3">{record ? (worked ? 1 : 0) : "-"}</td>
                            <td className="px-4 py-3">
                              {record ? (
                                <Switch
                                  checked={worked}
                                  onCheckedChange={(value) =>
                                    updateAttendanceRecord.mutate({
                                      id: record.id,
                                      updates: {
                                        workedOnOfficialHoliday: value,
                                        compDayCredit: value ? 1 : 0,
                                      },
                                    })
                                  }
                                />
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-3">
                  {(employees || []).map((employee) => {
                    const record = holidayRecordMap.get(employee.code);
                    const worked = record ? getWorkedOnHoliday(record) : false;
                    return (
                      <div key={employee.code} className="border border-border/50 rounded-xl p-4 space-y-2">
                        <div className="font-semibold">{employee.code} - {employee.nameAr}</div>
                        <div className="text-sm">حضر؟ {record ? (worked ? "نعم" : "لا") : "-"}</div>
                        <div className="text-sm">يوم بالبدل: {record ? (worked ? 1 : 0) : "-"}</div>
                        {record && (
                          <div className="flex items-center justify-between text-sm">
                            <span>تجاوز يدوي</span>
                            <Switch
                              checked={worked}
                              onCheckedChange={(value) =>
                                updateAttendanceRecord.mutate({
                                  id: record.id,
                                  updates: {
                                    workedOnOfficialHoliday: value,
                                    compDayCredit: value ? 1 : 0,
                                  },
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
              </div>
            </TabsContent>
            <TabsContent value="other" className="space-y-6">
              <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collections">اجازات التحصيل</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.scope} onValueChange={(value) => setForm((prev) => ({ ...prev, scope: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="النطاق" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="sector">قطاع</SelectItem>
                  <SelectItem value="department">إدارة</SelectItem>
                  <SelectItem value="section">قسم</SelectItem>
                  <SelectItem value="branch">فرع</SelectItem>
                  <SelectItem value="emp">موظف</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="قيمة النطاق"
                value={form.scopeValue}
                onChange={(e) => setForm((prev) => ({ ...prev, scopeValue: e.target.value }))}
                disabled={form.scope === "all"}
              />
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              />
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
              <Input
                placeholder="ملاحظة"
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCreate}>إضافة إجازة</Button>
              <Button variant="outline" onClick={handleExport}>تصدير</Button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFilePreview(file);
                  }
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                استيراد
              </Button>
            </div>
              </div>

              {importPreview.length > 0 && (
                <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-bold">تعيين أعمدة ملف الإجازات</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={mapping.employeeCode} onValueChange={(value) => setMapping((prev) => ({ ...prev, employeeCode: value }))}>
                  <SelectTrigger><SelectValue placeholder="عمود الكود" /></SelectTrigger>
                  <SelectContent>
                    {importHeaders.map((header) => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={mapping.date} onValueChange={(value) => setMapping((prev) => ({ ...prev, date: value }))}>
                  <SelectTrigger><SelectValue placeholder="عمود التاريخ" /></SelectTrigger>
                  <SelectContent>
                    {importHeaders.map((header) => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={mapping.type} onValueChange={(value) => setMapping((prev) => ({ ...prev, type: value }))}>
                  <SelectTrigger><SelectValue placeholder="عمود النوع" /></SelectTrigger>
                  <SelectContent>
                    {importHeaders.map((header) => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={mapping.from} onValueChange={(value) => setMapping((prev) => ({ ...prev, from: value }))}>
                  <SelectTrigger><SelectValue placeholder="عمود من (اختياري)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون</SelectItem>
                    {importHeaders.map((header) => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={mapping.to} onValueChange={(value) => setMapping((prev) => ({ ...prev, to: value }))}>
                  <SelectTrigger><SelectValue placeholder="عمود إلى (اختياري)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون</SelectItem>
                    {importHeaders.map((header) => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={mapping.notes} onValueChange={(value) => setMapping((prev) => ({ ...prev, notes: value }))}>
                  <SelectTrigger><SelectValue placeholder="عمود الملاحظات (اختياري)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون</SelectItem>
                    {importHeaders.map((header) => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      {importHeaders.map((header) => (
                        <th key={header} className="px-3 py-2">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        {importHeaders.map((header) => (
                          <td key={header} className="px-3 py-2">{String(row[header] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleImport}>استيراد الإجازات</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportPreview([]);
                    setImportRows([]);
                    setImportHeaders([]);
                  }}
                >
                  إلغاء
                </Button>
              </div>
                </div>
              )}

              <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-right hidden md:table">
                  <thead className="bg-muted/40 text-muted-foreground font-medium">
                    <tr>
                      <th className="px-4 py-3">النوع</th>
                      <th className="px-4 py-3">النطاق</th>
                      <th className="px-4 py-3">القيمة</th>
                      <th className="px-4 py-3">من</th>
                      <th className="px-4 py-3">إلى</th>
                      <th className="px-4 py-3">ملاحظة</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {rows.map((leave: any) => (
                      <tr key={leave.id}>
                        <td className="px-4 py-3">{TYPE_LABELS[leave.type] || leave.type}</td>
                        <td className="px-4 py-3">{SCOPE_LABELS[leave.scope] || leave.scope}</td>
                        <td className="px-4 py-3">{leave.scopeValue || "-"}</td>
                        <td className="px-4 py-3">{leave.startDate}</td>
                        <td className="px-4 py-3">{leave.endDate}</td>
                        <td className="px-4 py-3">{leave.note || "-"}</td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            onClick={() => deleteLeave.mutateAsync(leave.id)}
                          >
                            حذف
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                          لا توجد إجازات مسجلة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="md:hidden space-y-3 p-4">
                  {rows.map((leave: any) => (
                    <div key={leave.id} className="border border-border/50 rounded-xl p-4 space-y-2">
                      <div className="font-semibold">{TYPE_LABELS[leave.type] || leave.type}</div>
                      <div className="text-sm">النطاق: {SCOPE_LABELS[leave.scope] || leave.scope}</div>
                      <div className="text-sm">القيمة: {leave.scopeValue || "-"}</div>
                      <div className="text-sm">من: {leave.startDate}</div>
                      <div className="text-sm">إلى: {leave.endDate}</div>
                      <div className="text-sm">ملاحظة: {leave.note || "-"}</div>
                      <Button variant="ghost" onClick={() => deleteLeave.mutateAsync(leave.id)}>
                        حذف
                      </Button>
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <div className="text-center text-muted-foreground">لا توجد إجازات مسجلة</div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
