import React, { useState } from 'react';
import { Settings as SettingsIcon, Users, Brain, Clock, Shield, Save, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { toast } from 'sonner@2.0.3';

interface MLSettings {
  retrainingInterval: string;
  confidenceThreshold: number;
  autoClassification: boolean;
  alertThreshold: string;
}

interface UserPermission {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Analyst' | 'Viewer';
  canViewLogs: boolean;
  canClassifyLogs: boolean;
  canManageAlerts: boolean;
}

export function Settings() {
  const [mlSettings, setMLSettings] = useState<MLSettings>({
    retrainingInterval: '24',
    confidenceThreshold: 0.85,
    autoClassification: true,
    alertThreshold: 'moderate'
  });

  const [users, setUsers] = useState<UserPermission[]>([
    {
      id: '1',
      name: 'John Smith',
      email: 'john.smith@company.com',
      role: 'Admin',
      canViewLogs: true,
      canClassifyLogs: true,
      canManageAlerts: true
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      role: 'Analyst',
      canViewLogs: true,
      canClassifyLogs: true,
      canManageAlerts: false
    },
    {
      id: '3',
      name: 'Mike Davis',
      email: 'mike.davis@company.com',
      role: 'Viewer',
      canViewLogs: true,
      canClassifyLogs: false,
      canManageAlerts: false
    }
  ]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleMLSettingChange = (key: keyof MLSettings, value: any) => {
    setMLSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleUserRoleChange = (userId: string, role: 'Admin' | 'Analyst' | 'Viewer') => {
    setUsers(prevUsers =>
      prevUsers.map(user => {
        if (user.id === userId) {
          // Update permissions based on role
          const permissions = {
            Admin: { canViewLogs: true, canClassifyLogs: true, canManageAlerts: true },
            Analyst: { canViewLogs: true, canClassifyLogs: true, canManageAlerts: false },
            Viewer: { canViewLogs: true, canClassifyLogs: false, canManageAlerts: false }
          };
          return { ...user, role, ...permissions[role] };
        }
        return user;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleSaveSettings = () => {
    // In a real application, this would save to backend
    console.log('Saving ML settings:', mlSettings);
    console.log('Saving user permissions:', users);
    toast.success('Settings saved successfully');
    setHasUnsavedChanges(false);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-500 text-white';
      case 'Analyst': return 'bg-blue-500 text-white';
      case 'Viewer': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Settings</h1>
          <p className="text-muted-foreground mt-2 text-base">Configure ML model parameters and user permissions</p>
        </div>
        {hasUnsavedChanges && (
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-orange-100/50 border-2 border-orange-300 rounded-xl shadow-lg">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="text-orange-800 font-semibold">Unsaved changes</span>
            <Button onClick={handleSaveSettings} className="h-9 px-4 shadow-md bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg transition-all">
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="ml-model" className="space-y-8">
        <TabsList className="grid w-full grid-cols-3 h-14 p-1 bg-muted/50 rounded-xl shadow-sm">
          <TabsTrigger value="ml-model" className="flex items-center gap-2 h-12 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <Brain className="w-4 h-4" />
            <span className="font-semibold">ML Model</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2 h-12 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <Users className="w-4 h-4" />
            <span className="font-semibold">User Permissions</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2 h-12 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
            <SettingsIcon className="w-4 h-4" />
            <span className="font-semibold">System</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ml-model" className="space-y-8">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-6 bg-gradient-to-r from-card to-accent/10">
              <CardTitle className="flex items-center gap-3 text-xl font-bold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                Machine Learning Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="retraining-interval" className="text-base">Retraining Interval (hours)</Label>
                  <Select 
                    value={mlSettings.retrainingInterval} 
                    onValueChange={(value) => handleMLSettingChange('retrainingInterval', value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">Every 6 hours</SelectItem>
                      <SelectItem value="12">Every 12 hours</SelectItem>
                      <SelectItem value="24">Every 24 hours</SelectItem>
                      <SelectItem value="48">Every 48 hours</SelectItem>
                      <SelectItem value="168">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    How often the model should retrain with new feedback
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="confidence-threshold" className="text-base">Confidence Threshold</Label>
                  <Input
                    id="confidence-threshold"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    className="h-11"
                    value={mlSettings.confidenceThreshold}
                    onChange={(e) => handleMLSettingChange('confidenceThreshold', parseFloat(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Minimum confidence level for automatic classification (0.0 - 1.0)
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="alert-threshold" className="text-base">Alert Threshold</Label>
                  <Select 
                    value={mlSettings.alertThreshold} 
                    onValueChange={(value) => handleMLSettingChange('alertThreshold', value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low and above</SelectItem>
                      <SelectItem value="moderate">Moderate and above</SelectItem>
                      <SelectItem value="high">High only</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Minimum threat level to generate alerts
                  </p>
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <Switch
                    id="auto-classification"
                    checked={mlSettings.autoClassification}
                    onCheckedChange={(checked) => handleMLSettingChange('autoClassification', checked)}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="auto-classification" className="text-base">Auto-classification</Label>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Automatically classify logs above confidence threshold
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Model Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-card to-green-50/20 hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="text-3xl font-bold text-green-600 mb-1">94.2%</div>
                      <p className="text-sm text-muted-foreground">Overall Accuracy</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-card to-blue-50/20 hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="text-3xl font-bold text-blue-600 mb-1">1,247</div>
                      <p className="text-sm text-muted-foreground">Logs Processed Today</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-card to-orange-50/20 hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="text-3xl font-bold text-orange-600 mb-1">23</div>
                      <p className="text-sm text-muted-foreground">Corrections This Week</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-card to-accent/10">
              <CardTitle className="flex items-center gap-3 text-lg font-bold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                User Permissions Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                        <Select
                          value={user.role}
                          onValueChange={(value: 'Admin' | 'Analyst' | 'Viewer') => 
                            handleUserRoleChange(user.id, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Analyst">Analyst</SelectItem>
                            <SelectItem value="Viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1">
                          {user.canViewLogs ? (
                            <Shield className="w-3 h-3 text-green-500" />
                          ) : (
                            <Shield className="w-3 h-3 text-gray-400" />
                          )}
                          <span className={user.canViewLogs ? 'text-green-600' : 'text-gray-400'}>
                            View
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {user.canClassifyLogs ? (
                            <Brain className="w-3 h-3 text-blue-500" />
                          ) : (
                            <Brain className="w-3 h-3 text-gray-400" />
                          )}
                          <span className={user.canClassifyLogs ? 'text-blue-600' : 'text-gray-400'}>
                            Classify
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {user.canManageAlerts ? (
                            <AlertCircle className="w-3 h-3 text-red-500" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-gray-400" />
                          )}
                          <span className={user.canManageAlerts ? 'text-red-600' : 'text-gray-400'}>
                            Alerts
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-card to-accent/10">
              <CardTitle className="flex items-center gap-3 text-lg font-bold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <SettingsIcon className="w-5 h-5 text-primary" />
                </div>
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-3">Data Retention</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Log Retention Period</Label>
                      <Select defaultValue="90">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Alert History Retention</Label>
                      <Select defaultValue="365">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                          <SelectItem value="730">2 years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-3">Notifications</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch id="email-alerts" defaultChecked />
                      <Label htmlFor="email-alerts">Email alerts for high-severity threats</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="model-updates" defaultChecked />
                      <Label htmlFor="model-updates">Notify when model retraining completes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="system-health" />
                      <Label htmlFor="system-health">System health notifications</Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-3">System Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">Log Ingestion</p>
                        <p className="text-sm text-green-600">Active</p>
                      </div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">ML Model</p>
                        <p className="text-sm text-green-600">Running</p>
                      </div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">Alert System</p>
                        <p className="text-sm text-green-600">Operational</p>
                      </div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">Database</p>
                        <p className="text-sm text-green-600">Connected</p>
                      </div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}