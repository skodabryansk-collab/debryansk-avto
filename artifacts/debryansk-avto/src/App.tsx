import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, useRef, Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CookieBanner from "@/components/CookieBanner";
import { CTPhoneGuard } from "@/components/CTPhoneGuard";
import NotFound from "@/pages/not-found";

// Lazy-loaded page components — each route loads its chunk on demand.
// Chunks are split by Vite manualChunks into logical groups (catalog,
// brands, info, news, service) to minimize initial bundle size.
const Home               = lazy(() => import("@/pages/home"));
const UsedCars           = lazy(() => import("@/pages/cars"));
const NewCars            = lazy(() => import("@/pages/new-cars"));
const UsedCarDetail      = lazy(() => import("@/pages/car-detail"));
const NewCarDetail       = lazy(() => import("@/pages/new-car-detail"));
const BrandPage          = lazy(() => import("@/pages/brand-page"));
const NewsPage           = lazy(() => import("@/pages/news"));
const NewsDetailPage     = lazy(() => import("@/pages/news-detail"));
const Vacancies          = lazy(() => import("@/pages/vacancies"));
const ComparePage        = lazy(() => import("@/pages/compare"));
const FavoritesPage      = lazy(() => import("@/pages/favorites"));
const ServicePage        = lazy(() => import("@/pages/service"));
const BuyoutPage         = lazy(() => import("@/pages/buyout"));
const ContactsPage       = lazy(() => import("@/pages/contacts"));
const AboutPage          = lazy(() => import("@/pages/about"));
const PrivacyPage        = lazy(() => import("@/pages/privacy"));
const LegalPage          = lazy(() => import("@/pages/legal"));
const BonusProgramPage   = lazy(() => import("@/pages/bonus-program"));
const PromotionDetailPage = lazy(() => import("@/pages/promotion-detail"));
const CorporatePage      = lazy(() => import("@/pages/corporate"));
const LandingPage        = lazy(() => import("@/pages/landing-page"));

/** Minimal full-screen skeleton shown while a lazy chunk is loading. */
function PageLoader() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
      }}
      aria-busy="true"
      aria-label="Загрузка страницы"
    >
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#0070b8", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

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
      <Suspense fallback={<PageLoader />}>
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
          <Route path="/p/:slug" component={LandingPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/legal" component={LegalPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
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
