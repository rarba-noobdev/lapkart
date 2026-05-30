import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 py-2 text-[14px] leading-5 text-foreground shadow-[0_1px_0_0_var(--black-alpha-3)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--black-alpha-40)] focus-visible:outline-none focus-visible:border-[var(--heat-100)] focus-visible:ring-2 focus-visible:ring-[var(--heat-20)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
