import { Link, Outlet } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export default function TestLayout() {
  return (
    <AppProvider i18n={enTranslations}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px" }}>
        <nav
          style={{
            display: "flex",
            gap: "16px",
            padding: "12px 16px",
            background: "#f6f6f7",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          <Link to="/test" style={{ fontWeight: 600 }}>
            Dashboard
          </Link>
          <Link to="/test/product">Product Detail</Link>
          <Link to="/test/settings">Settings</Link>
          <Link to="/test/billing">Billing</Link>
        </nav>
        <Outlet />
      </div>
    </AppProvider>
  );
}
