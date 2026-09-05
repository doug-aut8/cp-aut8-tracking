
import * as React from "react"
import { format, isSameDay } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DateRangePreset {
  label: string
  range: DateRange | undefined
}

interface DateRangePickerProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  className?: string
  buttonClassName?: string
  presets?: DateRangePreset[]
  activePresetLabel?: string
}

function rangeEquals(a: DateRange | undefined, b: DateRange | undefined): boolean {
  if (!a || !b) return false
  const fromEq = a.from && b.from ? isSameDay(a.from, b.from) : a.from === b.from
  const toEq = a.to && b.to ? isSameDay(a.to, b.to) : a.to === b.to
  return fromEq && toEq
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
  buttonClassName,
  presets,
  activePresetLabel,
}: DateRangePickerProps) {
  const hasPresets = presets && presets.length > 0

  const buttonText = React.useMemo(() => {
    if (activePresetLabel) return activePresetLabel
    if (dateRange?.from) {
      if (dateRange.to) {
        return `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
      }
      return format(dateRange.from, "dd/MM/yyyy")
    }
    return hasPresets ? "Personalizado" : "Selecionar intervalo de datas"
  }, [activePresetLabel, dateRange, hasPresets])

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !dateRange && !activePresetLabel && "text-muted-foreground",
              buttonClassName
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{buttonText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {hasPresets && (
            <div className="flex items-center gap-1 border-b p-2 flex-wrap">
              {presets.map((preset) => {
                const isActive = activePresetLabel
                  ? preset.label === activePresetLabel
                  : rangeEquals(dateRange, preset.range)
                return (
                  <Button
                    key={preset.label}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onDateRangeChange(preset.range)}
                    className="h-8 text-xs"
                  >
                    {preset.label}
                  </Button>
                )
              })}
            </div>
          )}
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
