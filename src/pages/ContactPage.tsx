import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../lib/api';

export function ContactPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setResult('');
    try {
      const { data } = await api.post('/website/contact', { fullName, email, subject, message });
      setResult(data?.message || 'Mesajiniz alindi.');
      setFullName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (error: any) {
      setResult(error?.response?.data?.message || 'Gönderim başarısız.');
    }
  };

  return (
    <section className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="panel-card p-4 p-md-5">
            <h2 className="fw-bold mb-3">İletişim</h2>
            <form className="row g-3" onSubmit={submit}>
              <div className="col-md-6"><input className="form-control" placeholder="Ad Soyad" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="col-md-6"><input className="form-control" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="col-12"><input className="form-control" placeholder="Konu" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
              <div className="col-12"><textarea className="form-control" rows={5} placeholder="Mesaj" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
              <div className="col-12"><button className="btn btn-primary">Gönder</button></div>
            </form>
            {result && <div className="alert alert-info mt-3 mb-0">{result}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}



