import Swal from 'sweetalert2';
import { api } from './api';

type OfferContractRequirementResponse = {
  required?: boolean;
  action?: 'carrier_offer' | 'shipper_accept';
  contract?: {
    contentId?: string;
    slug?: string;
    title?: string;
    body?: string;
    contractUrl?: string;
    snapshotHtml?: string;
    checkboxLabel?: string;
  };
};

export type OfferContractConsentPayload = {
  accepted: boolean;
  contractSlug?: string;
};

const printContractHtml = (title: string, html: string) => {
  const win = window.open('', '_blank', 'width=980,height=800');
  if (!win) return;

  win.document.open();
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; line-height: 1.45; color: #111827; }
          h1, h2, h3, h4 { margin: 0 0 10px; }
          p { margin: 0 0 8px; }
          hr { margin: 16px 0; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  win.document.close();
  win.focus();

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      // no-op
    }
  };

  win.onload = () => {
    window.setTimeout(triggerPrint, 120);
  };
  window.setTimeout(triggerPrint, 420);
};

const openContractWindow = (title: string, html: string) => {
  const win = window.open('', '_blank', 'width=980,height=800');
  if (!win) return;

  win.document.open();
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; line-height: 1.45; color: #111827; }
          h1, h2, h3, h4 { margin: 0 0 10px; }
          p { margin: 0 0 8px; }
          hr { margin: 16px 0; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  win.document.close();
  win.focus();
};

export async function requireOfferContractConsent(params: {
  shipmentId: string;
  action: 'carrier_offer' | 'shipper_accept';
  offerId?: string;
  partiesIntroHtml?: string;
}): Promise<OfferContractConsentPayload | null> {
  const { data } = await api.get<OfferContractRequirementResponse>('/offers/contract-requirements', { params });
  if (!data?.required) return { accepted: true };

  const contractTitle = String(data.contract?.title || 'Sözleşme');
  const contractHtmlRaw = String(data.contract?.snapshotHtml || data.contract?.body || '');
  const fullContractHtml = `${String(params.partiesIntroHtml || '')}${contractHtmlRaw || '<p>Sözleşme metni bulunamadı.</p>'}`;
  const checkboxLabel = String(data.contract?.checkboxLabel || 'Sözleşmeyi okudum ve kabul ediyorum.');
  const slug = String(data.contract?.slug || '');

  while (true) {
    const result = await Swal.fire({
      title: contractTitle,
      width: 980,
      html: `
        <div style="text-align:left;">
          <div style="margin-bottom:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button id="open-filled-contract" type="button" class="swal2-confirm swal2-styled" style="display:inline-flex;background:#0d6efd;">Belgeyi Oku</button>
          </div>
          <div style="max-height:62vh; overflow:auto; border:1px solid #e5e7eb; border-radius:10px; padding:12px; background:#fff;">
            ${fullContractHtml}
          </div>
          <label style="display:flex; gap:8px; align-items:flex-start; margin-top:12px; font-weight:600;">
            <input id="offer-contract-ack" type="checkbox" />
            <span>${checkboxLabel}</span>
          </label>
        </div>
      `,
      showCancelButton: true,
      showDenyButton: true,
      denyButtonText: 'PDF Olarak İndir',
      confirmButtonText: 'Onayla ve Devam Et',
      cancelButtonText: 'Vazgeç',
      focusConfirm: false,
      didOpen: () => {
        const openBtn = document.getElementById('open-filled-contract');
        if (openBtn) {
          openBtn.addEventListener('click', () => openContractWindow(contractTitle, fullContractHtml));
        }
      },
      preConfirm: () => {
        const input = document.getElementById('offer-contract-ack') as HTMLInputElement | null;
        if (!input?.checked) {
          Swal.showValidationMessage('Devam etmek için sözleşme onayı zorunludur.');
          return null;
        }
        return true;
      },
    });

    if (result.isDenied) {
      printContractHtml(contractTitle, fullContractHtml);
      continue;
    }
    if (result.isConfirmed) {
      return { accepted: true, contractSlug: slug || undefined };
    }
    return null;
  }
}
