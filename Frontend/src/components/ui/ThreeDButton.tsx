import { type ButtonHTMLAttributes } from "react";

interface ThreeDButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  label: string;
  variant?: "primary" | "secondary";
  loading?: boolean;
  className?: string;
}

export default function ThreeDButton({
  label,
  variant = "primary",
  loading = false,
  disabled,
  className,
  ...rest
}: ThreeDButtonProps) {
  const isDisabled = disabled || loading;

  const base =
    "inline-flex w-full items-center justify-center min-h-[48px] rounded-lg px-6 py-3 text-base font-semibold transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2";

  const primaryResting =
    "bg-emerald-600 text-white shadow-[0_4px_0_0_theme(colors.emerald.800)] shadow-lg";
  const primaryHover = "hover:bg-emerald-500";
  const primaryActive =
    "active:translate-y-[2px] active:shadow-[0_2px_0_0_theme(colors.emerald.800)] active:shadow-md";

  const secondaryResting =
    "bg-emerald-100 text-emerald-900 shadow-[0_4px_0_0_theme(colors.emerald.300)] shadow-md";
  const secondaryHover = "hover:bg-emerald-200";
  const secondaryActive =
    "active:translate-y-[2px] active:shadow-[0_2px_0_0_theme(colors.emerald.300)] active:shadow-sm";

  const disabledStyles = "opacity-50 cursor-not-allowed";

  const variantStyles =
    variant === "primary"
      ? `${primaryResting} ${primaryHover} ${primaryActive}`
      : `${secondaryResting} ${secondaryHover} ${secondaryActive}`;

  const classes = [
    base,
    variantStyles,
    isDisabled ? disabledStyles : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={rest.type ?? "button"}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {loading && (
        <svg
          className="mr-2 h-5 w-5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {label}
    </button>
  );
}
