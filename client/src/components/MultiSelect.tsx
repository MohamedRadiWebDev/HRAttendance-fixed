import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type MultiSelectOption = {
  value: string;
  label?: string;
};

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label ?? o.value]));
    return value.map((v) => map.get(v) ?? v);
  }, [options, value]);

  const toggle = (v: string) => {
    if (selectedSet.has(v)) {
      onChange(value.filter((x) => x !== v));
      return;
    }
    onChange([...value, v]);
  };

  const clear = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between gap-2 rounded-xl bg-background",
            disabled && "opacity-60 pointer-events-none",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate text-right">
            {selectedLabels.length === 0
              ? placeholder ?? "اختر..."
              : selectedLabels.length <= 2
                ? selectedLabels.join("، ")
                : `${selectedLabels[0]}، ${selectedLabels[1]} (+${selectedLabels.length - 2})`}
          </span>
          <span className="flex items-center gap-1">
            {value.length > 0 && (
              <button
                type="button"
                className="rounded-md p-1 hover:bg-muted"
                onClick={clear}
                aria-label="مسح"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-70" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="ابحث..." />
          <CommandEmpty>لا توجد نتائج</CommandEmpty>
          <CommandGroup className="max-h-72 overflow-auto">
            {options.map((opt) => {
              const checked = selectedSet.has(opt.value);
              return (
                <CommandItem
                  key={opt.value}
                  value={opt.label ?? opt.value}
                  onSelect={() => toggle(opt.value)}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate">{opt.label ?? opt.value}</span>
                  <Checkbox checked={checked} />
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
