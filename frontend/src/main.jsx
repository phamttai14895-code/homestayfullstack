import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "./context/I18n.jsx";
import { CurrencyProvider } from "./context/Currency.jsx";
import { ThemeProvider } from "./context/Theme.jsx";
import { UserProvider } from "./context/User.jsx";
import { WishlistProvider } from "./context/Wishlist.jsx";
import { NotificationsProvider } from "./context/Notifications.jsx";
import App from "./App.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <UserProvider>
              <NotificationsProvider>
                <WishlistProvider>
                  <App />
                </WishlistProvider>
              </NotificationsProvider>
            </UserProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
