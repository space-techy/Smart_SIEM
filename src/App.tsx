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
    <div className="min-h-screen bg-background-solid flex relative">
      {/* Mobile menu overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-all duration-300" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-80 glass-effect shadow-2xl transform transition-all duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(99, 102, 241, 0.15)'
      }}>
        <div className="flex flex-col h-full relative">
          {/* Decorative gradient overlay */}
          <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
          
          {/* Header */}
          <div className="p-8 border-b border-primary/10 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                    <Shield className="w-8 h-8 text-white relative z-10" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Wazuh SIEM</h1>
                  <p className="text-sm text-muted-foreground mt-0.5 font-medium">ML-Enhanced Security</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden h-9 w-9 rounded-xl hover:bg-primary/10 transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6 space-y-2 relative z-10">
            {navigationItems.map((item, index) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              
              return (
                <div
                  key={item.id}
                  className="relative"
                  style={{
                    animation: `slide-in 0.3s ease-out ${index * 0.1}s backwards`
                  }}
                >
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={`w-full justify-start h-auto p-4 transition-all duration-300 relative overflow-hidden group ${
                      isActive 
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/30' 
                        : 'hover:bg-primary/5 hover:translate-x-1'
                    }`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
                    )}
                    <div className="flex items-center gap-4 w-full relative z-10">
                      <div className={`p-2.5 rounded-xl transition-all duration-300 ${
                        isActive 
                          ? 'bg-white/20 shadow-lg' 
                          : 'bg-primary/5 group-hover:bg-primary/10 group-hover:scale-110'
                      }`}>
                        <Icon className="w-5 h-5 flex-shrink-0" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-semibold text-base">{item.label}</div>
                        <div className={`text-xs mt-0.5 transition-colors ${
                          isActive ? 'text-white/80' : 'text-muted-foreground'
                        }`}>
                          {item.description}
                        </div>
                      </div>
                      {isActive && (
                        <div className="w-1.5 h-8 bg-white/30 rounded-full" />
                      )}
                    </div>
                  </Button>
                </div>
              );
            })}
          </nav>

          {/* System Status */}
          <div className="p-6 border-t border-primary/10 relative z-10">
            <Card className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border-primary/20 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <span className="font-bold text-foreground">System Status</span>
                  <Badge className="bg-gradient-to-r from-emerald-400 to-green-500 text-white border-0 px-3 py-1 shadow-lg shadow-emerald-500/30">
                    <span className="inline-block w-2 h-2 bg-white rounded-full mr-2 animate-pulse shadow-lg"></span>
                    Operational
                  </Badge>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-2.5 rounded-lg hover:bg-white/60 transition-colors">
                    <span className="text-muted-foreground font-medium">Model Accuracy</span>
                    <span className="text-emerald-600 font-bold text-base">94.2%</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg hover:bg-white/60 transition-colors">
                    <span className="text-muted-foreground font-medium">Active Alerts</span>
                    <span className="text-rose-600 font-bold text-base">2 High</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg hover:bg-white/60 transition-colors">
                    <span className="text-muted-foreground font-medium">Logs/Hour</span>
                    <span className="font-bold text-foreground text-base">1,247</span>
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
        <div className="lg:hidden glass-effect border-b border-primary/10 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 rounded-xl hover:bg-primary/10"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              {activeItem && (
                <>
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                    <activeItem.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-base bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{activeItem.label}</span>
                </>
              )}
            </div>
            <div className="w-10" /> {/* Spacer for balance */}
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1 bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/30">
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