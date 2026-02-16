import Link from "next/link";

export default function NotFound() {
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
                <p
                    style={{
                        fontSize: "3rem",
                        lineHeight: 1,
                        marginBottom: "0.5rem",
                    }}
                >
                    🗳️
                </p>
                <h2
                    style={{
                        fontSize: "1.4rem",
                        color: "var(--ink-900, #143828)",
                        marginBottom: "0.4rem",
                    }}
                >
                    Page not found
                </h2>
                <p
                    style={{
                        color: "var(--ink-500, #5c7768)",
                        marginBottom: "1.2rem",
                        maxWidth: "24rem",
                    }}
                >
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Link
                    href="/"
                    style={{
                        display: "inline-block",
                        border: 0,
                        borderRadius: "0.75rem",
                        background: "var(--gradient-primary, linear-gradient(135deg, #1f7a4d 0%, #4ca878 100%))",
                        color: "#f4ffff",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        padding: "0.58rem 0.95rem",
                        textDecoration: "none",
                    }}
                >
                    ← Back to Dashboard
                </Link>
            </div>
        </div>
    );
}
