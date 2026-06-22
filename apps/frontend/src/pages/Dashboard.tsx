import { Link } from "react-router-dom";
import { CalculatorIcon, ClipboardDocumentListIcon, CubeIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";

const Dashboard = () => {
  const workspaceCards = [
    {
      title: "Inventory Management",
      description: "Stock levels, products, and purchase orders",
      icon: CubeIcon,
      href: "/inventory",
      accent: "from-sky-500 to-blue-600",
    },
    {
      title: "Sales Management",
      description: "Orders, invoices, and customer flow",
      icon: ShoppingCartIcon,
      href: "/sales",
      accent: "from-emerald-500 to-teal-600",
    },
    {
      title: "Finance Management",
      description: "Ledger, reports, and accounting journals",
      icon: CalculatorIcon,
      href: "/accounting",
      accent: "from-violet-500 to-indigo-600",
    },
    {
      title: "HR Management",
      description: "Attendance, leaves, and payroll overview",
      icon: ClipboardDocumentListIcon,
      href: "/attendance",
      accent: "from-rose-500 to-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Welcome</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Welcome to ERP workspace</h1>
        <p className="mt-2 text-sm text-slate-600">Select a department below to access its workspace and day-to-day operations.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {workspaceCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              to={card.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.accent}`} />
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-900">{card.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{card.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
