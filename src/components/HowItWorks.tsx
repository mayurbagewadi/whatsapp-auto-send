import { Download, LogIn, UploadCloud, Send } from "lucide-react";

const steps = [
  { icon: Download, title: "Install Extension", desc: "Add WasappBulk to Chrome in one click." },
  { icon: LogIn, title: "Open WhatsApp Web", desc: "Log in to WhatsApp Web as usual." },
  { icon: UploadCloud, title: "Upload Contacts", desc: "Paste numbers or import a CSV file." },
  { icon: Send, title: "Hit Send", desc: "Messages go out automatically with smart delays." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-[32px] font-bold text-center tracking-tight">
          How It <span className="text-gradient">Works</span>
        </h2>
        <p className="text-muted-foreground text-center mt-4">Four steps. Under 60 seconds to set up.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          {steps.map((s, i) => (
            <div key={s.title} className="text-center group">
              <div className="w-16 h-16 mx-auto rounded-full border-2 border-primary/30 flex items-center justify-center mb-6 group-hover:border-primary group-hover:glow-cyan transition-all">
                <s.icon className="text-primary" size={28} />
              </div>
              <span className="text-xs font-mono text-primary tracking-widest uppercase">Step {i + 1}</span>
              <h3 className="text-lg font-bold mt-2 mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
