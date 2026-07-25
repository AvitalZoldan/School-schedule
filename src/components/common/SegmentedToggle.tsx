interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  disabled?: boolean
}

// מתג דו/רב-אפשרויות גנרי (למשל יום/שבוע) — משמש גם בדאשבורד (בחירת טווח) וגם
// במסך ניהול (קביעת ברירת המחדל), כדי לא לשכפל את אותה טבלת סגנון פעמיים.
export function SegmentedToggle<T extends string>({ value, onChange, options, disabled }: Props<T>) {
  return (
    <div className="flex w-fit rounded-lg border border-line bg-white p-0.5 text-[12.5px]">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 ${
            value === opt.value ? 'bg-accent text-white' : 'text-ink-soft'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
