import { cn } from "@/lib/utils";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MetricsHeatmap({ rows, unit, money = false }: {
  rows: { dayOfWeek: number; hour: number; value: number }[];
  unit: string;
  money?: boolean;
}) {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  rows.forEach(({ dayOfWeek, hour, value }) => {
    if (Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek < 7 && Number.isInteger(hour) && hour >= 0 && hour < 24) {
      grid[dayOfWeek][hour] += value;
    }
  });
  const max = Math.max(1, ...grid.flat());
  const display = (value: number) => money
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : `${value.toLocaleString("pt-BR")} ${unit}`;
  const intensity = (value: number) => value === 0 ? "bg-muted" : value / max < .25 ? "bg-primary/20" : value / max < .5 ? "bg-primary/40" : value / max < .75 ? "bg-primary/70" : "bg-primary";
  return <div className="overflow-x-auto pb-2">
    <table className="w-full min-w-[720px] border-separate border-spacing-1 text-xs">
      <caption className="sr-only">{unit} por dia da semana e horário</caption>
      <thead><tr><th className="w-10" />{Array.from({ length: 24 }, (_, hour) => <th key={hour} className="font-normal text-muted-foreground">{String(hour).padStart(2, "0")}</th>)}</tr></thead>
      <tbody>{DAYS.map((day, index) => <tr key={day}>
        <th className="pr-2 text-left font-medium text-muted-foreground">{day}</th>
        {grid[index].map((value, hour) => <td key={hour} tabIndex={0}
          aria-label={`${day}, ${hour}h: ${display(value)}`}
          title={`${day}, ${hour}h: ${display(value)}`}
          className={cn("h-7 rounded-sm outline-none focus:ring-2 focus:ring-ring", intensity(value))}>
          <span className="sr-only">{display(value)}</span>
        </td>)}
      </tr>)}</tbody>
    </table>
    <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
      Menos <span className="h-3 w-4 bg-muted" /><span className="h-3 w-4 bg-primary/20" /><span className="h-3 w-4 bg-primary/40" /><span className="h-3 w-4 bg-primary/70" /><span className="h-3 w-4 bg-primary" /> Mais
    </div>
  </div>;
}