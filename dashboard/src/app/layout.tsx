import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import AuthGuard from "./components/AuthGuard";
import { Space_Grotesk, JetBrains_Mono, Plus_Jakarta_Sans, Outfit, Sora, Inter, Bricolage_Grotesque, Poppins, Montserrat, Roboto } from 'next/font/google';


// Configure the fonts
const mainFont = Bricolage_Grotesque({
    subsets: ['latin'],
    variable: '--font-space', // This creates a CSS variable
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-mono',
});

export const metadata: Metadata = {
    title: "AutoDeploy | Orchestrator",
    description: "Modern Async Orchestration",
    icons: {
        icon: "/icon.svg",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${mainFont.variable} ${jetbrainsMono.variable}`}>
        <body className="antialiased font-sans bg-background text-foreground overflow-x-hidden">
            <Toaster 
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: '#1a1a1a',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        fontSize: '13px',
                        fontWeight: '600'
                    },
                }}
            />
            <AuthGuard>
                {children}
            </AuthGuard>
        </body>
        </html>
    );
}