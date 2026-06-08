const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export async function sendEmail(
  type: string,
  fields: Record<string, string>,
  files?: File[]
): Promise<void> {
  const fd = new FormData();
  fd.append("type", type);
  for (const [k, v] of Object.entries(fields)) {
    if (v) fd.append(k, v);
  }
  if (files) {
    for (const f of files) fd.append("attachments", f);
  }

  const res = await fetch(`${BASE}/api/send-email`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Send failed");
  }
}
