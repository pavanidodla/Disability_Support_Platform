import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Accessibility,
  Eye,
  FileText,
  Hand,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Settings,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/object-detection", icon: Eye, label: "Object Detection" },
  { to: "/read-aloud", icon: FileText, label: "Read Aloud" },
  { to: "/sign-language", icon: Hand, label: "Sign Language" },
  { to: "/voice-commands", icon: Mic, label: "Voice Commands" },
  { to: "/history", icon: History, label: "History" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function SidebarContent({ onNavClick }) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    onNavClick?.();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Accessibility className="size-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">{t("Disability Support Platform")}</span>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="flex flex-col gap-0.5" role="navigation" aria-label={t("Main navigation")}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavClick}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
              aria-label={t(item.label)}
            >
              <item.icon className="size-4 shrink-0" aria-hidden="true" />
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-3">
        <LanguageSwitcher className="mb-2" />
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={handleSignOut}
          aria-label={t("Sign out")}
        >
          <LogOut className="size-4" aria-hidden="true" />{t("Sign out")}</Button>
      </div>
    </div>
  );
}

export function AppLayout({ children }) {
  const { t } = useI18n();
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block" role="complementary" aria-label={t("Sidebar")}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-3 top-3 z-50 bg-card shadow-md"
              aria-label={t("Open navigation menu")}
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0" aria-label={t("Navigation")}>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" role="main">
        {children}
      </main>
    </div>
  );
}
