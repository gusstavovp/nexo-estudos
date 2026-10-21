"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-state">
      <h1>Não foi possível abrir seu espaço.</h1>
      <p>Seus dados continuam no banco. Tente carregar a página novamente.</p>
      <button className="primary" onClick={reset}>
        Tentar novamente
      </button>
    </main>
  );
}
