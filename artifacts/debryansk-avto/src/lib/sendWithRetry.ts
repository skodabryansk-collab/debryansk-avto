/**
 * Отправляет форму на /api/send-email и молча повторяет до 3 раз при неудаче.
 * Пользователь ничего не видит — экран успеха уже показан до вызова.
 * Если все попытки провалились — данные попадут в серверный лог (LEAD LOST).
 */
export function sendWithRetry(fd: FormData, maxAttempts = 3): void {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  async function attempt(n: number): Promise<void> {
    try {
      const res = await fetch(`${BASE}/api/send-email`, { method: "POST", body: fd });
      if (res.ok) return;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (n < maxAttempts) {
        // Экспоненциальная задержка: 2s, 4s
        await new Promise(r => setTimeout(r, 2000 * n));
        return attempt(n + 1);
      }
      // Все попытки исчерпаны — логируем на сервер отдельным запросом
      const errFd = new FormData();
      errFd.append("type", "lead_retry_failed");
      errFd.append("message", `Все ${maxAttempts} попытки отправки заявки провалились: ${String(err)}`);
      const entries = (fd as any).entries ? [...(fd as any).entries()] : [];
      for (const [k, v] of entries) {
        if (typeof v === "string") errFd.append(k, v);
      }
      fetch(`${BASE}/api/send-email`, { method: "POST", body: errFd }).catch(() => {});
    }
  }

  attempt(1);
}
