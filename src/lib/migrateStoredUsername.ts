type CardLite = {
  assigneeUsername?: string | null;
  discussionEntries?: Array<{ authorUsername: string }>;
};

/**
 * Atualiza favoritos e estados do Kanban em localStorage quando o login (username) muda.
 * Chaves de registo usam sempre o login normalizado em minúsculas.
 */
export function migrateStoredUsernameInLocalStorage(oldLogin: string, newLogin: string): void {
  const oldKey = oldLogin.trim().toLowerCase();
  const newKey = newLogin.trim().toLowerCase();
  if (oldKey === newKey) return;

  const favOld = `norter_favorites_${oldKey}`;
  const rawFav = localStorage.getItem(favOld);
  if (rawFav) {
    const favNew = `norter_favorites_${newKey}`;
    if (!localStorage.getItem(favNew)) {
      localStorage.setItem(favNew, rawFav);
    }
    localStorage.removeItem(favOld);
  }

  const prefix = "norter_kanban_v2_client_";
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) keys.push(k);
  }

  for (const storageKey of keys) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      const state = JSON.parse(raw) as { cards?: CardLite[] };
      if (!state?.cards?.length) continue;
      let changed = false;
      const cards = state.cards.map((c) => {
        const next: CardLite = { ...c };
        if (c.assigneeUsername != null && c.assigneeUsername.toLowerCase() === oldKey) {
          changed = true;
          next.assigneeUsername = newKey;
        }
        if (c.discussionEntries?.length) {
          next.discussionEntries = c.discussionEntries.map((e) => {
            if (e.authorUsername.toLowerCase() === oldKey) {
              changed = true;
              return { ...e, authorUsername: newKey };
            }
            return e;
          });
        }
        return next;
      });
      if (changed) {
        localStorage.setItem(storageKey, JSON.stringify({ ...state, cards }));
      }
    } catch {
      /* ignore */
    }
  }
}
