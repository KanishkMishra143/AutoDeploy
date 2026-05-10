import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "AutoDeploy | Canvas",
    description: "Modern Asyn Orchestration",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className="antialiased overflow-hidden bg-background text-foreground">
        <main className="h-screen w-screen flex flex-col">
        {/* Navigation Bar */}
        <header className="h-14 border-b border-card-border flex items-center px-6 bg-card/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-accent rounded-md flex items-center justify-center">
        <span className="text-[10px] font-bold text-white">AD</span>
        </div>
        <h1 className="font-semibold tracking-tight">AutoDeploy <span className="text-muted-foreground font-normal text-sm ml-2">/ Canvas</span></h1>
        </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto relative">
            {children}
        </div>
        </main>
        </body>
        </html>
    );
}