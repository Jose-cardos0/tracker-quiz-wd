// Renderiza a bandeira do país a partir do código ISO de 2 letras.
// Usa flag-icons (SVG) — funciona em todo SO, inclusive Windows (que não
// renderiza emoji de bandeira).
import { Globe } from "lucide-react";

export default function CountryFlag({
  code,
  showCode = true,
}: {
  code: string | null | undefined;
  showCode?: boolean;
}) {
  const cc = code && code.length === 2 ? code.toLowerCase() : null;
  if (!cc) {
    return <Globe className="w-3.5 h-3.5 text-slate-300 inline" />;
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
