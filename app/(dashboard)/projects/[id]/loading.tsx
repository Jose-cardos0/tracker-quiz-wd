// Skeleton mostrado instantaneamente ao abrir um funil, enquanto as
// consultas do dashboard carregam (Suspense automático do App Router).
export default function LoadingProject() {
  return (
    <div className="animate-pulse">
      {/* header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="h-3 w-16 bg-slate-100 rounded" />
          <div className="h-7 w-56 bg-slate-200 rounded mt-2" />
          <div className="h-3 w-64 bg-slate-100 rounded mt-2" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-slate-100 rounded-lg" />
          <div className="h-9 w-24 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* range tabs */}
      <div className="h-9 w-80 bg-slate-100 rounded-xl mb-6" />

      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card card-pad">
            <div className="w-9 h-9 rounded-xl bg-slate-100 mb-3" />
            <div className="h-7 w-16 bg-slate-200 rounded" />
            <div className="h-2.5 w-20 bg-slate-100 rounded mt-2" />
          </div>
        ))}
      </div>

      {/* chart */}
      <div className="card card-pad mb-6">
        <div className="h-4 w-48 bg-slate-200 rounded" />
        <div className="h-3 w-64 bg-slate-100 rounded mt-2 mb-4" />
        <div className="h-[260px] bg-slate-100 rounded-xl" />
      </div>

      {/* report */}
      <div className="card card-pad mb-6">
        <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 rounded-lg bg-slate-100 shrink-0" />
            <div className="h-3 bg-slate-100 rounded flex-1" style={{ maxWidth: `${70 - i * 8}%` }} />
          </div>
        ))}
      </div>

      {/* collapsibles */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card px-6 py-4 mb-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100" />
          <div className="flex-1">
            <div className="h-3.5 w-40 bg-slate-200 rounded" />
            <div className="h-2.5 w-56 bg-slate-100 rounded mt-2" />
          </div>
          <div className="w-5 h-5 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
