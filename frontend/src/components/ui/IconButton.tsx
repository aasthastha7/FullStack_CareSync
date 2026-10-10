import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IconButtonProps
  extends Omit<ButtonProps, "children" | "asChild"> {
  label: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, className, variant, size = "lg", ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn("group w-full", className)}
        {...props}
      >
        {label}
        <ArrowRight
          className="-me-1 ms-2 opacity-60 transition-transform group-hover:translate-x-0.5"
          size={16}
          strokeWidth={2}
          aria-hidden="true"
        />
      </Button>
    );
  },
);
IconButton.displayName = "IconButton";

export { IconButton };
export default IconButton;
