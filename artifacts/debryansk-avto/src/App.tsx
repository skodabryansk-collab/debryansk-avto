import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CookieBanner from "@/components/CookieBanner";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
const METRIKA_ID = 109748190;

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
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/legal" component={LegalPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <ScrollToTop />
          <MetrikaTracker />
          <Router />
          <CookieBanner />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
