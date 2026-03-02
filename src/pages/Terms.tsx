import Header from "@/components/Header";
import Footer from "@/components/Footer";

const sections = [
  { title: "1. Acceptance of Terms", content: "By installing or using WasappBulk, you agree to these Terms of Service. If you do not agree, do not use the extension." },
  { title: "2. Description of Service", content: "WasappBulk is a Chrome extension that automates sending messages through WhatsApp Web. It is a tool — you are responsible for the content you send and compliance with WhatsApp's terms." },
  { title: "3. Acceptable Use", content: "You agree NOT to:\n• Send spam or unsolicited messages\n• Violate WhatsApp's Terms of Service\n• Use the extension for illegal activities\n• Attempt to circumvent rate limits in ways that harm WhatsApp's service\n• Impersonate others or send deceptive messages" },
  { title: "4. Account & Access", content: "You are responsible for your WhatsApp account and any messages sent through the extension. WasappBulk is not liable for account restrictions imposed by WhatsApp." },
  { title: "5. Limitation of Liability", content: "WasappBulk is provided \"as is\" without warranties. We are not liable for message delivery failures, account restrictions, or any damages arising from use of the extension." },
  { title: "6. Modifications", content: "We may update these terms at any time. Continued use after changes constitutes acceptance. Material changes will be communicated through the extension." },
  { title: "7. Contact", content: "Questions about these terms? Email: support@wasappbulk.com" },
];

export default function Terms() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground mt-2 text-sm">Last updated: March 2, 2026</p>

          <div className="mt-12 space-y-10">
            {sections.map((s) => (
              <div key={s.title}>
                <h2 className="text-xl font-bold mb-4">{s.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{s.content}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
