import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useEmployees } from "@/hooks/use-employees";
import { useAttendanceStore } from "@/store/attendanceStore";
import { useEffectsStore, type Effect } from "@/store/effectsStore";
import { applyEffectsToState } from "@/effects/applyEffects";
import { normalizeEmployeeCode } from "@shared/employee-code";
import { buildEffectsTemplateWorkbook, EFFECT_EXPORT_HEADERS, parseEffectsSheet } from "@/effects/effectsImport";

const weekDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function Effects() {
  const { toast } = useToast();
  const { data: employees } = useEmployees();
  const rules = useAttendanceStore((s) => s.rules);
  const punches = useAttendanceStore((s) => s.punches);

  const effects = useEffectsStore((s) => s.effects);
  const upsertEffects = useEffectsStore((s) => s.upsertEffects);
  const removeEffect = useEffectsStore((s) => s.removeEffect);
  const updateEffect = useEffectsStore((s) => s.updateEffect);

  const adjustments = useAttendanceStore((s) => s.adjustments);
  const leaves = useAttendanceStore((s) => s.leaves);
  const setAdjustments = useAttendanceStore((s) => s.setAdjustments);
  const setLeaves = useAttendanceStore((s) => s.setLeaves);
  const processAttendance = useAttendanceStore((s) => s.processAttendance);

  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editRow, setEditRow] = useState<Effect | null>(null);
  const [validation, setValidation] = useState<{ invalidRows: Array<{ rowIndex: number; reason?: string }> }>({ invalidRows: [] });
  const [bulkDeleteStart, setBulkDeleteStart] = useState("");
  const [bulkDeleteEnd, setBulkDeleteEnd] = useState("");

  const employeeMap = useMemo(() => new Map((employees || []).map((e) => [normalizeEmployeeCode(e.code), e])), [employees]);
  const types = useMemo(() => Array.from(new Set(effects.map((e) => e.type))).sort(), [effects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return effects.filter((effect) => {
      const employee = employeeMap.get(normalizeEmployeeCode(effect.employeeCode));
      if (startDate && effect.date < startDate) return false;
      if (endDate && effect.date > endDate) return false;
      if (typeFilter !== "all" && effect.type !== typeFilter) return false;
      if (!q) return true;
      return [effect.employeeCode, effect.employeeName || employee?.nameAr || "", effect.type].join(" ").toLowerCase().includes(q);
    });
  }, [effects, search, startDate, endDate, typeFilter, employeeMap]);

  const reapply = (rows: Effect[]) => {
    const applied = applyEffectsToState({ effects: rows, adjustments, leaves });
    setAdjustments(applied.adjustments);
    setLeaves(applied.leaves);
    if (applied.affectedDates.length > 0) {
      processAttendance({
        startDate: applied.affectedDates[0],
        endDate: applied.affectedDates[applied.affectedDates.length - 1],
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        employeeCodes: applied.employeeCodes,
      });
    }
  };

  const handleImport = async (file: File) => {
    try {
      const { validRows, invalidRows } = await parseEffectsSheet({ file, employees: employees || [], punches, rules });
      setValidation({ invalidRows });

      if (validRows.length === 0) {
        toast({ title: "تنبيه", description: "لا توجد صفوف صالحة للاستيراد", variant: "destructive" });
        return;
      }

      const stats = upsertEffects(validRows);
      reapply(useEffectsStore.getState().effects);
      toast({ title: "تم الحفظ", description: `تم حفظ ${stats.inserted + stats.updated} مؤثر${invalidRows.length ? ` مع ${invalidRows.length} صف غير صالح` : ""}` });
    } catch (error: any) {
      toast({ title: "خطأ", description: error?.message || "فشل قراءة الملف", variant: "destructive" });
    }
  };

  const exportFiltered = () => {
    const data = filtered.map((row) => ({
      الكود: row.employeeCode,
      الاسم: row.employeeName || employeeMap.get(normalizeEmployeeCode(row.employeeCode))?.nameAr || "",
      التاريخ: row.date,
      من: row.fromTime || "",
      الي: row.toTime || "",
      النوع: row.type,
      الحالة: row.status || "",
      ملاحظة: row.note || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data, { header: EFFECT_EXPORT_HEADERS as unknown as string[] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المؤثرات");
    XLSX.writeFile(wb, "effects-export.xlsx");
  };

  return (
    <div className="flex h-screen bg-background" dir="rtl">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="المؤثرات" />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="rounded-2xl border bg-white p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Input placeholder="بحث بالكود/الاسم/النوع" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger><SelectValue placeholder="النوع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    {types.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); setTypeFilter("all"); }}>مسح الفلاتر</Button>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <Input type="file" accept=".xlsx,.xls" className="max-w-sm" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
                <Button variant="outline" onClick={exportFiltered}>تصدير القائمة</Button>
                <Button variant="outline" onClick={() => XLSX.writeFile(buildEffectsTemplateWorkbook(), "تمبليت_المؤثرات_الشامل.xlsx")}>تحميل قالب جاهز</Button>
                <Input type="date" className="w-40" value={bulkDeleteStart} onChange={(e) => setBulkDeleteStart(e.target.value)} />
                <Input type="date" className="w-40" value={bulkDeleteEnd} onChange={(e) => setBulkDeleteEnd(e.target.value)} />
                <Button variant="destructive" onClick={() => {
                  if (!bulkDeleteStart || !bulkDeleteEnd) {
                    toast({ title: "تنبيه", description: "حدد فترة الحذف", variant: "destructive" });
                    return;
                  }
                  const next = useEffectsStore.getState().effects.filter((e) => !(e.date >= bulkDeleteStart && e.date <= bulkDeleteEnd));
                  useEffectsStore.getState().setEffects(next as any);
                  reapply(next as any);
                  toast({ title: "تم الحذف", description: "تم حذف المؤثرات في الفترة المحددة" });
                }}>حذف جماعي بالفترة</Button>
                <Badge className="mr-auto">صالح: {Math.max(0, filtered.length)} | غير صالح آخر استيراد: {validation.invalidRows.length}</Badge>
              </div>

              {validation.invalidRows.length > 0 && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium mb-2">الصفوف غير الصالحة</h4>
                  <div className="max-h-40 overflow-auto text-xs space-y-1">
                    {validation.invalidRows.map((row) => (
                      <div key={`invalid-${row.rowIndex}`} className="text-red-600">صف {row.rowIndex}: {row.reason || "خطأ غير معروف"}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full text-xs min-w-[1200px]">
                  <thead className="sticky top-0 bg-white">
                    <tr>
                      <th className="px-3 py-2">التاريخ</th><th className="px-3 py-2">اليوم</th><th className="px-3 py-2">الكود</th><th className="px-3 py-2">الاسم</th><th className="px-3 py-2">النوع</th><th className="px-3 py-2">من</th><th className="px-3 py-2">إلى</th><th className="px-3 py-2">الحالة</th><th className="px-3 py-2">ملاحظة</th><th className="px-3 py-2">المصدر</th><th className="px-3 py-2">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const employee = employeeMap.get(normalizeEmployeeCode(row.employeeCode));
                      const day = weekDays[new Date(row.date).getDay()] || "-";
                      return (
                        <tr key={row.id} className="border-t border-border/30">
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2">{day}</td>
                          <td className="px-3 py-2">{row.employeeCode}</td>
                          <td className="px-3 py-2">{row.employeeName || employee?.nameAr || "-"}</td>
                          <td className="px-3 py-2">{row.type}</td>
                          <td className="px-3 py-2">{row.fromTime || "-"}</td>
                          <td className="px-3 py-2">{row.toTime || "-"}</td>
                          <td className="px-3 py-2">{row.status || "-"}</td>
                          <td className="px-3 py-2">{row.note || "-"}</td>
                          <td className="px-3 py-2">{row.source}</td>
                          <td className="px-3 py-2 space-x-2 space-x-reverse">
                            <Button size="sm" variant="outline" onClick={() => setEditRow(row)}>تعديل</Button>
                            <Button size="sm" variant="destructive" onClick={() => {
                              if (!confirm("حذف هذا المؤثر؟")) return;
                              removeEffect(row.id);
                              reapply(useEffectsStore.getState().effects.filter((e) => e.id !== row.id));
                            }}>حذف</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={Boolean(editRow)} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل المؤثر</DialogTitle>
            <DialogDescription>يمكن تعديل الحالة والملاحظة والتوقيتات.</DialogDescription>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3">
              <Input value={editRow.status || ""} onChange={(e) => setEditRow({ ...editRow, status: e.target.value })} placeholder="الحالة" />
              <Input value={editRow.note || ""} onChange={(e) => setEditRow({ ...editRow, note: e.target.value })} placeholder="ملاحظة" />
              <Input value={editRow.fromTime || ""} onChange={(e) => setEditRow({ ...editRow, fromTime: e.target.value })} placeholder="من" />
              <Input value={editRow.toTime || ""} onChange={(e) => setEditRow({ ...editRow, toTime: e.target.value })} placeholder="إلى" />
              <Button onClick={() => {
                updateEffect(editRow.id, editRow);
                reapply(useEffectsStore.getState().effects);
                setEditRow(null);
                toast({ title: "تم التحديث", description: "تم تحديث المؤثر" });
              }}>حفظ</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
