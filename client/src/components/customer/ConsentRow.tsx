import { CheckIcon } from "lucide-react";

type ConsentRowProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  describedBy?: string;
  testId?: string;
};

/**
 * Whole 44px row is the <label>; 24px box; never pre-ticked (caller defaults to false).
 * A native checkbox (visually restyled) keeps the landing bundle free of Radix.
 */
export function ConsentRow({ id, label, checked, onCheckedChange, describedBy, testId }: ConsentRowProps) {
  return (
    <label htmlFor={id} className="flex min-h-[82px] cursor-pointer items-start gap-3 rounded-xl py-2">
      <span className="relative mt-0.5 flex size-6 shrink-0">
        <input
          id={id}
          type="checkbox"
          data-testid={testId}
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          aria-describedby={describedBy}
          className="peer size-6 cursor-pointer appearance-none rounded-md border-2 border-ink-muted bg-surface checked:border-brand checked:bg-brand"
        />
        <CheckIcon
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto size-4 text-brand-fg opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      <span className="text-base leading-snug text-ink">{label}</span>
    </label>
  );
}
