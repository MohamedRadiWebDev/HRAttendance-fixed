import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Plus, FileText, CheckCircle2, Search } from "lucide-react";
import { useAdjustments, useCreateAdjustment } from "@/hooks/use-data";
import { useEmployees } from "@/hooks/use-employees";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { format, parse } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAdjustmentSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Adjustments() {
  const { data: adjustments, isLoading } = useAdjustments();
  const { data: employees } = useEmployees();
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const filteredAdjustments = adjustments?.filter(adj => 
    adj.employeeCode.includes(searchTerm) || 
    employees?.find(e => e.code === adj.employeeCode)?.nameAr.includes(searchTerm)
  );

  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="التسويات والإجازات" />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <div className="relative w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="بحث بالكود أو الاسم..." 
                  className="pr-10 h-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Link href="/effects"><Button variant="outline">عرض كل المؤثرات</Button></Link>
                <AddAdjustmentDialog />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-600">كود الموظف</th>
                    <th className="px-6 py-4 font-bold text-slate-600">النوع</th>
                    <th className="px-6 py-4 font-bold text-slate-600">التاريخ</th>
                    <th className="px-6 py-4 font-bold text-slate-600">من</th>
                    <th className="px-6 py-4 font-bold text-slate-600">إلى</th>
                    <th className="px-6 py-4 font-bold text-slate-600">المصدر</th>
                    <th className="px-6 py-4 font-bold text-slate-600">الحالة</th>
                    <th className="px-6 py-4 font-bold text-slate-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={8} className="px-6 py-4 h-12 bg-slate-50/50"></td>
                      </tr>
                    ))
                  ) : filteredAdjustments?.map((adj) => (
                    <tr key={adj.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        <div className="flex flex-col">
                          <span className="font-mono">{adj.employeeCode}</span>
                          <span className="text-xs text-muted-foreground">
                            {employees?.find(e => e.code === adj.employeeCode)?.nameAr}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="capitalize">
                          {adj.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{adj.date}</td>
                      <td className="px-6 py-4 text-muted-foreground font-mono">{adj.fromTime}</td>
                      <td className="px-6 py-4 text-muted-foreground font-mono">{adj.toTime}</td>
                      <td className="px-6 py-4 text-muted-foreground">{adj.source}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          مقبول
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" size="sm" className="gap-2 text-primary hover:text-primary hover:bg-primary/10" onClick={() => toast({ title: "معلومات", description: "عرض تفاصيل الطلب والمرفقات" })}>
                          <FileText className="w-4 h-4" />
                          عرض
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredAdjustments?.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                        لا يوجد سجلات حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function AddAdjustmentDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createAdjustment = useCreateAdjustment();
  const { data: employees } = useEmployees();
  const sectors = useMemo(() => Array.from(new Set(employees?.map(emp => emp.sector).filter(Boolean) || [])), [employees]);
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  
  const form = useForm({
    resolver: zodResolver(insertAdjustmentSchema),
    defaultValues: {
      employeeCode: "",
      type: "اذن صباحي",
      date: "",
      fromTime: "",
      toTime: "",
      source: "manual",
      note: "",
    }
  });
  const departments = useMemo(() => {
    return Array.from(
      new Set(
        employees
          ?.filter(emp => (selectedSector ? emp.sector === selectedSector : true))
          .map(emp => emp.department)
          .filter(Boolean) || []
      )
    );
  }, [employees, selectedSector]);
  const filteredEmployees = useMemo(() => {
    return employees?.filter(emp => {
      if (selectedSector && emp.sector !== selectedSector) return false;
      if (selectedDepartment && emp.department !== selectedDepartment) return false;
      return true;
    }) || [];
  }, [employees, selectedSector, selectedDepartment]);

  const parseDateInput = (value: string) => {
    if (!value) return null;
    const parsed = parse(value, "dd/MM/yyyy", new Date());
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const fallback = new Date(value);
    if (!Number.isNaN(fallback.getTime())) return fallback;
    return null;
  };

  const onSubmit = (data: any) => {
    const parsedDate = parseDateInput(data.date);
    if (!parsedDate) {
      toast({ title: "خطأ", description: "يرجى إدخال تاريخ صحيح بصيغة dd/mm/yyyy", variant: "destructive" });
      return;
    }
    const isDeductionLeave = data.type === "إجازة بالخصم" || data.type === "غياب بعذر";
    const fromTime = isDeductionLeave ? "00:00:00" : normalizeTime(data.fromTime);
    const toTime = isDeductionLeave ? "23:59:59" : normalizeTime(data.toTime);
    if (!isDeductionLeave && timeToSeconds(fromTime) >= timeToSeconds(toTime)) {
      toast({ title: "خطأ", description: "وقت البداية يجب أن يكون قبل النهاية", variant: "destructive" });
      return;
    }

    createAdjustment.mutate({
      ...data,
      date: format(parsedDate, "yyyy-MM-dd"),
      fromTime,
      toTime,
    }, {
      onSuccess: () => {
        toast({ title: "تم الحفظ", description: "تم تسجيل الطلب بنجاح" });
        setOpen(false);
        form.reset();
        setSelectedSector("");
        setSelectedDepartment("");
      },
      onError: (err: any) => {
        toast({ title: "خطأ", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          طلب جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>تسجيل طلب إجازة أو تسوية</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormItem>
              <FormLabel>القطاع</FormLabel>
              <Select
                onValueChange={(value) => {
                  setSelectedSector(value);
                  setSelectedDepartment("");
                  form.setValue("employeeCode", "");
                }}
                value={selectedSector}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القطاع" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {sectors.map(sector => (
                    <SelectItem key={sector} value={sector as string}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
            <FormItem>
              <FormLabel>الإدارة</FormLabel>
              <Select
                onValueChange={(value) => {
                  setSelectedDepartment(value);
                  form.setValue("employeeCode", "");
                }}
                value={selectedDepartment}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الإدارة" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept as string}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
            <FormField
              control={form.control}
              name="employeeCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الموظف</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الموظف" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredEmployees.map(emp => (
                        <SelectItem key={emp.code} value={emp.code}>
                          {emp.code} - {emp.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>الإدارة</FormLabel>
              <FormControl>
                <Input value={selectedDepartment || "-"} readOnly />
              </FormControl>
            </FormItem>
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نوع الطلب</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="اذن صباحي">اذن صباحي</SelectItem>
                      <SelectItem value="اذن مسائي">اذن مسائي</SelectItem>
                      <SelectItem value="إجازة نص يوم">إجازة نص يوم</SelectItem>
                      <SelectItem value="مأمورية">مأمورية</SelectItem>
                      <SelectItem value="إجازة بالخصم">إجازة بالخصم</SelectItem>
                      <SelectItem value="غياب بعذر">غياب بعذر</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>التاريخ</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="dd/mm/yyyy" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fromTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>من</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="09:00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="toTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>إلى</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="17:00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={createAdjustment.isPending}>
              {createAdjustment.isPending ? "جاري الحفظ..." : "حفظ الطلب"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const normalizeTime = (value: string) => {
  const [hours = "0", minutes = "0", seconds = "0"] = value.split(":");
  return `${String(Number(hours)).padStart(2, "0")}:${String(Number(minutes)).padStart(2, "0")}:${String(Number(seconds)).padStart(2, "0")}`;
};

const timeToSeconds = (value: string) => {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};
