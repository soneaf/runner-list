import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30",
                secondary:
                    "border-transparent bg-slate-800 text-slate-400",
                destructive:
                    "border-transparent bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]",
                outline: "text-foreground",
                success: "border-transparent bg-emerald-500/20 text-emerald-400",
                warning: "border-transparent bg-amber-500/20 text-amber-400",
                info: "border-transparent bg-blue-500/20 text-blue-400",
                purple: "border-transparent bg-purple-500/20 text-purple-400",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
