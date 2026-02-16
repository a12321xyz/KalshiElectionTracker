"use client";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    // Truncate error messages to prevent overly long or misleading output
    const safeMessage =
        error.message && error.message.length < 200
            ? error.message
            : "An unexpected error occurred while loading the page.";

    return (
        <div
            style={{
                minHeight: "60vh",
                display: "grid",
                placeItems: "center",
                padding: "2rem",
                textAlign: "center",
                fontFamily: "var(--font-display), sans-serif",
            }}
        >
            <div>
                <h2
                    style={{
                        fontSize: "1.4rem",
                        color: "var(--ink-900, #143828)",
                        marginBottom: "0.5rem",
                    }}
                >
                    Something went wrong
                </h2>
                <p
                    style={{
                        color: "var(--ink-500, #5c7768)",
                        marginBottom: "1.2rem",
                        maxWidth: "28rem",
                    }}
                >
                    {safeMessage}
                </p>
                <button
                    type="button"
                    onClick={reset}
                    style={{
                        border: 0,
                        borderRadius: "0.75rem",
                        background: "var(--gradient-primary, linear-gradient(135deg, #1f7a4d 0%, #4ca878 100%))",
                        color: "#f4ffff",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        padding: "0.58rem 0.95rem",
                        cursor: "pointer",
                    }}
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
