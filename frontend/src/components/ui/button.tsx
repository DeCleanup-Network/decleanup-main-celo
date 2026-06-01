import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { spawnCtaParticles } from "@/lib/ui/cta-particles"

const buttonVariants = cva(
  "relative isolate inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-brand-green/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "font-plakat tracking-normal bg-brand-green text-[#0a0a0a] border border-brand-green shadow-btn-brand hover:shadow-btn-brand-hover hover:-translate-y-px active:translate-y-0.5 active:scale-[0.985]",
        brand:
          "font-plakat tracking-normal bg-brand-green text-[#0a0a0a] border border-brand-green shadow-btn-brand hover:shadow-btn-brand-hover hover:-translate-y-px active:translate-y-0.5 active:scale-[0.985]",
        brandYellow:
          "font-plakat tracking-normal bg-brand-yellow text-[#0a0a0a] border border-brand-yellow shadow-[0_2px_8px_rgba(250,255,0,0.15)] hover:shadow-[0_0_0_4px_rgba(250,255,0,0.12),0_6px_20px_rgba(250,255,0,0.2)] hover:-translate-y-px active:translate-y-0.5",
        brandGhost:
          "font-plakat tracking-normal border border-white/10 bg-transparent text-foreground hover:border-white/30 hover:bg-white/[0.04]",
        brandMono:
          "font-mono text-xs uppercase tracking-[0.12em] font-medium border border-white/10 bg-elevated/60 text-muted-foreground hover:border-white/25 hover:text-foreground",
        destructive:
          "font-plakat tracking-normal bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "font-plakat tracking-normal border border-white/10 bg-transparent text-foreground hover:border-white/30 hover:bg-white/[0.04] hover:text-foreground",
        secondary:
          "font-plakat tracking-normal bg-elevated text-foreground border border-white/10 hover:border-white/20 hover:bg-elevated-2",
        ghost:
          "font-plakat tracking-normal border border-transparent text-foreground hover:bg-white/[0.06] hover:text-foreground",
        link: "text-brand-green underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[48px] px-5 py-2.5 has-[>svg]:px-4",
        sm: "min-h-[44px] gap-1.5 px-3.5 text-xs has-[>svg]:px-3",
        lg: "min-h-[52px] px-6 text-base has-[>svg]:px-5",
        icon: "size-[48px]",
        "icon-sm": "size-[44px]",
        "icon-lg": "size-[52px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const PARTICLE_VARIANTS = new Set(["default", "brand", "brandYellow"])

function Button({
  className,
  variant,
  size,
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const resolvedVariant = variant ?? "default"

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!asChild && PARTICLE_VARIANTS.has(resolvedVariant)) {
      spawnCtaParticles(e.currentTarget, e.clientX, e.clientY)
    }
    onClick?.(e)
  }

  return (
    <Comp
      data-slot="button"
      data-variant={resolvedVariant}
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={asChild ? onClick : handleClick}
      {...props}
    />
  )
}

export { Button, buttonVariants }
