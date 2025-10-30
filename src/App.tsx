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
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-80 bg-card border-r border-border/50 shadow-xl lg:shadow-none transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-8 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="w-7 h-7 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Wazuh SIEM</h1>
                  <p className="text-sm text-muted-foreground mt-1">ML-Enhanced Security</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden h-8 w-8 hover:bg-accent/50"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6 space-y-2">
            {navigationItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start h-auto p-4 transition-all duration-200 group ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30' 
                      : 'hover:bg-accent/50 hover:translate-x-1'
                  }`}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                >
                  <div className="flex items-center gap-4 w-full">
                    <div className={`p-2 rounded-lg transition-colors ${
                      isActive ? 'bg-primary-foreground/10' : 'bg-transparent group-hover:bg-accent'
                    }`}>
                      <Icon className="w-5 h-5 flex-shrink-0" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-semibold text-base">{item.label}</div>
                      <div className={`text-xs mt-0.5 transition-colors ${
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

          {/* System Status */}
          <div className="p-6 border-t border-border/50">
            <Card className="bg-gradient-to-br from-card to-accent/20 border-border/50 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-foreground">System Status</span>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-3 py-1 shadow-sm">
                    <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                    Operational
                  </Badge>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-2 rounded-lg hover:bg-accent/30 transition-colors">
                    <span className="text-muted-foreground">Model Accuracy</span>
                    <span className="text-emerald-600 font-semibold">94.2%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg hover:bg-accent/30 transition-colors">
                    <span className="text-muted-foreground">Active Alerts</span>
                    <span className="text-red-600 font-semibold">2 High</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg hover:bg-accent/30 transition-colors">
                    <span className="text-muted-foreground">Logs/Hour</span>
                    <span className="font-semibold text-foreground">1,247</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Mobile Header */}
        <div className="lg:hidden bg-card border-b border-border/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 hover:bg-accent/50"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              {activeItem && (
                <>
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <activeItem.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-semibold text-base text-foreground">{activeItem.label}</span>
                </>
              )}
            </div>
            <div className="w-10" /> {/* Spacer for balance */}
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1">
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