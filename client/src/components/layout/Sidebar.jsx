import { NavLink } from "react-router-dom";

const Item = ({ to, children }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `block rounded-xl px-3 py-2 text-sm ${
        isActive
          ? "bg-emerald-50 text-emerald-700"
          : "text-zinc-700 hover:bg-zinc-100"
      }`
    }
  >
    {children}
  </NavLink>
);

export default function Sidebar() {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="mb-2 px-2 text-xs font-semibold text-zinc-500">
        Painel
      </div>
      <div className="space-y-1">
        <Item to="/">Dashboard</Item>
        <Item to="/offers">Propostas</Item>
        <Item to="/offers/new">Nova proposta</Item>
        <Item to="/calendar">Agenda</Item>
      </div>

      <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">
        Link público: <span className="font-mono">/p/:token</span>
      </div>
    </div>
  );
}
