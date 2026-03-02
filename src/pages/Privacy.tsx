import Header from "@/components/Header";
import Footer from "@/components/Footer";

const sections = [
  {
    title: "1. Data We Collect",
    content: `We collect only what's necessary to provide our service:
• **Phone numbers** — provided by you for message delivery
• **Message content** — created by you, processed locally
• **WhatsApp Web session** — used in your browser only, never transmitted to our servers
• **Basic usage analytics** — anonymous feature usage counts (no personal data)`
  },
  {
    title: "2. How We Use Your Data",
    content: `• To send messages you explicitly request
• To improve the extension's reliability and performance
• We do **NOT** sell, share, or provide your data to third parties
• We do **NOT** store your messages or contact lists on our servers`
  },
  {
    title: "3. Data Storage",
    content: `• All data is stored locally in your browser (Chrome local storage)
• No cloud database stores your messages or contacts
• Usage analytics are anonymized and retained for 30 days
• You retain full ownership and control of all your data`
  },
  {
    title: "4. Your Rights",
    content: `• **Delete** your data at any time by clearing extension storage
• **Export** your data from the extension settings
• **Uninstall** the extension to automatically remove all local data
• Request deletion of analytics data via email`
  },
  {
    title: "5. Security",
    content: `• All communications use HTTPS encryption
• WhatsApp's own end-to-end encryption protects your messages
• No third-party tracking scripts or cookies
• Extension code is open for review`
  },
  {
    title: "6. Contact",
    content: `For privacy questions or data requests:
**Email:** privacy@wasappbulk.com`
  },
];

export default function Privacy() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2 text-sm">Last updated: March 2, 2026</p>

          <div className="mt-12 space-y-10">
            {sections.map((s) => (
              <div key={s.title}>
                <h2 className="text-xl font-bold mb-4">{s.title}</h2>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {s.content.split("**").map((part, i) =>
                    i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
