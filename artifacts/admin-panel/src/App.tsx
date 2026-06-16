import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import AdminLayout from "@/components/layout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import NewsPage from "@/pages/news";
import LeadsPage from "@/pages/leads";
import DealersPage from "@/pages/dealers";
import BrandsPage from "@/pages/brands";
import UsersPage from "@/pages/users";
import LocationsPage from "@/pages/locations";
import SettingsPage from "@/pages/settings";
import NavigatorPage from "@/pages/navigator";
import ReviewsPage from "@/pages/reviews";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={() => <RequireAuth><AdminLayout><DashboardPage /></AdminLayout></RequireAuth>} />
      <Route path="/news" component={() => <RequireAuth><AdminLayout><NewsPage /></AdminLayout></RequireAuth>} />
      <Route path="/leads" component={() => <RequireAuth><AdminLayout><LeadsPage /></AdminLayout></RequireAuth>} />
      <Route path="/dealers" component={() => <RequireAuth><AdminLayout><DealersPage /></AdminLayout></RequireAuth>} />
      <Route path="/brands" component={() => <RequireAuth><AdminLayout><BrandsPage /></AdminLayout></RequireAuth>} />
      <Route path="/users" component={() => <RequireAuth><AdminLayout><UsersPage /></AdminLayout></RequireAuth>} />
      <Route path="/locations" component={() => <RequireAuth><AdminLayout><LocationsPage /></AdminLayout></RequireAuth>} />
      <Route path="/settings" component={() => <RequireAuth><AdminLayout><SettingsPage /></AdminLayout></RequireAuth>} />
      <Route path="/navigator" component={() => <RequireAuth><AdminLayout><NavigatorPage /></AdminLayout></RequireAuth>} />
      <Route path="/reviews" component={() => <RequireAuth><AdminLayout><ReviewsPage /></AdminLayout></RequireAuth>} />
      <Route component={() => <RequireAuth><AdminLayout><NotFound /></AdminLayout></RequireAuth>} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
