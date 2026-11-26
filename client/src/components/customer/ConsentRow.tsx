import { Checkbox } from "@/components/ui/checkbox";

type ConsentRowProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  describedBy?: string;
};

/** Whole row is the label; 44px min height; 24px box; unticked by default (caller). */
export function ConsentRow({
  id,
  label,
  checked,
  onCheckedChange,
  describedBy,
}: ConsentRowProps) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl py-1"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-describedby={describedBy}
        className="size-6 rounded-md"
      />
      <span className="text-base leading-snug text-ink">{label}</span>
    </label>
  );
}
