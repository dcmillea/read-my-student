export type ButtonVariant = "primary" | "secondary" | "ghost" | "amber" | "gold" | "green";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonBase = "inline-flex items-center justify-center rounded-md font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-blue-950 text-white hover:opacity-90",
  secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
  ghost: "bg-transparent hover:bg-neutral-100",
  amber:
  "bg-amber-400 text-white hover:bg-orange-600 " +
  "focus:ring-orange-500",
   gold: `
    text-[#3a2a00]
    bg-gradient-to-r from-[#f7d774] via-[#f3b72f] to-[#d99a00]
    hover:from-[#ffe08a] hover:via-[#f5c542] hover:to-[#e0a800]
    shadow-[0_6px_20px_rgba(245,197,66,0.35)]
    ring-1 ring-[#f5c542]/40
  `,
  green:
    "bg-[#0b5315] text-white hover:bg-[#146b22] ring-1 ring-[#0b5315]/40 shadow-[0_6px_20px_rgba(11,83,21,0.25)]",
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
) {
  return [
    buttonBase,
    buttonVariants[variant],
    buttonSizes[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}