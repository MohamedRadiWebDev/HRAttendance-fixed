import { useEffect, useMemo, useState, useRef } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Settings2, ShieldCheck, Download, Upload, Pencil } from "lucide-react";
import { useRules, useDeleteRule, useCreateRule, useUpdateRule, useImportRules } from "@/hooks/use-data";
import { useEmployees } from "@/hooks/use-employees";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { format, parse } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { buildEmpScope, normalizeEmpCode, parseRuleScope } from "@shared/rule-scope";
import { insertRuleSchema, RULE_TYPES, type SpecialRule } from "@shared/schema";
import * as XLSX from "xlsx";
import { useAttendanceStore } from "@/store/attendanceStore";

export default function Rules() {
  const { data: rules, isLoading } = useRules();
  const { data: employees } = useEmployees();
  const deleteRule = useDeleteRule();
  const importRules = useImportRules();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setRules = useAttendanceStore((state) => state.setRules);
  const currentRules = useAttendanceStore((state) => state.rules);
  const config = useAttendanceStore((state) => state.config);
  const setConfig = useAttendanceStore((state) => state.setConfig);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");

  const [debugEmployeeCode, setDebugEmployeeCode] = useState<string>("");
  const [debugDate, setDebugDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const debugRuleMatches = useMemo(() => {
    if (!rules || !debugEmployeeCode || !debugDate) return [] as Array<{ rule: SpecialRule; reason: string }>;
    const employee = (employees || []).find((emp) => String(emp.code) === debugEmployeeCode);
    if (!employee) return [] as Array<{ rule: SpecialRule; reason: string }>;

    return rules
      .filter((rule) => debugDate >= rule.startDate && debugDate <= rule.endDate)
      .map((rule) => {
        if (rule.scope === "all") return { rule, reason: "مطابقة: النطاق = الكل" };
        if (rule.scope.startsWith("dept:")) {
          const value = rule.scope.replace("dept:", "").trim();
          if (employee.department === value) return { rule, reason: `مطابقة: الإدارة (${value})` };
          return null;
        }
        if (rule.scope.startsWith("sector:")) {
          const value = rule.scope.replace("sector:", "").trim();
          if (employee.sector === value) return { rule, reason: `مطابقة: القطاع (${value})` };
          return null;
        }
        if (rule.scope.startsWith("emp:")) {
          const parsed = parseRuleScope(rule.scope);
          const normalizedCode = normalizeEmpCode(String(employee.code));
          if (parsed.type === "emp" && parsed.values.includes(normalizedCode)) {
            return { rule, reason: `مطابقة: كود الموظف (${normalizedCode}) ضمن النطاق` };
          }
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => (b!.rule.priority || 0) - (a!.rule.priority || 0)) as Array<{ rule: SpecialRule; reason: string }>;
  }, [rules, employees, debugEmployeeCode, debugDate]);

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه القاعدة؟")) return;
    try {
      await deleteRule.mutateAsync(id);
      toast({ title: "نجاح", description: "تم حذف القاعدة بنجاح" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const handleExport = () => {
    if (!rules) return;
    const worksheet = XLSX.utils.json_to_sheet(
      rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority ?? 0,
        scope: rule.scope,
        startDate: rule.startDate,
        endDate: rule.endDate,
        ruleType: rule.ruleType,
        shiftStart: (rule.ruleType === "custom_shift" && (rule.params as any)?.shiftStart) || "",
        shiftEnd: (rule.ruleType === "custom_shift" && (rule.params as any)?.shiftEnd) || "",
        notes: typeof (rule.params as any)?.notes === "string" ? (rule.params as any)?.notes : "",
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rules");
    XLSX.writeFile(workbook, `rules_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
      if (data.length === 0) {
        toast({ title: "تنبيه", description: "الملف فارغ", variant: "destructive" });
        return;
      }

      const invalid: string[] = [];
      const rows = data.map((row, index) => {
        const idValue = row["id"] ? Number(row["id"]) : null;
        const name = String(row["name"] || "").trim();
        const priority = Number(row["priority"] ?? 0);
        const scope = String(row["scope"] || "").trim() || "all";
        const startDate = String(row["startDate"] || "").trim();
        const endDate = String(row["endDate"] || "").trim();
        const ruleType = String(row["ruleType"] || "").trim();
        const shiftStart = String(row["shiftStart"] || "").trim();
        const shiftEnd = String(row["shiftEnd"] || "").trim();
        const notes = String(row["notes"] || "").trim();

        if (!name) invalid.push(`صف ${index + 2}: اسم القاعدة مطلوب`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) invalid.push(`صف ${index + 2}: تاريخ البداية غير صالح`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) invalid.push(`صف ${index + 2}: تاريخ النهاية غير صالح`);
        if (!RULE_TYPES.includes(ruleType as any)) invalid.push(`صف ${index + 2}: نوع القاعدة غير مدعوم`);
        const parsedScope = parseRuleScope(scope);
        if (parsedScope.type === "emp" && parsedScope.values.length === 0) {
          invalid.push(`صف ${index + 2}: نطاق الموظفين غير صالح`);
        }
        if ((scope.startsWith("dept:") || scope.startsWith("sector:")) && scope.split(":")[1]?.trim() === "") {
          invalid.push(`صف ${index + 2}: نطاق القسم/القطاع غير صالح`);
        }
        if (shiftStart && !/^\d{2}:\d{2}$/.test(shiftStart)) {
          invalid.push(`صف ${index + 2}: بداية الوردية غير صالحة`);
        }
        if (shiftEnd && !/^\d{2}:\d{2}$/.test(shiftEnd)) {
          invalid.push(`صف ${index + 2}: نهاية الوردية غير صالحة`);
        }

        return {
          id: Number.isFinite(idValue) ? idValue : undefined,
          name,
          priority: Number.isFinite(priority) ? priority : 0,
          scope,
          startDate,
          endDate,
          ruleType,
          params: {
            shiftStart: shiftStart || undefined,
            shiftEnd: shiftEnd || undefined,
            notes: notes || undefined,
          },
        } as SpecialRule;
      });

      if (invalid.length > 0) {
        toast({ title: "خطأ", description: invalid.slice(0, 3).join(" | "), variant: "destructive" });
        return;
      }

      const currentMaxId = currentRules.reduce((max, rule) => Math.max(max, rule.id || 0), 0);
      let nextId = currentMaxId + 1;
      const normalizedRows = rows.map((row) => ({
        ...row,
        id: row.id ?? nextId++,
      }));

      if (importMode === "replace") {
        setRules(normalizedRows);
      } else {
        const map = new Map(currentRules.map((rule) => [rule.id, rule]));
        normalizedRows.forEach((row) => {
          if (row.id != null && map.has(row.id)) {
            map.set(row.id, row);
          } else {
            map.set(row.id, row);
          }
        });
        setRules(Array.from(map.values()));
      }

      toast({ title: "نجاح", description: "تم استيراد القواعد بنجاح" });
    } catch (err: any) {
      toast({ title: "خطأ", description: "فشل استيراد القواعد. تأكد من صحة الملف.", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="القواعد والورديات" />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>إعدادات التسويات الافتراضية</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">مدة الإذن الافتراضية (دقائق)</label>
                  <Input
                    type="number"
                    min={30}
                    value={config.defaultPermissionMinutes}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isFinite(value)) return;
                      setConfig({ ...config, defaultPermissionMinutes: Math.max(30, value) });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">مدة نصف اليوم الافتراضية (دقائق)</label>
                  <Input
                    type="number"
                    min={60}
                    value={config.defaultHalfDayMinutes}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isFinite(value)) return;
                      setConfig({ ...config, defaultHalfDayMinutes: Math.max(60, value) });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الافتراضي عند تعذر الاستدلال</label>
                  <Select
                    value={config.defaultHalfDaySide}
                    onValueChange={(value) => {
                      setConfig({ ...config, defaultHalfDaySide: value as "صباح" | "مساء" });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="صباح">صباح</SelectItem>
                      <SelectItem value="مساء">مساء</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>


            <Card>
              <CardHeader>
                <CardTitle>لوحة فحص تطبيق القواعد</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select value={debugEmployeeCode} onValueChange={setDebugEmployeeCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر موظف" />
                    </SelectTrigger>
                    <SelectContent>
                      {(employees || []).map((employee) => (
                        <SelectItem key={employee.id} value={String(employee.code)}>
                          {employee.code} - {employee.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="date" value={debugDate} onChange={(event) => setDebugDate(event.target.value)} />
                  <div className="text-sm text-muted-foreground flex items-center">
                    تعرض القواعد المطابقة فقط حسب التاريخ + النطاق + الأولوية.
                  </div>
                </div>

                {!debugEmployeeCode ? (
                  <p className="text-sm text-muted-foreground">اختر موظفاً لعرض القواعد المطبقة.</p>
                ) : debugRuleMatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد قاعدة مطابقة لهذا الموظف في التاريخ المحدد.</p>
                ) : (
                  <div className="space-y-2">
                    {debugRuleMatches.map(({ rule, reason }) => (
                      <div key={rule.id} className="rounded-lg border border-border/60 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{rule.name}</span>
                          <Badge variant="secondary">{rule.ruleType}</Badge>
                          <Badge variant="outline">أولوية: {rule.priority || 0}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-1">{reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold font-display">إدارة القواعد الخاصة</h2>
              <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" />
                  استيراد
                </Button>
                <Select value={importMode} onValueChange={(value) => setImportMode(value as "replace" | "merge")}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace">استبدال</SelectItem>
                    <SelectItem value="merge">دمج</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleExport} className="gap-2">
                  <Download className="w-4 h-4" />
                  تصدير
                </Button>
                <AddRuleDialog />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse h-48" />
                ))
              ) : rules?.map((rule) => (
                <Card key={rule.id} className="hover-elevate transition-all duration-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-bold">{rule.name}</CardTitle>
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-primary/5">{rule.ruleType}</Badge>
                        <Badge variant="secondary">أولوية: {rule.priority}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>النطاق: {rule.scope}</p>
                        <p>الفترة: {rule.startDate} إلى {rule.endDate}</p>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <AddRuleDialog rule={rule} />
                        <Button variant="ghost" size="icon" onClick={() => toast({ title: "معلومات", description: "فحص حالة القاعدة وتطبيقها" })}>
                          <ShieldCheck className="w-4 h-4 text-primary" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function AddRuleDialog({ rule }: { rule?: SpecialRule }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const { data: employees } = useEmployees();
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  
  const sectors = Array.from(new Set(employees?.map(e => e.sector).filter(Boolean) || []));
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
  
  const form = useForm({
    resolver: zodResolver(insertRuleSchema),
    defaultValues: rule ? {
      name: rule.name,
      priority: rule.priority || 0,
      scope: rule.scope,
      startDate: format(new Date(rule.startDate), "dd/MM/yyyy"),
      endDate: format(new Date(rule.endDate), "dd/MM/yyyy"),
      ruleType: rule.ruleType,
      params: rule.params
    } : {
      name: "",
      priority: 0,
      scope: "all",
      startDate: "",
      endDate: "",
      ruleType: "custom_shift",
      params: { shiftStart: "09:00", shiftEnd: "17:00" }
    }
  });
  const params = form.watch("params") as any;

  useEffect(() => {
    if (!rule) return;
    form.reset({
      name: rule.name,
      priority: rule.priority || 0,
      scope: rule.scope,
      startDate: format(new Date(rule.startDate), "dd/MM/yyyy"),
      endDate: format(new Date(rule.endDate), "dd/MM/yyyy"),
      ruleType: rule.ruleType,
      params: rule.params,
    });
  }, [form, rule]);

  const onSubmit = (data: any) => {
    const parsedScope = parseRuleScope(data.scope);
    if (parsedScope.type === "emp") {
      if (parsedScope.values.length === 0) {
        form.setError("scope", { message: "يرجى إدخال كود موظف واحد على الأقل." });
        toast({ title: "خطأ", description: "يرجى إدخال كود موظف واحد على الأقل.", variant: "destructive" });
        return;
      }
      data.scope = buildEmpScope(parsedScope.values);
    }
    const parseDateInput = (value: string) => {
      if (!value) return null;
      const parts = value.split("/");
      if (parts.length === 3) {
        const d = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        const y = parseInt(parts[2]);
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) return date;
      }
      const fallback = new Date(value);
      if (!Number.isNaN(fallback.getTime())) return fallback;
      return null;
    };
    const startDate = parseDateInput(data.startDate);
    const endDate = parseDateInput(data.endDate);
    if (!startDate || !endDate) {
      toast({ title: "خطأ", description: "يرجى إدخال تاريخ صحيح بصيغة dd/mm/yyyy", variant: "destructive" });
      return;
    }

    const payload = {
      ...data,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    };

    if (rule) {
      updateRule.mutate({ id: rule.id, rule: payload }, {
        onSuccess: () => {
          toast({ title: "نجاح", description: "تم تحديث القاعدة بنجاح" });
          setOpen(false);
        }
      });
    } else {
      createRule.mutate(payload, {
        onSuccess: () => {
          toast({ title: "نجاح", description: "تمت إضافة القاعدة بنجاح" });
          setOpen(false);
          form.reset();
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {rule ? (
          <Button variant="ghost" size="icon" className="text-primary hover:text-primary hover:bg-primary/10">
            <Pencil className="w-4 h-4" />
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة قاعدة جديدة
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{rule ? "تعديل القاعدة" : "إضافة قاعدة جديدة"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم القاعدة</FormLabel>
                    <FormControl><Input placeholder="مثال: وردية رمضان" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ruleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع القاعدة</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="custom_shift">وردية مخصصة</SelectItem>
                        <SelectItem value="attendance_exempt">إعفاء من البصمة</SelectItem>
                        <SelectItem value="overtime_overnight">وردية ليلية</SelectItem>
                        <SelectItem value="overnight_stay">مبيت</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
              render={({ field }) => (
                  <FormItem>
                    <FormLabel>من تاريخ</FormLabel>
                    <FormControl><Input type="text" placeholder="dd/mm/yyyy" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>إلى تاريخ</FormLabel>
                    <FormControl><Input type="text" placeholder="dd/mm/yyyy" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => {
                const parsedScope = parseRuleScope(field.value);
                const scopeType = parsedScope.type;
                const empValues = parsedScope.type === "emp" ? parsedScope.values : [];
                
                return (
                  <FormItem>
                    <FormLabel>النطاق</FormLabel>
                    <Select 
                      onValueChange={(val) => {
                        if (val === 'all') field.onChange('all');
                        else if (val === 'sector') field.onChange('sector:');
                        else if (val === 'dept') field.onChange('dept:');
                        else field.onChange('emp:');
                      }}
                      value={scopeType}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="sector">قطاع محدد</SelectItem>
                        <SelectItem value="dept">إدارة محددة</SelectItem>
                        <SelectItem value="emp">أكواد موظفين</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {scopeType === 'sector' && (
                      <div className="mt-2">
                        <Select onValueChange={(val) => field.onChange(`sector:${val}`)} value={field.value.split(':')[1] || ""}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="اختر القطاع" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sectors.map(s => (
                              <SelectItem key={s} value={s as string}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {scopeType === 'dept' && (
                      <div className="mt-2">
                        <Select onValueChange={(val) => field.onChange(`dept:${val}`)} value={field.value.split(':')[1] || ""}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="اختر الإدارة" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.map(d => (
                              <SelectItem key={d} value={d as string}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {scopeType === 'emp' && (
                      <div className="mt-2">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <Select
                            onValueChange={(val) => {
                              setSelectedSector(val);
                              setSelectedDepartment("");
                            }}
                            value={selectedSector}
                          >
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="اختر القطاع" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {sectors.map(s => (
                                <SelectItem key={s} value={s as string}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            onValueChange={(val) => setSelectedDepartment(val)}
                            value={selectedDepartment}
                          >
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="اختر الإدارة" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map(d => (
                                <SelectItem key={d} value={d as string}>{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Select
                          onValueChange={(val) => {
                            if (!empValues.includes(val)) {
                              field.onChange(buildEmpScope([...empValues, val]));
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="اختر الموظف لإضافته" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredEmployees.map(emp => (
                              <SelectItem key={emp.code} value={emp.code}>
                                {emp.code} - {emp.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input 
                          placeholder="اكتب الأكواد: 101,102" 
                          value={empValues.join(",")}
                          onChange={(e) => {
                            const values = e.target.value.split(",").map((value) => value.trim()).filter(Boolean);
                            field.onChange(buildEmpScope(values));
                          }}
                        />
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {form.watch("ruleType") === "custom_shift" && (
              <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50">
                <div className="space-y-2">
                  <label className="text-xs font-bold">بداية الوردية</label>
                  <Input
                    type="time"
                    value={params?.shiftStart ?? "09:00"}
                    onChange={(e) => {
                      const current = form.getValues("params") as any;
                      form.setValue("params", { ...current, shiftStart: e.target.value });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold">نهاية الوردية</label>
                  <Input
                    type="time"
                    value={params?.shiftEnd ?? "17:00"}
                    onChange={(e) => {
                      const current = form.getValues("params") as any;
                      form.setValue("params", { ...current, shiftEnd: e.target.value });
                    }}
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={createRule.isPending || updateRule.isPending}>
              {createRule.isPending || updateRule.isPending ? "جاري الحفظ..." : "حفظ القاعدة"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
