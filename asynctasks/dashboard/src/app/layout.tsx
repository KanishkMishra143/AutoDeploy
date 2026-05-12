import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
    title: "AutoDeploy | Canvas",
    description: "Modern Async Orchestration",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className="antialiased bg-background text-foreground overflow-x-hidden">
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
            {children}
        </body>
        </html>
    );
}