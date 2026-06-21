export function App(): JSX.Element {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #334155",
        background: "rgba(15, 23, 42, 0.85)",
        padding: 16,
        color: "#f8fafc",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "#a5b4fc" }}>Sample federated module</div>
      <p style={{ marginTop: 8, fontSize: 14, color: "#cbd5e1", lineHeight: 1.5 }}>
        This bundle is built as a Module Federation remote. The launcher host loads{" "}
        <code style={{ background: "#1e293b", padding: "2px 6px", borderRadius: 4 }}>remoteEntry.js</code> at runtime so
        new business modules can ship without rebuilding the shell.
      </p>
      <p style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
        In real modules, add <code style={{ background: "#1e293b", padding: "2px 6px", borderRadius: 4 }}>@platform/shell-sdk</code>{" "}
        for session, navigation, and sync contracts.
      </p>
    </div>
  );
}
