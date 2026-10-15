import { cn } from "@/lib/utils";

export function AdBanner({ className }: { className?: string }) {
  return (
    <div className={cn("w-full bg-muted border border-border/50 rounded-xl flex flex-col items-center justify-center text-muted-foreground p-6 min-h-[120px] relative overflow-hidden group", className)}>
      <div className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-semibold opacity-50">Advertisement</div>
      <div className="flex flex-col items-center gap-2">
        <span className="font-medium text-lg">Ad Space Available</span>
        <span className="text-sm opacity-70">728 x 90</span>
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
    </div>
  );
}

export function AdSidebar({ className }: { className?: string }) {
  return (
    <div className={cn("w-full bg-muted border border-border/50 rounded-xl flex flex-col items-center justify-center text-muted-foreground p-6 min-h-[300px] relative overflow-hidden group", className)}>
      <div className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-semibold opacity-50">Advertisement</div>
      <div className="flex flex-col items-center gap-2">
        <span className="font-medium">Sponsor</span>
        <span className="text-sm opacity-70">300 x 250</span>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
    </div>
  );
}

export function AdMobile({ className }: { className?: string }) {
  return (
    <div className={cn("w-full bg-muted border border-border/50 rounded-xl flex flex-col items-center justify-center text-muted-foreground p-4 min-h-[50px] relative lg:hidden", className)}>
      <div className="absolute top-1 left-2 text-[8px] uppercase tracking-wider font-semibold opacity-50">Ad</div>
      <span className="text-xs font-medium">320 x 50</span>
    </div>
  );
}
