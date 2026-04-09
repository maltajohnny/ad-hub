import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { fetchInstagramSearchSuggestions } from "@/lib/instagramSearch";
import { cn } from "@/lib/utils";

const IG_HANDLE = /^[a-zA-Z0-9._]{1,30}$/;

type SuggestionRow = {
  username: string;
  full_name: string;
  profile_pic_url: string | null;
  manual?: boolean;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
};

export function InstagramProfileInput({ value, onChange, id, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState<SuggestionRow[]>([]);

  const q = value.trim().replace(/^@+/, "");
  const manualOk = q.length >= 1 && IG_HANDLE.test(q);

  useEffect(() => {
    if (!open || q.length < 2) {
      setRemote([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetchInstagramSearchSuggestions(q).then((rows) => {
        if (cancelled) return;
        setRemote(
          rows.map((r) => ({
            username: r.username,
            full_name: r.full_name,
            profile_pic_url: r.profile_pic_url,
          })),
        );
        setLoading(false);
      });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, open]);

  const suggestions: SuggestionRow[] = (() => {
    const lowerQ = q.toLowerCase();
    const manual: SuggestionRow[] =
      manualOk && !remote.some((r) => r.username.toLowerCase() === lowerQ)
        ? [
            {
              username: q,
              full_name: "Utilizar este utilizador",
              profile_pic_url: null,
              manual: true,
            },
          ]
        : [];
    return [...manual, ...remote];
  })();

  const close = () => setOpen(false);

  const showList = open && (loading || suggestions.length > 0);

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
          window.setTimeout(() => close(), 180);
        }}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
      />
      {showList ? (
        <ul
          className="absolute z-[200] mt-1 max-h-56 w-full overflow-auto rounded-md border border-border/60 bg-popover text-popover-foreground shadow-md"
          role="listbox"
        >
          {loading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">A pesquisar…</li>
          ) : null}
          {suggestions.map((s) => (
            <li key={s.manual ? `m:${s.username}` : s.username}>
              <button
                type="button"
                role="option"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s.username);
                  close();
                }}
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
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
