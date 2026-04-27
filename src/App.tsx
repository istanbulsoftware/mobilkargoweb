import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useWebsiteSettings } from './lib/useWebsiteSettings';
import { AboutPage } from './pages/AboutPage';
import { AccountPage } from './pages/AccountPage';
import { AppPage } from './pages/AppPage';
import { BlogPage } from './pages/BlogPage';
import { ContactPage } from './pages/ContactPage';
import { ContentPage } from './pages/ContentPage';
import { ConversationPage } from './pages/ConversationPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { RegisterPage } from './pages/RegisterPage';
import { ShipmentDetailPage } from './pages/ShipmentDetailPage';
import { ShipmentEditPage } from './pages/ShipmentEditPage';
import { SubscriptionCheckoutPage } from './pages/SubscriptionCheckoutPage';
import { VehicleDetailPage } from './pages/VehicleDetailPage';
import { VehicleEditPage } from './pages/VehicleEditPage';

function App() {
  const { settings } = useWebsiteSettings();

  const alertClass = {
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    danger: 'alert-danger',
  }[settings.announcementTheme];

  return (
    <>
      {settings.announcementBarEnabled && settings.announcementText && (
        <div className={`alert ${alertClass} text-center rounded-0 mb-0`} role="alert">
          {settings.announcementLink ? (
            <a className="text-reset text-decoration-none" href={settings.announcementLink}>
              {settings.announcementText}
            </a>
          ) : (
            settings.announcementText
          )}
        </div>
      )}

      <Layout settings={settings}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/hesabim" element={<AccountPage />} />
          <Route path="/bildirimler" element={<NotificationsPage />} />
          <Route path="/mesajlar" element={<ConversationsPage />} />
          <Route path="/mesajlar/:conversationId" element={<ConversationPage />} />
          <Route path="/hesabim/yuk/:shipmentId" element={<ShipmentDetailPage />} />
          <Route path="/hesabim/yuk/:shipmentId/duzenle" element={<ShipmentEditPage />} />
          <Route path="/hesabim/arac/:vehicleId" element={<VehicleDetailPage />} />
          <Route path="/hesabim/arac/:vehicleId/duzenle" element={<VehicleEditPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/content/:slug" element={<ContentPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/abonelik" element={<Navigate to="/abonelik/plan-1776496671427" replace />} />
          <Route path="/abonelik/:planId" element={<SubscriptionCheckoutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </>
  );
}

export default App;

