import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  UsersIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  CubeIcon,
  ShoppingCartIcon,
  CalculatorIcon,
  TruckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../contexts/AuthContext";

const Layout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes("users")) return "User Management";
    if (path.includes("departments")) return "Departments";
    if (path.includes("employees")) return "Employees";
    if (path.includes("attendance")) return "Attendance";
    if (path.includes("leaves")) return "Leave Management";
    if (path.includes("payroll")) return "Payroll";
    if (path.includes("inventory")) return "Inventory";
    if (path.includes("sales")) return "Sales";
    if (path.includes("accounting")) return "Accounting";
    if (path.includes("purchases")) return "Purchases";
    return "Dashboard";
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  const navLinkClass = (isActive: boolean) =>
    `group flex items-center rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      isActive
        ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900"
    }`;

  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: HomeIcon, adminOnly: false },
    { href: "/departments", label: "Departments", icon: BuildingOffice2Icon, adminOnly: true },
    { href: "/employees", label: "Employees", icon: UserGroupIcon, adminOnly: true },
    { href: "/attendance", label: "Attendance", icon: CalendarDaysIcon, adminOnly: false },
    { href: "/leaves", label: "Leaves", icon: ClipboardDocumentListIcon, adminOnly: false },
    { href: "/payroll", label: "Payroll", icon: CurrencyDollarIcon, adminOnly: false },
    { href: "/inventory", label: "Inventory", icon: CubeIcon, adminOnly: false },
    { href: "/sales", label: "Sales", icon: ShoppingCartIcon, adminOnly: false },
    { href: "/accounting", label: "Accounting", icon: CalculatorIcon, adminOnly: false },
    { href: "/purchases", label: "Purchases", icon: TruckIcon, adminOnly: false },
  ].filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_15%,rgba(14,165,233,0.11),transparent_35%),radial-gradient(circle_at_85%_85%,rgba(59,130,246,0.08),transparent_30%)]" />

      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-slate-50/95 text-slate-900 shadow-xl backdrop-blur transition-all duration-300 md:relative md:translate-x-0 ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          isSidebarCollapsed ? "md:w-20" : "md:w-72"
        }`}
      >
        <div className="relative border-b border-slate-200 px-3 py-2.5">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-bold text-white">
                E
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Workspace</p>
                <h1 className="text-base font-semibold leading-tight text-slate-900">ERP SaaS</h1>
              </div>
            </div>
          )}

          <div className="absolute right-2 top-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 md:hidden"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden h-8 w-8 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 md:inline-flex"
            >
              {isSidebarCollapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
          {!isSidebarCollapsed && (
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Navigation</p>
          )}
          <ul className="space-y-1.5">
            {(user?.role === "company_admin" || user?.role === "super_admin") && (
              <li>
                <NavLink
                  to="/users"
                  className={({ isActive }) => `${navLinkClass(isActive)} ${isSidebarCollapsed ? "justify-center px-0" : "gap-3"}`}
                  title="Users"
                >
                  <UsersIcon className="h-5 w-5 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">Users</span>}
                </NavLink>
              </li>
            )}

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) => `${navLinkClass(isActive)} ${isSidebarCollapsed ? "justify-center px-0" : "gap-3"}`}
                    title={item.label}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-slate-500 group-hover:text-slate-700" />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {!isSidebarCollapsed && (
          <div className="border-t border-slate-200 px-4 py-3">
            <a
              href="/help.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
              title="Open Help & User Guide"
            >
              <span>❓</span>
              <span>ERP SaaS Workspace</span>
              <span className="ml-auto text-slate-300">↗</span>
            </a>
          </div>
        )}
      </aside>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="flex items-center gap-4 px-4 py-1.5 sm:px-6">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 md:hidden"
              aria-label="Open menu"
            >
              <Bars3Icon className="h-4 w-4" />
            </button>

            {/* Page title */}
            <div className="min-w-0 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Workspace</p>
              <h2 className="truncate text-base font-semibold leading-tight text-slate-900">{getPageTitle()}</h2>
            </div>

            {/* User info — stretches to fill all remaining space */}
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-1.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {(user?.firstName?.[0] || "U").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Logged in as</p>
                <p className="truncate text-sm font-semibold text-slate-900">{user?.firstName} {user?.lastName}</p>
              </div>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{user?.email}</p>
              <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                {user?.role?.replace("_", " ")}
              </span>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
