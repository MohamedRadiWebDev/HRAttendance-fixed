import { Moon, Search, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";

export function Header({ title }: { title: string }) {
  const setSearchOpen = useUiStore((s) => s.setGlobalSearchOpen);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const openSearch = () => setSearchOpen(true);
  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  return (
    <header className="bg-background/80 backdrop-blur-sm border-b border-border/50 h-16 flex items-center justify-between px-6 md:px-8 sticky top-0 z-20">
      <h2 className="text-xl font-bold font-display text-foreground">{title}</h2>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openSearch} className="gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">بحث</span>
          </Button>
          <Button variant="outline" size="sm" onClick={cycleTheme} title="تغيير الثيم">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
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
