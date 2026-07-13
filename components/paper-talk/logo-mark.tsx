import { cn } from "@/lib/utils"

function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(from_var(--primary)_calc(l*0.72)_calc(c*1.05)_calc(h+18))] shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_35%,transparent),0_6px_16px_-6px_color-mix(in_oklch,var(--primary)_70%,transparent)]",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[18px] text-primary-foreground"
        fill="none"
      >
        <path
          d="M5 4.5C5 3.67157 5.67157 3 6.5 3H14L19 8V19.5C19 20.3284 18.3284 21 17.5 21H6.5C5.67157 21 5 20.3284 5 19.5V4.5Z"
          fill="currentColor"
          fillOpacity="0.92"
        />
        <path d="M14 3V7C14 7.55228 14.4477 8 15 8H19" fill="currentColor" fillOpacity="0.55" />
        <path
          d="M8.25 12.25H14.5M8.25 15.25H12.25"
          stroke="var(--primary)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export { LogoMark }
