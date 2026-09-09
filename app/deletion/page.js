export default async function DeletionPage({ searchParams }) {
  const params = await searchParams;
  return (
    <main className="simple-page">
      <div className="simple-card">
        <div className="eyebrow">THREADS SCOUT</div>
        <h1>Data deletion status</h1>
        <p>
          Threads Scout V2 does not keep a server-side user database. Research
          saved from the interface lives only in your browser. Disconnecting
          clears the authenticated browser session.
        </p>
        {params?.code ? <p className="muted">Confirmation: {params.code}</p> : null}
        <a className="button" href="/">Back to Threads Scout</a>
      </div>
    </main>
  );
}
