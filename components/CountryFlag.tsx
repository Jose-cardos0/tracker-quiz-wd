// Renderiza a bandeira do país a partir do código ISO de 2 letras.
// Usa flag-icons (SVG) — funciona em todo SO, inclusive Windows (que não
// renderiza emoji de bandeira).

export default function CountryFlag({
  code,
  showCode = true,
}: {
  code: string | null | undefined;
  showCode?: boolean;
}) {
  const cc = code && code.length === 2 ? code.toLowerCase() : null;
  if (!cc) {
    return <span className="text-slate-400">🌐</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`fi fi-${cc} rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,.05)]`}
        style={{ width: 20, height: 14 }}
        title={code!.toUpperCase()}
      />
      {showCode && (
        <span className="text-xs text-slate-500 font-medium">
          {code!.toUpperCase()}
        </span>
      )}
    </span>
  );
}
