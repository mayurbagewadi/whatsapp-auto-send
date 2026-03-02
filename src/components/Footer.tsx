import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <span className="font-mono font-bold text-lg">Wasapp<span className="text-gradient">Bulk</span></span>
          <p className="text-xs text-muted-foreground mt-1">© {new Date().getFullYear()} WasappBulk. All rights reserved.</p>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          <a href="mailto:support@wasappbulk.com" className="hover:text-primary transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}
