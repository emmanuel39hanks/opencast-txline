import { txStream } from "@/lib/txline/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/stream/[fixtureId] — proxy TxLINE's live SSE score stream to the
 * browser, filtered to one fixture. The upstream stream carries every
 * permitted fixture; we forward only this fixture's events. Auth (JWT +
 * X-Api-Token) stays server-side.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;
  const want = Number(fixtureId);

  let upstream: Response;
  try {
    upstream = await txStream("/scores/stream");
  } catch (e) {
    return new Response(`upstream error: ${(e as Error).message}`, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(`upstream ${upstream.status}`, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      // Tell the browser how fast to reconnect if we drop.
      controller.enqueue(encoder.encode("retry: 5000\n\n"));
      let buf = "";
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          reader.cancel();
        } catch {
          /* noop */
        }
        try {
          controller.close();
        } catch {
          /* noop */
        }
      };
      req.signal.addEventListener("abort", close);

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // SSE events are separated by a blank line.
          const events = buf.split("\n\n");
          buf = events.pop() ?? "";
          for (const ev of events) {
            const data = ev
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim())
              .join("\n");
            if (!data) continue;
            let keep = false;
            try {
              const j = JSON.parse(data) as { FixtureId?: number; fixtureId?: number };
              keep = Number(j.FixtureId ?? j.fixtureId) === want;
            } catch {
              keep = false;
            }
            if (keep) {
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } else {
              // Forward everything else (heartbeats, other fixtures) as an SSE
              // comment — browsers ignore it, but it keeps the pipe warm.
              controller.enqueue(encoder.encode(`: hb\n\n`));
            }
          }
        }
      } catch {
        /* upstream dropped — the browser's EventSource will reconnect */
      } finally {
        close();
      }
    },
    cancel() {
      try {
        reader.cancel();
      } catch {
        /* noop */
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
