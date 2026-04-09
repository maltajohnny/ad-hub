import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { fetchInstagramSearchSuggestions } from "@/lib/instagramSearch";
import { cn } from "@/lib/utils";

const IG_HANDLE = /^[a-zA-Z0-9._]{1,30}$/;

type SuggestionRow = {
  username: string;
  full_name: string;
  profile_pic_url: string | null;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
};

function filterByQuery(rows: SuggestionRow[], query: string): SuggestionRow[] {
  const ql = query.toLowerCase();
  if (!ql) return rows;
  return rows.filter((r) => r.username.toLowerCase().startsWith(ql));
}

/** Lista exibida: última resposta da API + afunilamento imediato por prefixo (estilo Instagram / Social Blade). */
function useFunnelRemote(
  q: string,
  open: boolean,
): {
  displayRemote: SuggestionRow[];
  fetchedRemote: SuggestionRow[];
  fetchedForQ: string;
  loading: boolean;
} {
  const [fetchedRemote, setFetchedRemote] = useState<SuggestionRow[]>([]);
  const [fetchedForQ, setFetchedForQ] = useState("");
  const [loading, setLoading] = useState(false);
  const fetchGen = useRef(0);

  useEffect(() => {
    if (!open || q.length < 1) {
      fetchGen.current += 1;
      setFetchedRemote([]);
      setFetchedForQ("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const myGen = ++fetchGen.current;

    const timer = window.setTimeout(() => {
      if (cancelled || myGen !== fetchGen.current) return;
      setLoading(true);
      void fetchInstagramSearchSuggestions(q)
        .then((rows) => {
          if (cancelled || myGen !== fetchGen.current) return;
          setFetchedRemote(
            rows.map((r) => ({
              username: r.username,
              full_name: r.full_name,
              profile_pic_url: r.profile_pic_url,
            })),
          );
          setFetchedForQ(q);
        })
        .finally(() => {
          if (cancelled || myGen !== fetchGen.current) return;
          setLoading(false);
        });
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, open]);

  const displayRemote = useMemo(() => {
    if (q.length < 1) return [];
    if (!fetchedRemote.length || !fetchedForQ) return [];
    if (fetchedForQ === q) return fetchedRemote;
    if (q.startsWith(fetchedForQ) || fetchedForQ.startsWith(q)) {
      return filterByQuery(fetchedRemote, q);
    }
    return [];
  }, [q, fetchedRemote, fetchedForQ]);

  return { displayRemote, fetchedForQ, loading };
}

export function InstagramProfileInput({ value, onChange, id, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const q = value.trim().replace(/^@+/, "");
  const manualOk = q.length >= 1 && IG_HANDLE.test(q);

  const { displayRemote, loading } = useFunnelRemote(q, open);

  const close = () => setOpen(false);

  /** Linha «A pesquisar» só quando ainda não há resultados da rede para afunilar. */
  const showLoadingLine = loading && displayRemote.length === 0;
  const showList =
    open && q.length >= 1 && (showLoadingLine || displayRemote.length > 0 || manualOk);

  const pickUsername = (username: string) => {
    onChange(username);
    close();
  };

  const pickRow = (row: SuggestionRow) => pickUsername(row.username);

  const confirmCurrentQuery = () => {
    if (!manualOk) return;
    pickUsername(q);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => close(), 200);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (displayRemote.length > 0) pickRow(displayRemote[0]!);
            else confirmCurrentQuery();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
      />
      {showList ? (
        <div
          className="absolute z-[200] mt-1 w-full overflow-hidden rounded-md border border-border/60 bg-popover text-popover-foreground shadow-md"
          role="listbox"
        >
          <div className="max-h-56 overflow-auto">
            {displayRemote.length > 0 ? (
              <div className="border-b border-border/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Resultados
              </div>
            ) : null}
            {showLoadingLine ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">A pesquisar…</div>
            ) : null}
            {displayRemote.map((s) => (
              <button
                key={s.username}
                type="button"
                role="option"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickRow(s)}
              >
                {s.profile_pic_url ? (
                  <img
                    src={s.profile_pic_url}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                    @
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium truncate">@{s.username}</span>
                  {s.full_name ? (
                    <span className="block text-xs text-muted-foreground truncate">{s.full_name}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
          {manualOk ? (
            <button
              type="button"
              className="w-full border-t border-border/50 bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/60"
              onMouseDown={(e) => e.preventDefault()}
              onClick={confirmCurrentQuery}
            >
              Usar <span className="font-medium text-foreground">@{q}</span> — Enter
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
