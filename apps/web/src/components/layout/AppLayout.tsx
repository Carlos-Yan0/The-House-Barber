// src/components/layout/AppLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Calendar,
  Scissors,
  User,
  LayoutDashboard,
  ClipboardList,
  TrendingUp,
  Users,
  BarChart3,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  // Client
  { to: "/agendar",      icon: <Scissors size={20} />,       label: "Agendar",       roles: ["CLIENT", "ADMIN", "BARBER"] },
  { to: "/agendamentos", icon: <Calendar size={20} />,        label: "Meus horários", roles: ["CLIENT"] },
  { to: "/perfil",       icon: <User size={20} />,            label: "Perfil",        roles: ["CLIENT", "ADMIN", "BARBER"] },

  // Barber
  { to: "/barbeiro/dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard",    roles: ["BARBER"] },
  { to: "/barbeiro/agenda",    icon: <Calendar size={20} />,        label: "Minha Agenda", roles: ["BARBER"] },
  { to: "/barbeiro/comandas",  icon: <ClipboardList size={20} />,   label: "Comandas",     roles: ["BARBER"] },
  { to: "/barbeiro/ganhos",    icon: <TrendingUp size={20} />,      label: "Ganhos",       roles: ["BARBER"] },

  // Admin
  { to: "/admin/dashboard",  icon: <LayoutDashboard size={20} />, label: "Dashboard",  roles: ["ADMIN"] },
  { to: "/admin/servicos",   icon: <Scissors size={20} />,        label: "Serviços",   roles: ["ADMIN"] },
  { to: "/admin/barbeiros",  icon: <Users size={20} />,            label: "Barbeiros",  roles: ["ADMIN"] },
  { to: "/admin/relatorios", icon: <BarChart3 size={20} />,        label: "Relatórios", roles: ["ADMIN"] },
];

// Bottom nav height in px — used to calculate the scroll-buffer padding.
// Keep in sync with the nav element's h-16 (64px) + pb-safe.
const BOTTOM_NAV_HEIGHT = "4rem"; // 64px = h-16

export function AppLayout() {
  const { user, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();

  const userNav = NAV_ITEMS.filter((n) =>
    user ? n.roles.includes(user.role) : false
  );

  // Mobile bottom nav shows at most 4 items.
  const BOTTOM_NAV_BY_ROLE: Record<string, string[]> = {
    CLIENT: ["/agendar", "/agendamentos", "/perfil"],
    BARBER: ["/barbeiro/dashboard", "/barbeiro/agenda", "/barbeiro/comandas", "/barbeiro/ganhos"],
    ADMIN:  ["/admin/dashboard", "/admin/servicos", "/admin/barbeiros", "/admin/relatorios"],
  };
  
  const bottomNavPaths = user ? (BOTTOM_NAV_BY_ROLE[user.role] ?? []) : [];
  const bottomNav = userNav.filter(item => bottomNavPaths.includes(item.to));
  

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Ignore logout API errors — we still clear local state.
    }
    logout();
    navigate("/login");
    toast.success("Até logo!");
  };

  return (
    <div className="min-h-dvh bg-dark-500 flex">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 bg-dark-400 border-r border-dark-50 fixed h-full z-20">
        <div className="p-6 border-b border-dark-50">
          <Logo />
        </div>

        {/* User info */}
        <div className="px-4 py-4 border-b border-dark-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold-600/20 border border-gold-600/30 flex items-center justify-center text-gold-500 font-display font-semibold text-sm">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {user?.role === "ADMIN"
                  ? "Administrador"
                  : user?.role === "BARBER"
                  ? "Barbeiro"
                  : "Cliente"}
              </p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-1">
            {userNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                    isActive
                      ? "bg-gold-600/15 text-gold-400 border border-gold-600/20"
                      : "text-[var(--text-secondary)] hover:text-white hover:bg-dark-50/50"
                  )
                }
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-dark-50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-dvh">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-10 bg-dark-400/95 backdrop-blur-sm border-b border-dark-50 px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gold-600/20 border border-gold-600/30 flex items-center justify-center text-gold-500 font-display text-xs font-semibold">
              {user?.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content
            FIX: On mobile the sticky bottom nav (h-16 ≈ 64px) overlaps the last
            portion of the page content. We add a matching padding-bottom so the
            user can always scroll the content fully into view.
            `md:pb-0` removes the padding on desktop where there is no bottom nav. */}
        <div
          className="flex-1 overflow-auto md:pb-0"
          style={{ paddingBottom: `calc(${BOTTOM_NAV_HEIGHT} + env(safe-area-inset-bottom, 0px))` }}
        >
          {/* The inner wrapper only applies the mobile padding; desktop gets none
              via the md: override on the parent. We use an inline style so the
              safe-area env() value is respected (Tailwind can't express this). */}
          <div className="md:pb-0">
            <Outlet />
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden sticky bottom-0 z-10 bg-dark-400/95 backdrop-blur-sm border-t border-dark-50 pb-safe">
          <div className="flex h-16">
            {bottomNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-all duration-200",
                    isActive
                      ? "text-gold-400"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )
                }
              >
                {item.icon}
                <span className="leading-none">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </main>
    </div>
  );
}