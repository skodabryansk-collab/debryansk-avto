export interface NavigatorChatMessageRow {
  role: string;
  content: unknown;
}

/** Convert newest-first database rows into a compact, chronological email transcript. */
export function formatNavigatorChatHistoryRows(rows: readonly NavigatorChatMessageRow[]): string {
  return [...rows]
    .reverse()
    .slice(-12)
    .map(row => ({
      label: row.role === "user" ? "Клиент" : "Навигатор",
      content: String(row.content ?? "").trim().slice(0, 400),
    }))
    .filter(row => row.content.length > 0)
    .map(row => `${row.label}: ${row.content}`)
    .join("\n");
}
