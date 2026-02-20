import * as XLSX from "xlsx";

const addInstructionsSheet = (workbook: XLSX.WorkBook, lines: string[]) => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["شرح استخدام القالب"],
    ...lines.map((line) => [line]),
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "شرح");
};

const buildWorkbook = (name: string, headers: string[], rows: (string | number)[][], instructions: string[]) => {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
  addInstructionsSheet(workbook, instructions);
  return workbook;
};

const employeesSeed = [
  { code: "101", name: "أحمد محمود", sector: "التحصيل", department: "ادارة التحصيل", section: "قسم 1", jobTitle: "محصل", branch: "الفرع الرئيسي", governorate: "القاهرة", hireDate: "2022-01-10", shiftStart: "09:00" },
  { code: "102", name: "منى سعيد", sector: "التحصيل", department: "ادارة التحصيل", section: "قسم 2", jobTitle: "محصل", branch: "فرع مدينة نصر", governorate: "القاهرة", hireDate: "2022-03-01", shiftStart: "07:00" },
  { code: "103", name: "وليد حسام", sector: "التحصيل", department: "ادارة التحصيل", section: "قسم 3", jobTitle: "محصل أول", branch: "فرع المهندسين", governorate: "الجيزة", hireDate: "2021-08-15", shiftStart: "08:00" },
  { code: "201", name: "سارة علي", sector: "الموارد البشرية", department: "الشؤون الإدارية", section: "التعيينات", jobTitle: "أخصائي موارد", branch: "الفرع الرئيسي", governorate: "الجيزة", hireDate: "2021-06-01", shiftStart: "09:00" },
  { code: "202", name: "محمود طارق", sector: "الموارد البشرية", department: "الشؤون الإدارية", section: "الرواتب", jobTitle: "محلل رواتب", branch: "الفرع الرئيسي", governorate: "القاهرة", hireDate: "2020-11-20", shiftStart: "08:00" },
  { code: "301", name: "محمد حسن", sector: "المبيعات", department: "ادارة المبيعات", section: "التجزئة", jobTitle: "مندوب مبيعات", branch: "فرع مدينة نصر", governorate: "القاهرة", hireDate: "2020-09-15", shiftStart: "09:00" },
  { code: "302", name: "هبة يوسف", sector: "المبيعات", department: "ادارة المبيعات", section: "الجملة", jobTitle: "مشرف مبيعات", branch: "فرع اسكندرية", governorate: "الإسكندرية", hireDate: "2019-02-10", shiftStart: "08:00" },
  { code: "303", name: "عمر خالد", sector: "المبيعات", department: "ادارة المبيعات", section: "التجزئة", jobTitle: "مندوب مبيعات", branch: "فرع اسكندرية", governorate: "الإسكندرية", hireDate: "2021-04-05", shiftStart: "07:00" },
  { code: "401", name: "ليلى سعيد", sector: "المالية", department: "ادارة الحسابات", section: "المصروفات", jobTitle: "محاسب", branch: "الفرع الرئيسي", governorate: "القاهرة", hireDate: "2018-07-30", shiftStart: "09:00" },
  { code: "402", name: "علاء هاني", sector: "المالية", department: "ادارة الحسابات", section: "التحصيل الداخلي", jobTitle: "محاسب", branch: "فرع المهندسين", governorate: "الجيزة", hireDate: "2019-12-12", shiftStart: "08:00" },
  { code: "501", name: "ريم عادل", sector: "تكنولوجيا المعلومات", department: "الدعم الفني", section: "الشبكات", jobTitle: "مهندس شبكات", branch: "الفرع الرئيسي", governorate: "القاهرة", hireDate: "2020-05-18", shiftStart: "09:00" },
  { code: "502", name: "حسن إبراهيم", sector: "تكنولوجيا المعلومات", department: "الدعم الفني", section: "الدعم", jobTitle: "مسؤول دعم", branch: "فرع مدينة نصر", governorate: "القاهرة", hireDate: "2021-01-25", shiftStart: "08:00" },
  { code: "601", name: "ندى سامي", sector: "الخدمات", department: "خدمة العملاء", section: "الاتصالات", jobTitle: "ممثل خدمة", branch: "الفرع الرئيسي", governorate: "القاهرة", hireDate: "2022-09-01", shiftStart: "09:00" },
  { code: "602", name: "طارق صبري", sector: "الخدمات", department: "خدمة العملاء", section: "الشكاوى", jobTitle: "ممثل خدمة", branch: "فرع اسكندرية", governorate: "الإسكندرية", hireDate: "2021-10-10", shiftStart: "08:00" },
  { code: "603", name: "بسمة عمر", sector: "الخدمات", department: "خدمة العملاء", section: "المتابعة", jobTitle: "مشرف", branch: "فرع المهندسين", governorate: "الجيزة", hireDate: "2020-03-22", shiftStart: "07:00" },
];

const formatPunch = (date: string, time: string) => `${date} ${time}`;

export const buildPunchesTemplate = () => {
  const headers = ["كود", "التاريخ_والوقت"];
  const dates = ["01/03/2024", "02/03/2024", "03/03/2024", "04/03/2024", "05/03/2024"];
  const rows: (string | number)[][] = [];

  employeesSeed.slice(0, 10).forEach((employee, index) => {
    dates.forEach((date, dayIndex) => {
      const baseIn = index % 3 === 0 ? "08:50" : index % 3 === 1 ? "09:05" : "07:55";
      const baseOut = index % 2 === 0 ? "17:05" : "16:45";
      rows.push([employee.code, formatPunch(date, baseIn)]);
      if (!(dayIndex === 2 && index % 4 === 0)) {
        rows.push([employee.code, formatPunch(date, baseOut)]);
      }
      if (dayIndex === 1 && index % 5 === 0) {
        rows.push([employee.code, formatPunch(date, baseOut)]);
      }
    });
  });

  rows.push(["101", formatPunch("03/03/2024", "23:55")]);
  rows.push(["101", formatPunch("04/03/2024", "00:10")]);
  rows.push(["102", formatPunch("04/03/2024", "23:45")]);
  rows.push(["102", formatPunch("05/03/2024", "06:05")]);

  return buildWorkbook("بصمة", headers, rows, [
    "استخدم الصيغة: dd/MM/yyyy HH:mm أو dd/MM/yyyy HH:mm:ss",
    "تتضمن بيانات اختبارية: بصمات بعد منتصف الليل وتكرار بصمة.",
    "يوجد يوم بدون بصمة خروج لاختبار سهو البصمة.",
  ]);
};

export const buildEmployeesTemplate = () => {
  const headers = [
    "كود",
    "الاسم",
    "القطاع",
    "الادارة",
    "القسم",
    "الوظيفة",
    "الفرع",
    "المحافظة",
    "تاريخ التعيين",
    "تاريخ ترك العمل",
  ];
  const rows = employeesSeed.map((employee) => [
    employee.code,
    employee.name,
    employee.sector,
    employee.department,
    employee.section,
    employee.jobTitle,
    employee.branch,
    employee.governorate,
    employee.hireDate,
    "",
  ]);
  return buildWorkbook("الموظفين", headers, rows, [
    "يمكن إضافة أعمدة إضافية حسب الحاجة دون التأثير على الاستيراد.",
    "تاريخ التعيين بصيغة yyyy-MM-dd أو dd/MM/yyyy.",
  ]);
};

export const buildLeavesTemplate = () => {
  const headers = ["النوع", "النطاق", "القيمة", "من", "إلى", "ملاحظة"];
  const rows = [
    ["اجازة رسمية", "all", "", "2024-03-08", "2024-03-08", "إجازة يوم المرأة"],
    ["اجازات التحصيل", "sector", "التحصيل", "2024-03-15", "2024-03-16", "إجازة قطاع التحصيل"],
    ["اجازة رسمية", "branch", "فرع اسكندرية", "2024-03-22", "2024-03-22", "إجازة رسمية للفرع"],
  ];
  return buildWorkbook("الإجازات", headers, rows, [
    "النوع يدعم: اجازة رسمية، اجازات التحصيل.",
    "النطاق يدعم: all, sector, department, section, branch, emp.",
    "القيمة تكون اسم القطاع/الإدارة/الفرع حسب النطاق.",
  ]);
};

export const buildPermissionsTemplate = () => {
  const headers = ["الكود", "الاسم", "التاريخ", "من", "إلى", "النوع"];
  const rows = [
    ["101", "أحمد محمود", "2024-03-05", "09:00", "11:00", "اذن صباحي"],
    ["102", "منى سعيد", "2024-03-05", "15:00", "17:00", "اذن مسائي"],
    ["103", "وليد حسام", "2024-03-06", "", "", "إجازة نص يوم"],
    ["201", "سارة علي", "2024-03-07", "", "", "إجازة نص يوم"],
    ["301", "محمد حسن", "2024-03-08", "09:00", "13:00", "إجازة نص يوم"],
    ["302", "هبة يوسف", "2024-03-08", "", "", "اذن صباحي"],
  ];
  return buildWorkbook("الأذونات", headers, rows, [
    "النوع يدعم: اذن صباحي، اذن مسائي، إجازة نص يوم، مأمورية.",
    "استخدم الوقت بصيغة HH:mm أو HH:mm:ss.",
    "اترك من/إلى فارغين لاختبار الاستدلال الذكي.",
  ]);
};

export const buildRulesTemplate = () => {
  const headers = ["id", "name", "priority", "ruleType", "scope", "startDate", "endDate", "shiftStart", "shiftEnd", "note"];
  const rows = [
    ["1", "وردية موظف محدد", "10", "custom_shift", "emp:101", "2024-03-01", "2024-03-31", "07:00", "15:00", "وردية مبكرة لموظف واحد"],
    ["2", "وردية متعددة", "9", "custom_shift", "emp:102,103,201", "2024-03-01", "2024-03-31", "08:00", "16:00", "قائمة موظفين متعددة"],
    ["3", "وردية قطاع التحصيل", "8", "custom_shift", "sector:التحصيل", "2024-03-01", "2024-03-31", "08:00", "16:00", "تطبيق وردية على القطاع"],
    ["4", "إعفاء مؤقت", "5", "attendance_exempt", "emp:301", "2024-03-10", "2024-03-12", "", "", "إعفاء 3 أيام"],
  ];
  return buildWorkbook("القواعد", headers, rows, [
    "ruleType المتاح: custom_shift, attendance_exempt, penalty_override, ignore_biometric, overtime_overnight, overnight_stay.",
    "scope أمثلة: emp:659 أو emp:289,31,515 أو dept:ادارة التحصيل أو sector:التحصيل.",
  ]);
};
