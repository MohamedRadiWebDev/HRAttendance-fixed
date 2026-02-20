import { User } from "lucide-react";

export function Header({ title }: { title: string }) {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-border/50 h-16 flex items-center justify-between px-8 sticky top-0 z-10">
      <h2 className="text-xl font-bold font-display text-foreground">{title}</h2>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 border-r border-border/50 pr-4 mr-1">
          <div className="text-left hidden sm:block">
            <p className="text-sm font-semibold">مدير النظام</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>
    </header>
  );
}
