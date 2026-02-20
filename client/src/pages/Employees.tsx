import { useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileDown } from "lucide-react";
import { useEmployees } from "@/hooks/use-employees";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import type { Employee } from "@shared/schema";

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

export default function Employees() {
  const { data: employees, isLoading } = useEmployees();
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [filters, setFilters] = useState({ sector: "all", branch: "all", department: "all" });

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
  
  const filteredEmployees = useMemo(
    () =>
      employees?.filter((emp) => {
        const normalizedSearch = normalizeArabic(searchTerm);
        const matchesSearch = !normalizedSearch
          || normalizeArabic(emp.nameAr || "").includes(normalizedSearch)
          || normalizeArabic(emp.code || "").includes(normalizedSearch);
        const matchesSector = filters.sector === "all" || emp.sector === filters.sector;
        const matchesBranch = filters.branch === "all" || emp.branch === filters.branch;
        const matchesDepartment = filters.department === "all" || emp.department === filters.department;
        return matchesSearch && matchesSector && matchesBranch && matchesDepartment;
      }) ?? [],
    [employees, searchTerm, filters]
  );

  const handleExport = () => {
    if (!employees || employees.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(employees);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, "Employees_Master_Data.xlsx");
    toast({ title: "تم التصدير", description: "تم تحميل ملف بيانات الموظفين بنجاح" });
  };

  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="الموظفين" />
        
        <main className="flex-1 overflow-y-auto p-8">
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="relative w-full lg:w-72">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="بحث بالكود أو الاسم..." 
                    className="pr-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Select
                    value={filters.sector}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, sector: value }))}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="القطاع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل القطاعات</SelectItem>
                      {sectors.map((sector) => (
                        <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.branch}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, branch: value }))}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الفروع</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.department}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, department: value }))}
                  >
                    <SelectTrigger className="w-44">
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
                <Button variant="outline" className="gap-2" onClick={handleExport}>
                  <FileDown className="w-4 h-4" />
                  تصدير
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">الإجمالي: {filteredEmployees.length}</Badge>
                {filters.sector !== "all" && <Badge variant="outline">{filters.sector}</Badge>}
                {filters.branch !== "all" && <Badge variant="outline">{filters.branch}</Badge>}
                {filters.department !== "all" && <Badge variant="outline">{filters.department}</Badge>}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right hidden md:table">
                  <thead className="bg-slate-50 text-muted-foreground font-medium sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4">كود</th>
                      <th className="px-6 py-4">الاسم</th>
                      <th className="px-6 py-4">القطاع</th>
                      <th className="px-6 py-4">الإدارة</th>
                      <th className="px-6 py-4">الفرع</th>
                      <th className="px-6 py-4">الوظيفة</th>
                      <th className="px-6 py-4">تاريخ التعيين</th>
                      <th className="px-6 py-4">التليفون</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {isLoading ? (
                      <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
                    ) : filteredEmployees.length === 0 ? (
                      <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">لا يوجد موظفين</td></tr>
                    ) : (
                      filteredEmployees.map((employee) => (
                        <tr
                          key={employee.id}
                          className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedEmployee(employee)}
                        >
                          <td className="px-6 py-4 font-mono text-primary">{employee.code}</td>
                          <td className="px-6 py-4 font-medium">{employee.nameAr}</td>
                          <td className="px-6 py-4">
                            <Badge variant="secondary">{employee.sector || "-"}</Badge>
                          </td>
                          <td className="px-6 py-4">{employee.department || "-"}</td>
                          <td className="px-6 py-4">{employee.branch || "-"}</td>
                          <td className="px-6 py-4">{employee.jobTitle || "-"}</td>
                          <td className="px-6 py-4 text-muted-foreground">{employee.hireDate || "-"}</td>
                          <td className="px-6 py-4" dir="ltr">{employee.personalPhone || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="md:hidden space-y-3 p-4">
                  {isLoading ? (
                    <div className="text-center text-muted-foreground">جاري التحميل...</div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="text-center text-muted-foreground">لا يوجد موظفين</div>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <div
                        key={employee.id}
                        className="border border-border/50 rounded-xl p-4 space-y-3 bg-white hover:border-primary/40 transition-colors"
                        onClick={() => setSelectedEmployee(employee)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold">{employee.nameAr}</div>
                            <div className="text-xs text-muted-foreground">{employee.code}</div>
                          </div>
                          <Badge variant="secondary">{employee.sector || "-"}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>الإدارة: <span className="text-foreground">{employee.department || "-"}</span></div>
                          <div>الفرع: <span className="text-foreground">{employee.branch || "-"}</span></div>
                          <div>الوظيفة: <span className="text-foreground">{employee.jobTitle || "-"}</span></div>
                          <div>التعيين: <span className="text-foreground">{employee.hireDate || "-"}</span></div>
                        </div>
                        <div className="text-xs" dir="ltr">{employee.personalPhone || "-"}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          <Dialog open={Boolean(selectedEmployee)} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
            <DialogContent className="sm:max-w-[680px]" dir="rtl">
              <DialogHeader>
                <DialogTitle>تفاصيل الموظف</DialogTitle>
                <DialogDescription>عرض شامل لبيانات الموظف مع خيارات النسخ السريع.</DialogDescription>
              </DialogHeader>
              {selectedEmployee && (
                <div className="space-y-6 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-border/50 rounded-xl p-4">
                    <h3 className="md:col-span-2 text-sm font-semibold text-muted-foreground">البيانات الأساسية</h3>
                    <div><span className="font-semibold">الكود:</span> {selectedEmployee.code}</div>
                    <div><span className="font-semibold">الاسم:</span> {selectedEmployee.nameAr}</div>
                    <div><span className="font-semibold">القطاع:</span> {selectedEmployee.sector || "-"}</div>
                    <div><span className="font-semibold">الإدارة:</span> {selectedEmployee.department || "-"}</div>
                    <div><span className="font-semibold">القسم:</span> {selectedEmployee.section || "-"}</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-border/50 rounded-xl p-4">
                    <h3 className="md:col-span-2 text-sm font-semibold text-muted-foreground">بيانات الوظيفة</h3>
                    <div><span className="font-semibold">الوظيفة:</span> {selectedEmployee.jobTitle || "-"}</div>
                    <div><span className="font-semibold">الفرع:</span> {selectedEmployee.branch || "-"}</div>
                    <div><span className="font-semibold">المحافظة:</span> {selectedEmployee.governorate || "-"}</div>
                    <div><span className="font-semibold">بداية الوردية:</span> {selectedEmployee.shiftStart || "-"}</div>
                    <div><span className="font-semibold">المدير المباشر:</span> {selectedEmployee.directManager || "-"}</div>
                    <div><span className="font-semibold">مدير الإدارة:</span> {selectedEmployee.deptManager || "-"}</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-border/50 rounded-xl p-4">
                    <h3 className="md:col-span-2 text-sm font-semibold text-muted-foreground">بيانات التواصل</h3>
                    <div><span className="font-semibold">التليفون الشخصي:</span> {selectedEmployee.personalPhone || "-"}</div>
                    <div><span className="font-semibold">تليفون الطوارئ:</span> {selectedEmployee.emergencyPhone || "-"}</div>
                    <div><span className="font-semibold">العنوان:</span> {selectedEmployee.address || "-"}</div>
                    <div><span className="font-semibold">محل الميلاد:</span> {selectedEmployee.birthPlace || "-"}</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-border/50 rounded-xl p-4">
                    <h3 className="md:col-span-2 text-sm font-semibold text-muted-foreground">التواريخ والهوية</h3>
                    <div><span className="font-semibold">تاريخ التعيين:</span> {selectedEmployee.hireDate || "-"}</div>
                    <div><span className="font-semibold">تاريخ ترك العمل:</span> {selectedEmployee.terminationDate || "-"}</div>
                    <div><span className="font-semibold">سبب ترك العمل:</span> {selectedEmployee.terminationReason || "-"}</div>
                    <div><span className="font-semibold">مدة الخدمة:</span> {selectedEmployee.serviceDuration || "-"}</div>
                    <div><span className="font-semibold">الرقم القومي:</span> {selectedEmployee.nationalId || "-"}</div>
                    <div><span className="font-semibold">تاريخ الميلاد:</span> {selectedEmployee.birthDate || "-"}</div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
