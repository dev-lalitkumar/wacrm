import {
  Inbox,
  KanbanSquare,
  Megaphone,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "../logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { icon: LucideIcon; label: string }[] = [
  { icon: Inbox, label: "Inbox" },
  { icon: KanbanSquare, label: "Pipeline" },
  { icon: Megaphone, label: "Broadcasts" },
  { icon: Users, label: "Contacts" },
  { icon: BarChart3, label: "Reports" },
];

export function MockupNavRail({
  activeIndex = 0,
}: {
  activeIndex?: number;
}) {
  return (
    <div className="hidden w-14 flex-col items-center gap-1 border-r border-white/5 bg-white/[0.02] py-4 sm:flex">
      <LogoMark size={30} className="mb-3" />
      {NAV_ITEMS.map(({ icon: Icon }, i) => (
        <span
          key={i}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            i === activeIndex
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
      ))}
    </div>
  );
}
