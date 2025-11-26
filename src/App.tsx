import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Brain, 
  AlertTriangle, 
  Settings as SettingsIcon, 
  Shield,
  Menu,
  X
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Card, CardContent } from './components/ui/card';
import { Dashboard } from './components/Dashboard';
import { MLFeedback } from './components/MLFeedback';
import { Alerts } from './components/Alerts';
import { Settings } from './components/Settings';
import { Toaster } from './components/ui/sonner';

type ActiveTab = 'dashboard' | 'ml-feedback' | 'alerts' | 'settings';

const navigationItems = [
  {
    id: 'dashboard' as ActiveTab,
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Security logs overview'
  },
  {
    id: 'ml-feedback' as ActiveTab,
    label: 'ML Feedback',
    icon: Brain,
    description: 'Model training & corrections'
  },
  {
    id: 'alerts' as ActiveTab,
    label: 'Alerts',
    icon: AlertTriangle,
    description: 'Active security alerts'
  },
  {
    id: 'settings' as ActiveTab,
    label: 'Settings',
    icon: SettingsIcon,
    description: 'System configuration'
  }
];

export default function App() {
  // Use URL hash for routing (preserves page on refresh)
  const getInitialTab = (): ActiveTab => {
    const hash = window.location.hash.slice(1) as ActiveTab;
    const validTabs: ActiveTab[] = ['dashboard', 'ml-feedback', 'alerts', 'settings'];
    return validTabs.includes(hash) ? hash : 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Update URL hash when tab changes
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.location.hash = tab;
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'ml-feedback':
        return <MLFeedback />;
      case 'alerts':
        return <Alerts />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  const activeItem = navigationItems.find(item => item.id === activeTab);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile menu overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-80 bg-card border-r transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-8 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                  <Shield className="w-7 h-7 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Wazuh SIEM</h1>
                  <p className="text-sm text-muted-foreground mt-1">ML-Enhanced Security</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden h-8 w-8"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6 space-y-3">
            {navigationItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start h-auto p-5 transition-all duration-200 ${
                    isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'
                  }`}
                  onClick={() => handleTabChange(item.id)}
                >
                  <div className="flex items-center gap-4 w-full">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <div className="text-left">
                      <div className="font-medium text-base">{item.label}</div>
                      <div className={`text-sm mt-1 ${
                        isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </nav>

          {/* Footer Info */}
          <div className="p-6 border-t">
            <div className="text-sm text-muted-foreground text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>System Online</span>
                </div>
              <div className="text-xs">
                Backend: <span className="font-mono">localhost:8081</span>
                  </div>
                </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Mobile Header */}
        <div className="lg:hidden bg-card border-b p-5">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              {activeItem && (
                <>
                  <activeItem.icon className="w-5 h-5" />
                  <span className="font-medium text-base">{activeItem.label}</span>
                </>
              )}
            </div>
            <div className="w-10" /> {/* Spacer for balance */}
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>

      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        closeButton
        richColors
      />
    </div>
  );
}