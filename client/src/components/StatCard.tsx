import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  color?: "blue" | "green" | "red" | "orange";
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, className, color = "blue" }: StatCardProps) {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
    orange: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  };

  return (
    <div className={cn(
      "bg-card rounded-2xl p-6 border border-border/50 shadow-sm hover:shadow-md transition-all duration-300",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h3 className="text-3xl font-bold font-display text-foreground">{value}</h3>
        </div>
        <div className={cn("p-3 rounded-xl", colorStyles[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            trendUp
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
          )}>
            {trend}
          </span>
          <span className="text-xs text-muted-foreground">مقارنة بالشهر الماضي</span>
        </div>
      )}
    </div>
  );
}
