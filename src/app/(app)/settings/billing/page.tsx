export default function BillingPage() {
  return (
    <>
      <div className="main-header">
        <div>
          <h1>Billing &amp; Plan</h1>
          <p>Subscription and payment management</p>
        </div>
      </div>
      <div className="content" style={{ maxWidth: 720 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <h2>Current Plan</h2>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Free</div>
                <div style={{ fontSize: 12, color: "var(--fg2)" }}>No billing configured</div>
              </div>
              <span className="badge badge-connected" style={{ marginLeft: "auto" }}>Active</span>
            </div>
            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>1</div>
                <div style={{ fontSize: 11, color: "var(--fg2)" }}>Spaces</div>
              </div>
              <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>&infin;</div>
                <div style={{ fontSize: 11, color: "var(--fg2)" }}>Scans/mo</div>
              </div>
              <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>1</div>
                <div style={{ fontSize: 11, color: "var(--fg2)" }}>Team seats</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
