import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CookieBanner from "@/components/CookieBanner";
import { CTPhoneGuard } from "@/components/CTPhoneGuard";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import UsedCars from "@/pages/cars";
import NewCars from "@/pages/new-cars";
import UsedCarDetail from "@/pages/car-detail";
import NewCarDetail from "@/pages/new-car-detail";
import Vacancies from "@/pages/vacancies";
import ComparePage from "@/pages/compare";
import FavoritesPage from "@/pages/favorites";
import NewsPage from "@/pages/news";
import NewsDetailPage from "@/pages/news-detail";
import ServicePage from "@/pages/service";
import BuyoutPage from "@/pages/buyout";
import ContactsPage from "@/pages/contacts";
import AboutPage from "@/pages/about";
import BrandPage from "@/pages/brand-page";
import PrivacyPage from "@/pages/privacy";
import LegalPage from "@/pages/legal";
import BonusProgramPage from "@/pages/bonus-program";
import PromotionDetailPage from "@/pages/promotion-detail";
import CorporatePage from "@/pages/corporate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: 3000,
      gcTime: 60 * 60 * 1000,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const METRIKA_ID = 109748190;

// Persist a stable session ID across page navigations (but not across tabs)
function getOrCreateSessionId(): string {
  const key = "da_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, id);
  }
  return id;
}

function OnlinePing() {
  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    const ping = () => {
      fetch("/api/online/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        keepalive: true,
      }).catch(() => {});
    };
    ping(); // immediate on mount
    const timer = setInterval(ping, 30_000);
    return () => clearInterval(timer);
  }, []);
  return null;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function MetrikaTracker() {
  const [location] = useLocation();
  const prevLocation = useRef<string | null>(null);

  useEffect(() => {
    if (prevLocation.current === null) {
      prevLocation.current = location;
      return;
    }
    if (prevLocation.current !== location) {
      const ym = (window as any).ym;
      if (typeof ym === "function") {
        ym(METRIKA_ID, "hit", window.location.href, {
          title: document.title,
          referer: window.location.origin + prevLocation.current,
        });
      }
      prevLocation.current = location;
    }
  }, [location]);

  return null;
}

function Router() {
  return (
    <>
    <OnlinePing />
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/cars" component={UsedCars} />
      <Route path="/cars/:id" component={UsedCarDetail} />
      <Route path="/new-cars" component={NewCars} />
      <Route path="/new-cars/:id" component={NewCarDetail} />
      <Route path="/vacancies" component={Vacancies} />
      <Route path="/compare" component={ComparePage} />
      <Route path="/favorites" component={FavoritesPage} />
      <Route path="/news" component={NewsPage} />
      <Route path="/news/:slug" component={NewsDetailPage} />
      <Route path="/service/bonus" component={BonusProgramPage} />
      <Route path="/service" component={ServicePage} />
      <Route path="/buyout" component={BuyoutPage} />
      <Route path="/contacts" component={ContactsPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/brands/:slug" component={BrandPage} />
      <Route path="/promotions/:slug" component={PromotionDetailPage} />
      <Route path="/corporate" component={CorporatePage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/legal" component={LegalPage} />
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <ScrollToTop />
          <MetrikaTracker />
          {!((window as any).__PRERENDER__ || navigator.userAgent.includes("HeadlessChrome")) && <CTPhoneGuard />}
          <Router />
          <CookieBanner />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
