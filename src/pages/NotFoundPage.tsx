import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="container py-5 text-center">
      <h1 className="display-5 fw-bold">404</h1>
      <p className="text-secondary">Sayfa bulunamadi.</p>
      <Link to="/" className="btn btn-primary">Ana sayfaya don</Link>
    </section>
  );
}

