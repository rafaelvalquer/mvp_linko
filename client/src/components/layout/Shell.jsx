import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

export default function Shell({ children }) {
  return (
    <div className="min-h-screen">
      <Topbar />
      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-6 px-4 py-6">
        <div className="col-span-12 md:col-span-3">
          <Sidebar />
        </div>
        <main className="col-span-12 md:col-span-9">{children}</main>
      </div>
    </div>
  );
}
