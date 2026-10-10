import { Link, useLocation } from "react-router-dom";

const TABS = [
  { path: "/dashboard", emoji: "🏠", label: "Home" },
  { path: "/care-plan", emoji: "✅", label: "Task" },
  { path: "/search", emoji: "🔍", label: "Search" },
  { path: "/alerts", emoji: "🔔", label: "Alert" },
  { path: "/profile", emoji: "👤", label: "Profile" },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md border-t border-gray-200 bg-white shadow-lg">
      <div className="flex justify-around py-2">
        {TABS.map((tab) => {
          const active = pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 text-xs ${
                active ? "text-blue-600 font-semibold" : "text-gray-500"
              }`}
            >
              <span className="text-lg">{tab.emoji}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
