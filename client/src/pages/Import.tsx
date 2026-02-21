import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, FileType, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { useImportEmployees, useImportPunches } from "@/hooks/use-employees";
import { useProcessAttendance } from "@/hooks/use-attendance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parse, parseISO, isValid } from "date-fns";
import { normalizeEmployeeCode } from "@shared/employee-code";
import {
  buildEmployeesTemplate,
  buildLeavesTemplate,
  buildPermissionsTemplate,
  buildPunchesTemplate,
  buildRulesTemplate,
} from "@/exporters/templatesExporter";

const normalizeImportHeader = (key: string) =>
  key
    .replace(/[\uFEFF\u200E\u200F]/g, "")
    .replace(/["'`]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه");

const buildNormalizedRow = (row: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = {};
  Object.keys(row).forEach((key) => {
    normalized[normalizeImportHeader(key)] = row[key];
  });
  return normalized;
};



const toArabicDigitsNormalized = (value: string) => value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

const normalizeExcelLocalDate = (value: unknown): string => {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    const base = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(base.getTime() + value * 24 * 60 * 60 * 1000);
    if (!isValid(date)) return "";
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (value instanceof Date) {
    if (!isValid(value)) return "";
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = toArabicDigitsNormalized(String(value).trim()).replace(/\./g, "/");
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
};
const getImportCell = (row: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const direct = row[alias];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
      return direct;
    }
  }

  const normalizedRow = buildNormalizedRow(row);
  for (const alias of aliases) {
    const value = normalizedRow[normalizeImportHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
};

export default function Import() {
  const { toast } = useToast();
  const importEmployees = useImportEmployees();
  const importPunches = useImportPunches();
  const processAttendance = useProcessAttendance();
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("employees");
  const [isProcessing, setIsProcessing] = useState(false);

  const parsePunchDate = (rawDate: unknown) => {
    if (rawDate instanceof Date) {
      return isValid(rawDate) ? rawDate : null;
    }
    if (typeof rawDate === "number" && Number.isFinite(rawDate)) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const parsed = new Date(excelEpoch.getTime() + rawDate * 24 * 60 * 60 * 1000);
      return isValid(parsed) ? parsed : null;
    }
    if (typeof rawDate === "string") {
      const trimmed = rawDate.trim();
      const formats = [
        "dd/MM/yyyy h:mm:ss a",
        "dd/MM/yyyy hh:mm:ss a",
        "dd/MM/yyyy h:mm a",
        "dd/MM/yyyy hh:mm a",
        "dd/MM/yyyy HH:mm:ss",
        "dd/MM/yyyy HH:mm",
        "dd/MM/yyyy",
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-dd HH:mm",
        "yyyy-MM-dd",
      ];
      for (const fmt of formats) {
        const parsed = parse(trimmed, fmt, new Date());
        if (isValid(parsed)) return parsed;
      }
      const iso = parseISO(trimmed);
      if (isValid(iso)) return iso;
      const fallback = new Date(trimmed);
      return isValid(fallback) ? fallback : null;
    }
    const fallback = new Date(rawDate as any);
    return isValid(fallback) ? fallback : null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        
        if (data.length === 0) {
          toast({ title: "تنبيه", description: "الملف فارغ", variant: "destructive" });
          return;
        }
        
        setPreviewData(data);
        toast({ title: "تم قراءة الملف", description: `تم العثور على ${data.length} سجل` });
      } catch (err: any) {
        toast({ title: "خطأ في قراءة الملف", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;
    setIsProcessing(true);
    
    try {
      if (activeTab === "employees") {
        const mapped = previewData.map((row: any) => ({
          code: normalizeEmployeeCode(getImportCell(row, ['كود', 'الكود', 'Code', 'ID'])),
          nameAr: String(getImportCell(row, ['الاسم', 'Name'])),
          sector: String(getImportCell(row, ['القطاع', 'Sector'])),
          department: String(getImportCell(row, ['الادارة', 'الإدارة', 'Department'])),
          section: String(getImportCell(row, ['القسم', 'Section', 'section', 'department', 'Department'])).trim() || 'غير مسجل',
          jobTitle: String(getImportCell(row, ['الوظيفة', 'Job Title'])),
          branch: String(getImportCell(row, ['الفرع', 'Branch'])),
          governorate: String(getImportCell(row, ['المحافظة', 'Governorate'])),
          hireDate: normalizeExcelLocalDate(getImportCell(row, ['تاريخ التعيين', 'Hire Date', 'hire_date', 'hireDate', 'Start Date'])),
          terminationDate: String(getImportCell(row, ['تاريخ ترك العمل', 'Termination Date'])),
          terminationReason: String(getImportCell(row, ['سبب ترك العمل', 'Termination Reason'])),
          serviceDuration: String(getImportCell(row, ['بيان مدة الخدمة', 'Service Duration'])),
          directManager: String(getImportCell(row, ['اسم المدير المباشر', 'Direct Manager'])),
          deptManager: String(getImportCell(row, ['مدير الادارة', 'مدير الإدارة', 'Dept Manager'])),
          nationalId: String(getImportCell(row, ['الرقم القومى', 'الرقم القومي', 'National ID'])),
          birthDate: String(getImportCell(row, ['تاريخ الميلاد', 'Birth Date'])),
          address: String(getImportCell(row, ['العنوان', 'Address'])),
          birthPlace: String(getImportCell(row, ['محل الميلاد', 'Birth Place'])),
          personalPhone: String(getImportCell(row, ['التليفون الشخصى', 'التليفون الشخصي', 'Personal Phone'])),
          emergencyPhone: String(getImportCell(row, ['تليفون طوارئ', 'Emergency Phone'])),
          shiftStart: "09:00",
        })).filter(emp => emp.code && emp.nameAr);

        if (mapped.length === 0) throw new Error("لم يتم العثور على بيانات موظفين صالحة. تأكد من وجود أعمدة (كود، الاسم)");
        await importEmployees.mutateAsync(mapped);
      } else {
        const mapped = previewData.map((row: any) => {
          // Normalize row keys to handle Arabic characters and common variations
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            const normalizedKey = key.trim().replace(/\s+/g, '_');
            normalizedRow[normalizedKey] = row[key];
          });

          // Try to find employee code
          const employeeCode = normalizeEmployeeCode(
            row['كود'] || row['ID'] || row['Code'] || row['الكود'] || 
            normalizedRow['كود'] || normalizedRow['الكود'] || 
            row['id'] || row['Employee ID'] || ""
          );
          
          // Try to find date/time
          const rawDate = 
            row['التاريخ_والوقت'] || row['التاريخ والوقت'] || row['التاريخ_والوقت'] ||
            normalizedRow['التاريخ_والوقت'] || normalizedRow['التاريخ_والوقت'] ||
            row['Punch Datetime'] || row['Clock In'] || row['Date'] || 
            row['Time'] || row['date'] || row['time'] || 
            row['التاريخ'] || row['الوقت'] || row['التاريخ_والوقت'];
          
          const punchDatetime = parsePunchDate(rawDate);
          
          return {
            employeeCode,
            punchDatetime: punchDatetime ? format(punchDatetime, "yyyy-MM-dd'T'HH:mm:ss") : "",
          };
        }).filter(p => p.employeeCode && p.punchDatetime);

        if (mapped.length === 0) {
          console.error("Mapping failed. First row keys:", Object.keys(previewData[0]));
          throw new Error("لم يتم العثور على سجلات بصمة صالحة. تأكد من وجود أعمدة (كود، التاريخ_والوقت)");
        }
        await importPunches.mutateAsync(mapped);

        const punchDates = mapped
          .map(p => new Date(p.punchDatetime))
          .filter(date => !Number.isNaN(date.getTime()));

        if (punchDates.length > 0) {
          const minDate = new Date(Math.min(...punchDates.map(date => date.getTime())));
          const maxDate = new Date(Math.max(...punchDates.map(date => date.getTime())));
          const startRange = format(minDate, "yyyy-MM-dd");
          const endRange = format(maxDate, "yyyy-MM-dd");
          localStorage.setItem("attendanceStartDate", startRange);
          localStorage.setItem("attendanceEndDate", endRange);
          await processAttendance.mutateAsync({
            startDate: startRange,
            endDate: endRange,
            employeeCodes: Array.from(new Set(mapped.map((row) => row.employeeCode))),
          });
        }
      }
      
      toast({ title: "نجاح", description: "تم استيراد البيانات بنجاح" });
      setPreviewData([]);
    } catch (err: any) {
      toast({ title: "فشل الاستيراد", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="استيراد البيانات" />
        
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-8 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold font-display mb-2">رفع ملف إكسل</h3>
              <p className="text-muted-foreground mb-8">قم بسحب وإفلات الملف هنا، أو انقر للاختيار من جهازك</p>
              
              <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPreviewData([]); }} className="w-full max-w-md mx-auto mb-8">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="employees">بيانات الموظفين</TabsTrigger>
                  <TabsTrigger value="punches">سجلات البصمة</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex justify-center">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary/10 file:text-primary
                    hover:file:bg-primary/20 cursor-pointer max-w-sm mx-auto
                  "
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileDown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">قوالب جاهزة</h3>
                  <p className="text-sm text-muted-foreground">تحميل قوالب إكسل تحتوي على الأعمدة المطلوبة وأمثلة جاهزة.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="justify-between"
                  onClick={() => XLSX.writeFile(buildPunchesTemplate(), "template_punches.xlsx")}
                >
                  قالب البصمة
                  <FileDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="justify-between"
                  onClick={() => XLSX.writeFile(buildEmployeesTemplate(), "template_employees.xlsx")}
                >
                  قالب الموظفين
                  <FileDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="justify-between"
                  onClick={() => XLSX.writeFile(buildLeavesTemplate(), "template_leaves.xlsx")}
                >
                  قالب الإجازات
                  <FileDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="justify-between"
                  onClick={() => XLSX.writeFile(buildPermissionsTemplate(), "template_permissions.xlsx")}
                >
                  قالب الأذونات
                  <FileDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="justify-between"
                  onClick={() => XLSX.writeFile(buildRulesTemplate(), "template_rules.xlsx")}
                >
                  قالب القواعد
                  <FileDown className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {previewData.length > 0 && (
              <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-2">
                    <FileType className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold">معاينة البيانات ({previewData.length} سجل)</span>
                  </div>
                  <Button onClick={handleImport} disabled={isProcessing} className="gap-2">
                    {isProcessing ? "جاري الاستيراد..." : "تأكيد الاستيراد"}
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                </div>
                <div className="max-h-[400px] overflow-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        {Object.keys(previewData[0]).map((key) => (
                          <th key={key} className="px-6 py-3 font-medium text-slate-600">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {previewData.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="px-6 py-3 text-slate-600">{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.length > 10 && (
                    <div className="p-4 text-center text-muted-foreground bg-slate-50 border-t border-border/50">
                      ... والمزيد ({previewData.length - 10} سجل)
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-bold text-blue-800 mb-1">تعليمات الاستيراد</h4>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li>تأكد من مطابقة أسماء الأعمدة (ID, Name, Date, Clock In, Clock Out)</li>
                  <li>صيغة التاريخ والوقت يجب أن تكون واضحة للنظام</li>
                  <li>الملفات المدعومة هي .xlsx و .xls فقط</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
