export type NavigationItems = {
    label: string;
    href: string; 
    symbol: string;
    description: string;
};

export const navigationItems: NavigationItems[] = [
    {
        label: "Dashboard",
        href: "/dashboard",
        symbol: "^",
        description: "Overview of your learning workspace",
    },
    {
        label: "Documents",
        href: "/documents",
        symbol: "D",
        description: "Upload and manage study materials",
    },
    
    {
        label: "AI Chat",
        href: "/chat",
        symbol: "C",
        description: "Ask questions about your documents",
    },
    {
        label: "Quizzes",
        href: "/quizzes",
        symbol: "Q",
        description: "Generate and practise quizzes",
    },
    {
        label: "Flashcards",
        href: "/flashcards",
        symbol: "F",
        description: "Review AI-generated flashcards",
    },
    {
        label: "Settings",
        href: "/settings",
        symbol: "S",
        description: "Configure your learning workspace",
    },
];
