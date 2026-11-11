import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const MARKS = {
  sm: "h-7 w-7 rounded-[9px]",
  md: "h-10 w-10 rounded-xl",
  lg: "h-16 w-16 rounded-[20px]",
};

const LABELS = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-[34px] leading-none",
};

export default function Brand({ size = "md", showWord = true, className }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid shrink-0 place-items-center bg-brand text-white",
          MARKS[size] || MARKS.md
        )}
      >
        <Check className="h-1/2 w-1/2" strokeWidth={3.5} aria-hidden="true" />
      </span>
      {showWord && (
        <span
          className={cn(
            "font-heading font-semibold leading-none text-foreground",
            LABELS[size] || LABELS.md
          )}
        >
          Pedix
        </span>
      )}
    </div>
  );
}