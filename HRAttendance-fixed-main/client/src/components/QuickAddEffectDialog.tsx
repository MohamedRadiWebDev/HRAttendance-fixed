import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useEffectsStore } from "@/store/effectsStore";
import { EFFECT_TYPE_OPTIONS } from "@/effects/effectsImport";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeCode: string;
  employeeName?: string;
  defaultDate: string; // YYYY-MM-DD
};

const needsTimeRange = (type: string) => type === "مأمورية" || type === "اذن صباحي" || type === "اذن مسائي";

export function QuickAddEffectDialog({ open, onOpenChange, employeeCode, employeeName, defaultDate }: Props) {
  const { toast } = useToast();
  const upsertEffects = useEffectsStore((s) => s.upsertEffects);

  const [type, setType] = useState<string>("مأمورية");
  const [fromTime, setFromTime] = useState<string>("09:00");
  const [toTime, setToTime] = useState<string>("13:00");
  const [note, setNote] = useState<string>("");

  const isOpen = open && !!employeeCode && !!defaultDate;

  useEffect(() => {
    if (!isOpen) return;
    setType("مأمورية");
    setFromTime("09:00");
    setToTime("13:00");
    setNote("");
  }, [isOpen]);

  const title = useMemo(() => {
    const namePart = employeeName ? ` ${employeeName}` : "";
    return `إضافة مؤثر للموظف${namePart} (${employeeCode})`;
  }, [employeeCode, employeeName]);

  const submit = () => {
    if (!employeeCode || !defaultDate) return;

    const trimmedType = String(type || "").trim();
    if (!trimmedType) {
      toast({ title: "تعذر الإضافة", description: "اختر نوع المؤثر.", variant: "destructive" });
      return;
    }

    if (needsTimeRange(trimmedType) && (!fromTime.trim() || !toTime.trim())) {
      toast({ title: "تعذر الإضافة", description: "هذا المؤثر يتطلب من/إلى.", variant: "destructive" });
      return;
    }

    const stats = upsertEffects([
      {
        employeeCode,
        employeeName,
        date: defaultDate,
        type: trimmedType,
        fromTime: needsTimeRange(trimmedType) ? fromTime.trim() : undefined,
        toTime: needsTimeRange(trimmedType) ? toTime.trim() : undefined,
        status: "موافق",
        note: note.trim() || undefined,
        source: "manual",
      },
    ]);

    toast({
      title: "تمت الإضافة",
      description: `تم حفظ المؤثر (جديد: ${stats.inserted}، تحديث: ${stats.updated}).`,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <div className="text-sm text-muted-foreground">نوع المؤثر</div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                {EFFECT_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsTimeRange(type) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <div className="text-sm text-muted-foreground">من</div>
                <Input value={fromTime} onChange={(e) => setFromTime(e.target.value)} placeholder="09:00" />
              </div>
              <div className="grid gap-2">
                <div className="text-sm text-muted-foreground">إلى</div>
                <Input value={toTime} onChange={(e) => setToTime(e.target.value)} placeholder="13:00" />
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <div className="text-sm text-muted-foreground">ملاحظة</div>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
