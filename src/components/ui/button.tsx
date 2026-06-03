import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "button relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[14px] font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 overflow-hidden",
  {
    variants: {
      variant: {
        default: "button-primary",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:brightness-110",
        outline:
          "border border-[var(--border-muted)] bg-white text-foreground shadow-[0_1px_0_0_var(--black-alpha-4)] hover:bg-[var(--background-lighter)]",
        secondary:
          "bg-[var(--background-lighter)] text-foreground border border-[var(--border-muted)] hover:bg-white",
        ghost: "text-foreground hover:bg-[var(--black-alpha-4)]",
        link: "text-[var(--heat-100)] underline-offset-4 hover:underline px-0 h-auto",
        heat: "button-primary",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md px-3 text-[13px]",
        lg: "h-12 rounded-md px-7 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
