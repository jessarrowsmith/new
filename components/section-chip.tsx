import { cn } from "@/lib/utils";

/** Soft sage banner used for section headings, like the Notion "Breakfasts:" chips. */
export function SectionChip({
  emoji,
  children,
  className,
}: {
  emoji?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-lg font-bold",
        className,
      )}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      {children}
    </div>
  );
}
