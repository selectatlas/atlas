import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Size and radius live on the `shape` variant, not here: tailwind-merge
  // can't dedupe `rounded-4xl` against `rounded-sm` (4xl isn't in its default
  // radius scale), so a base-class value would silently beat the variant.
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Sits on top of imagery (talent card media overlays). Scrim rather
        // than a solid fill so the photo still reads underneath it.
        overlay:
          "bg-foreground/65 text-background backdrop-blur-sm [a]:hover:bg-foreground/75",
      },
      // Shape is independent of colour: `pill` is the default badge, `chip` is
      // the squarer, denser label used on dense surfaces like the talent card.
      shape: {
        pill: "h-5 rounded-4xl px-2 py-0.5 text-xs",
        chip: "rounded-sm px-2 py-1 text-2xs leading-none",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "pill",
    },
  }
)

function Badge({
  className,
  variant = "default",
  shape = "pill",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, shape }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
      shape,
    },
  })
}

export { Badge, badgeVariants }
