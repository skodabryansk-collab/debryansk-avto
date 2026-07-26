import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import { ManagerAuthProvider, RequireManagerAuth } from "@/lib/manager-auth";
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
import PromotionsPage from "@/pages/promotions";
import FaqPage from "@/pages/faq";
import DisclaimersPage from "@/pages/disclaimers";
import BonusProgramAdminPage from "@/pages/bonus-program";
import CorporateAdminPage from "@/pages/corporate";
import ToCatalogPage from "@/pages/to-catalog";
import SeoHubPage from "@/pages/seo-hub";
import CalltouchPage from "@/pages/calltouch";
import AdminManagersPage from "@/pages/admin-managers";
import AdminQuotesPage from "@/pages/admin-quotes";
import AdminSalesManagersPage from "@/pages/admin-sales-managers";
import VisitorsPage from "@/pages/visitors";
import ManagerLoginPage from "@/pages/manager-login";
import ManagerRegisterPage from "@/pages/manager-register";
import ManagerQuotesPage from "@/pages/manager-quotes";
import ManagerProfilePage from "@/pages/manager-profile";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/manager/login" component={ManagerLoginPage} />
      <Route path="/manager/register" component={ManagerRegisterPage} />
      <Route path="/manager/quotes" component={() => <ManagerAuthProvider><RequireManagerAuth><ManagerQuotesPage /></RequireManagerAuth></ManagerAuthProvider>} />
      <Route path="/manager/profile" component={() => <ManagerAuthProvider><RequireManagerAuth><ManagerProfilePage /></RequireManagerAuth></ManagerAuthProvider>} />
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
      <Route path="/promotions" component={() => <RequireAuth><AdminLayout><PromotionsPage /></AdminLayout></RequireAuth>} />
      <Route path="/faq" component={() => <RequireAuth><AdminLayout><FaqPage /></AdminLayout></RequireAuth>} />
      <Route path="/disclaimers" component={() => <RequireAuth><AdminLayout><DisclaimersPage /></AdminLayout></RequireAuth>} />
      <Route path="/bonus-program" component={() => <RequireAuth><AdminLayout><BonusProgramAdminPage /></AdminLayout></RequireAuth>} />
      <Route path="/corporate" component={() => <RequireAuth><AdminLayout><CorporateAdminPage /></AdminLayout></RequireAuth>} />
      <Route path="/to-catalog" component={() => <RequireAuth><AdminLayout><ToCatalogPage /></AdminLayout></RequireAuth>} />
      <Route path="/seo" component={() => <RequireAuth><AdminLayout><SeoHubPage /></AdminLayout></RequireAuth>} />
      <Route path="/seo-positions" component={() => <RequireAuth><AdminLayout><SeoHubPage /></AdminLayout></RequireAuth>} />
      <Route path="/seo-autopilot" component={() => <RequireAuth><AdminLayout><SeoHubPage /></AdminLayout></RequireAuth>} />
      <Route path="/calltouch" component={() => <RequireAuth><AdminLayout><CalltouchPage /></AdminLayout></RequireAuth>} />
      <Route path="/managers" component={() => <RequireAuth><AdminLayout><AdminManagersPage /></AdminLayout></RequireAuth>} />
      <Route path="/quotes" component={() => <RequireAuth><AdminLayout><AdminQuotesPage /></AdminLayout></RequireAuth>} />
      <Route path="/sales-managers" component={() => <RequireAuth><AdminLayout><AdminSalesManagersPage /></AdminLayout></RequireAuth>} />
      <Route path="/visitors" component={() => <RequireAuth><AdminLayout><VisitorsPage /></AdminLayout></RequireAuth>} />
      <Route component={() => <RequireAuth><AdminLayout><NotFound /></AdminLayout></RequireAuth>} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <ManagerAuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRouter />
            </WouterRouter>
            <Toaster />
          </ManagerAuthProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
