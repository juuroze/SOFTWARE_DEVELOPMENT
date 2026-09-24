import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "JuriSync <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function fetchAttachment(fileUrl: string, fileName: string) {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Could not download attachment: ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const base64 = btoa(binary);
    return { filename: fileName, content: base64 };
}

Deno.serve(async () => {
    if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({ error: "RESEND_API_KEY secret is not set" }), { status: 500 });
    }

    const { data: pending, error } = await supabase
        .from("email_queue")
        .select("id, subject, recipient_email, body, attachment_document_id, documents(title, file_url)")
        .eq("is_sent", false)
        .lte("scheduled_at", new Date().toISOString())
        .limit(25);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const results = [];

    for (const row of pending ?? []) {
        try {
            const payload: Record<string, unknown> = {
                from: FROM_EMAIL,
                to: [row.recipient_email],
                subject: row.subject,
                text: row.body ?? "",
            };

            if (row.documents?.file_url) {
                payload.attachments = [
                    await fetchAttachment(row.documents.file_url, row.documents.title ?? "attachment"),
                ];
            }

            const resendRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!resendRes.ok) {
                const errText = await resendRes.text();
                throw new Error(`Resend error: ${errText}`);
            }

            await supabase
                .from("email_queue")
                .update({ is_sent: true, sent_at: new Date().toISOString() })
                .eq("id", row.id);

            results.push({ id: row.id, status: "sent" });
        } catch (err) {
            console.error(`Failed to send email ${row.id}:`, err);
            results.push({ id: row.id, status: "failed", error: String(err) });
        }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
        headers: { "Content-Type": "application/json" },
    });
});