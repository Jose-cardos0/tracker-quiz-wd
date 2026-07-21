import "flag-icons/css/flag-icons.min.css";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import AutoRefresh from "@/components/AutoRefresh";
import UpdatesModal from "@/components/UpdatesModal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <AutoRefresh />
      <UpdatesModal />
      <Header />
      <Sidebar />
      <main className="lg:pl-60">
        <div className="max-w-6xl mx-auto px-5 py-8">{children}</div>
      </main>
    </div>
  );
}
