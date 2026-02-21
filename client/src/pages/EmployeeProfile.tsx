import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEmployees } from "@/hooks/use-employees";
import { useAttendanceStore, type AttendanceStoreState } from "@/store/attendanceStore";
import { ArrowRight, CalendarDays, FileText } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";

type RouteProps = { params?: { code?: string } };

export default function EmployeeProfile({ params }: RouteProps) {
  const [, setLocation] = useLocation();
  const codeParam = params?.code ? String(params.code) : "";
  const { data: employees } = useEmployees();

  const adjustments = useAttendanceStore((s: AttendanceStoreState) => s.adjustments);

  const employee = useMemo(() => {
    const code = codeParam.trim();
    if (!code) return null;
    return (employees || []).find((e: any) => String(e.code).trim() === code) || null;
  }, [employees, codeParam]);

  const employeeEffects = useMemo(() => {
    const code = codeParam.trim();
    if (!code) return [];
    return (adjustments || []).filter((a: any) => String(a.employeeCode ?? a.code ?? "").trim() === code);
  }, [adjustments, codeParam]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="ملف الموظف" />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setLocation("/employees")}
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                رجوع
              </Button>
              <Button
                variant="secondary"
                onClick={() => setLocation(`/attendance?employee=${encodeURIComponent(codeParam)}`)}
              >
                <FileText className="w-4 h-4 ml-2" />
                فتح التقرير
              </Button>
            </div>
          </div>

          {!employee ? (
            <Card>
              <CardHeader>
                <CardTitle>لم يتم العثور على موظف</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                تأكد من الكود في الرابط.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>بيانات الموظف</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">الكود</span><span className="font-semibold">{employee.code}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الاسم</span><span className="font-semibold">{employee.nameAr}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">القسم</span><span className="font-semibold">{employee.section || employee.department || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">تاريخ التعيين</span><span className="font-semibold">{employee.hireDate || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">تاريخ ترك العمل</span><span className="font-semibold">{employee.terminationDate || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">مدير الإدارة</span><span className="font-semibold">{employee.deptManager || "-"}</span></div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>المؤثرات المسجلة</CardTitle>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <CalendarDays className="w-4 h-4" />
                    {employeeEffects.length} مؤثر
                  </div>
                </CardHeader>
                <CardContent>
                  {employeeEffects.length === 0 ? (
                    <div className="text-muted-foreground">لا توجد مؤثرات مسجلة لهذا الموظف.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-right border-b">
                            <th className="py-2">التاريخ</th>
                            <th className="py-2">النوع</th>
                            <th className="py-2">ملاحظات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeEffects.slice(0, 200).map((a: any, idx: number) => (
                            <tr key={a.id || idx} className="border-b last:border-b-0">
                              <td className="py-2 whitespace-nowrap">{a.date || a.fromDate || "-"}</td>
                              <td className="py-2">{a.type || a.effectType || "-"}</td>
                              <td className="py-2 text-muted-foreground">{a.notes || ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {employeeEffects.length > 200 && (
                        <div className="mt-3 text-xs text-muted-foreground">تم عرض أول 200 مؤثر فقط.</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
