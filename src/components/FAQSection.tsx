import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  { q: "Is WasappBulk safe to use?", a: "Yes. WasappBulk operates through WhatsApp Web, using the same connection your browser already has. We never store your messages or contacts on our servers." },
  { q: "Will I get banned from WhatsApp?", a: "WasappBulk uses intelligent delays and queuing to mimic natural sending patterns. While no tool can guarantee zero risk, our smart throttling significantly reduces the chance of restrictions." },
  { q: "How many messages can I send per day?", a: "The free plan allows 50 messages/day. Pro users can send up to 1,000/day. Enterprise plans offer unlimited messaging with custom delay settings." },
  { q: "Do I need an API key or developer account?", a: "No. WasappBulk works entirely through WhatsApp Web. No API keys, no developer accounts, no configuration needed." },
  { q: "What data do you collect?", a: "We collect minimal usage analytics (feature usage counts). We never store your messages, contacts, or WhatsApp credentials. See our Privacy Policy for full details." },
  { q: "Can I use this on my phone?", a: "WasappBulk is a Chrome extension that works on desktop browsers. You'll need WhatsApp Web open in Chrome to use it." },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 md:py-32 bg-secondary/30">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl md:text-[32px] font-bold text-center tracking-tight">
          Frequently Asked <span className="text-gradient">Questions</span>
        </h2>

        <div className="mt-16 space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="border border-border bg-card">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left hover:text-primary transition-colors"
              >
                <span className="font-semibold text-sm md:text-base pr-4">{f.q}</span>
                <ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${open === i ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}`}
              >
                <p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
