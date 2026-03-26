import Link from 'next/link'
import { Github, Twitter, FileText, Book } from 'lucide-react'

export function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="border-t border-border bg-background">
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
                    {/* About */}
                    <div>
                        <h3 className="font-bebas text-lg font-bold text-brand-green mb-3">
                            DeCleanup Network
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Tokenizing environmental cleanup outcomes into onchain Impact Products.
                            Making a real difference, one cleanup at a time.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold text-sm mb-3">Quick Links</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="/" className="text-muted-foreground hover:text-brand-green transition-colors">
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link href="/cleanup" className="text-muted-foreground hover:text-brand-green transition-colors">
                                    Submit Cleanup
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="font-semibold text-sm mb-3">Resources</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <a
                                    href="https://github.com/DeCleanup-Network"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-brand-green transition-colors flex items-center gap-2"
                                >
                                    <Book className="h-3 w-3" />
                                    Documentation
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://github.com/DeCleanup-Network"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-brand-green transition-colors flex items-center gap-2"
                                >
                                    <FileText className="h-3 w-3" />
                                    Litepaper
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://app.gardens.fund/gardens/42161/0x912ce59144191c1204e64559fe8253a0e49e6548/0x5396c94ea47916f5661734fee769d0d7cc8b14c6"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-brand-green transition-colors flex items-center gap-2"
                                >
                                    🌱 Governance
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Social */}
                    <div>
                        <h4 className="font-semibold text-sm mb-3">Connect</h4>
                        <div className="flex gap-3">
                            <a
                                href="https://github.com/DeCleanup-Network"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-brand-green/20 hover:border-brand-green transition-colors"
                                aria-label="GitHub"
                            >
                                <Github className="h-4 w-4" />
                            </a>
                            <a
                                href="https://twitter.com/DeCleanupNet"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-brand-green/20 hover:border-brand-green transition-colors"
                                aria-label="Twitter"
                            >
                                <Twitter className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                    <p>© {currentYear} DeCleanup Network. All rights reserved.</p>
                    <div className="flex gap-4">
                        <Link href="/privacy" className="hover:text-brand-green transition-colors">
                            Privacy Policy
                        </Link>
                        <Link href="/terms" className="hover:text-brand-green transition-colors">
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
