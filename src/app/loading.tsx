export default function Loading() {
    return (
        <div
            style={{
                minHeight: "60vh",
                display: "grid",
                placeItems: "center",
                padding: "2rem",
            }}
        >
            <div style={{ textAlign: "center" }}>
                <div
                    style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        border: "3px solid var(--muted, #e5efe8)",
                        borderTopColor: "var(--primary, #1f7a4d)",
                        borderRadius: "999px",
                        animation: "spin 0.7s linear infinite",
                        margin: "0 auto 1rem",
                    }}
                />
                <p style={{ color: "var(--ink-500, #5c7768)", fontSize: "0.9rem" }}>
                    Loading election data…
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );
}
