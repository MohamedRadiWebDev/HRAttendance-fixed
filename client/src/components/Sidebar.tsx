import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  Grid2x2,
  Settings, 
  Upload, 
  Briefcase,
  ClipboardList,
  Archive,
  Sparkles,
  Bug
} from "lucide-react";

const navigation = [
  { name: 'لوحة التحكم', href: '/', icon: LayoutDashboard },
  { name: 'الموظفين', href: '/employees', icon: Users },
  { name: 'الحضور والانصراف', href: '/attendance', icon: CalendarCheck },
  { name: 'خريطة الحضور', href: '/attendance-heatmap', icon: Grid2x2 },
  { name: 'التسويات والإجازات', href: '/adjustments', icon: Briefcase },
  { name: 'إدارة الإجازات', href: '/leaves', icon: ClipboardList },
  { name: 'إدارة المؤثرات', href: '/effects', icon: Sparkles },
  { name: 'القواعد والورديات', href: '/rules', icon: Settings },
  { name: 'استيراد بيانات', href: '/import', icon: Upload },
  { name: 'النسخ الاحتياطي', href: '/backup', icon: Archive },
  { name: 'التشخيص', href: '/diagnostics', icon: Bug },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-l border-sidebar-border/60 shadow-sm w-72">
      <div className="p-6 border-b border-sidebar-border/60">
        <h1 className="text-2xl font-display font-bold text-primary flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-primary" />
          </div>
          نظام الموارد البشرية
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer group font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                {item.name}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border/60">
        <div className="bg-sidebar-accent/60 rounded-xl p-4 border border-sidebar-border/60">
          <p className="text-xs text-muted-foreground text-center">الإصدار 1.0.0 &copy; 2024</p>
        </div>
      </div>
    </div>
  );
}
