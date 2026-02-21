import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEmployees } from "@/hooks/use-employees";
import { Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const [, setLocation] = useLocation();
  const { data: employees } = useEmployees();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const list = (employees || []) as any[];
    return list
      .filter((e) => {
        const code = String(e.code || "").toLowerCase();
        const name = String(e.nameAr || "").toLowerCase();
        const dept = String(e.section || e.department || "").toLowerCase();
        return code.includes(query) || name.includes(query) || dept.includes(query);
      })
      .slice(0, 20);
  }, [employees, q]);

  const goProfile = (code: string) => {
    onOpenChange(false);
    setLocation(`/employees/${encodeURIComponent(code)}`);
  };

  const goReport = (code: string) => {
    onOpenChange(false);
    setLocation(`/attendance?employee=${encodeURIComponent(code)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            بحث الموظفين
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="اكتب الكود أو الاسم أو القسم…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {q.trim() && results.length === 0 ? (
            <div className="text-sm text-muted-foreground">لا توجد نتائج.</div>
          ) : null}

          <div className="max-h-80 overflow-y-auto rounded-md border">
            {results.map((e) => (
              <div key={e.code} className="flex items-center justify-between gap-3 p-3 border-b last:border-b-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <UserRound className="w-4 h-4 text-muted-foreground" />
                    <div className="font-semibold truncate">{e.nameAr}</div>
                    <div className="text-xs text-muted-foreground">({e.code})</div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{e.section || e.department || "-"}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => goProfile(String(e.code))}>
                    الملف
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => goReport(String(e.code))}>
                    التقرير
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">اختصار: Ctrl + K</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
