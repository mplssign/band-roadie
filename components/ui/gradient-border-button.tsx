import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Button> & {
  gradientClass?: string;
  asChild?: boolean;
  wrapperClassName?: string;
};

export function GradientBorderButton({
  className,
  gradientClass = "bg-gradient-to-r from-[#F43F5E] to-[#9333EA]",
  wrapperClassName,
  children,
  ...props
}: Props) {
  return (
    <div className={cn("relative rounded-2xl p-[3px]", gradientClass, wrapperClassName)}>
      {/* Inner button */}
      <Button
        {...props}
        className={cn(
          "relative w-full rounded-[14px] bg-zinc-900 text-white border-0",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          "hover:bg-zinc-800 transition-colors",
          className
        )}
      >
        {children}
      </Button>
    </div>
  );
}

export default GradientBorderButton;
