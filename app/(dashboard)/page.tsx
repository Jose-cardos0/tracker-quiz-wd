import FunnelsList from "@/components/FunnelsList";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight">
          Seus funis
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Desempenho dos últimos 30 dias.
        </p>
      </div>

      <FunnelsList />
    </div>
  );
}
