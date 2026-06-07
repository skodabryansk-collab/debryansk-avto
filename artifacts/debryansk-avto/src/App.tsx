import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

const queryClient = new QueryClient();

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
      <Route path="/service" component={ServicePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
