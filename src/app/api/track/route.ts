import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getPublicClient } from "@/lib/supabase/public";
import { trackPayloadSchema } from "@/lib/validation/track";

/** Bot/scrubber/prefetch tak layak hitung. Daftar kasar namun cukup untuk MVP. */
const BOT_UA = /bot|crawl|spider|preview|headless|lighthouse|phantomjs|slurp|curl|wget|monitor/i;

/**
 * Beacon analitik etalase. SELALU balas 204 (sendBeacon menuntut ini & jangan
 * pernah memicu retry); validasi payload → RPC log_event (anon, security
 * definer, hanya toko published). Kegagalan apa pun ditelan senyap.
 */
export async function POST(request: NextRequest) {
  // rem first-line: >60 event/menit per IP dianggap noise
  if (!rateLimit(`track:${clientIp(request.headers)}`, 60)) {
    return new NextResponse(null, { status: 204 });
  }
  try {
    const json = await request.json().catch(() => null);
    const parsed = trackPayloadSchema.safeParse(json);
    if (!parsed.success) return new NextResponse(null, { status: 204 });

    const ua = request.headers.get("user-agent") ?? "";
    const isBot = BOT_UA.test(ua) || ua === "";

    const { slug, type, target, sid, path } = parsed.data;
    const supabase = getPublicClient();
    await supabase.rpc("log_event", {
      p_slug: slug,
      p_type: type,
      p_session: sid ?? null,
      p_target: target ?? null,
      p_path: path ?? null,
      p_referrer: request.headers.get("referer"),
      p_is_bot: isBot,
    });
  } catch (error) {
    // Pengunjung tak boleh melihat error analitik — tapi di dev error
    // dicatat ke console server agar bug seperti regresi RPC tidak senyap.
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/track]", error);
    }
  }
  return new NextResponse(null, { status: 204 });
}
