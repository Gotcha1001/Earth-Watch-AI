// components/AppSidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  MapPinned,
  BellRing,
  Globe2,
  PlusCircle,
} from "lucide-react";
import { useGlobalBriefing } from "@/hooks/useGlobalBriefing";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Live Map", url: "/dashboard/map", icon: Globe2 },
  { title: "My Regions", url: "/dashboard/regions", icon: MapPinned },
  { title: "Add Region", url: "/dashboard/regions/new", icon: PlusCircle },
  { title: "Alerts", url: "/dashboard/alerts", icon: BellRing },
];

export function AppSidebar(): React.JSX.Element {
  const pathname = usePathname();
  const { briefing } = useGlobalBriefing();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>EarthWatch AI</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.url;
                const Icon = item.icon;
                const showNotifyBadge =
                  item.url === "/dashboard" && briefing?.notifyRecommended;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        href={item.url}
                        className="relative flex items-center gap-2"
                      >
                        <span className="relative">
                          <Icon className="h-4 w-4" />
                          {showNotifyBadge && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                          )}
                        </span>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
