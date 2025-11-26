import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, Brain, Clock, Shield, Save, AlertCircle, RefreshCw, RotateCcw, History, Play } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { api } from '../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';

interface MLSettings {
  retrain_interval_value: number;
  retrain_interval_unit: 'minutes' | 'hours';
  confidence_threshold: number;
  auto_classify: boolean;
  alert_threshold: string;
  scheduler_enabled: boolean;
}

interface ModelVersion {
  version_id: string;
  filename: string;
  path: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
  training_samples: number;
  created_at: string;
  is_production: boolean;
  promoted_at?: string;
  file_size_mb?: number;
}

export function Settings() {
  const [mlSettings, setMLSettings] = useState<MLSettings>({
    retrain_interval_value: 24,
    retrain_interval_unit: 'hours',
    confidence_threshold: 0.85,
    auto_classify: false,
    alert_threshold: 'moderate',
    scheduler_enabled: true
  });

  const [mlStatus, setMlStatus] = useState<any>(null);
  const [modelVersions, setModelVersions] = useState<ModelVersion[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [training, setTraining] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  // Load settings and status on mount
  useEffect(() => {
    loadSettings();
    loadMLStatus();
    loadModelVersions();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await api.getMLSettings();
      if (settings) {
        // Convert to UI format
        const uiSettings: MLSettings = {
          retrain_interval_value: settings.retrain_interval_value || settings.retrain_interval_hours || 24,
          retrain_interval_unit: settings.retrain_interval_unit || 'hours',
          confidence_threshold: settings.confidence_threshold || 0.85,
          auto_classify: settings.auto_classify || false,
          alert_threshold: settings.alert_threshold || 'moderate',
          scheduler_enabled: settings.scheduler_enabled !== false
        };
        setMLSettings(uiSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadMLStatus = async () => {
    try {
      const status = await api.getMLStatus();
      if (status) {
        setMlStatus(status);
      }
    } catch (error) {
      console.error('Failed to load ML status:', error);
    }
  };

  const loadModelVersions = async () => {
    try {
      const data = await api.listModelVersions(20);
      if (data && data.versions) {
        setModelVersions(data.versions);
      }
    } catch (error) {
      console.error('Failed to load model versions:', error);
    }
  };

  const handleMLSettingChange = (key: keyof MLSettings, value: any) => {
    setMLSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Convert to backend format
      const backendSettings: any = {
        retrain_interval_value: mlSettings.retrain_interval_value,
        retrain_interval_unit: mlSettings.retrain_interval_unit,
        confidence_threshold: mlSettings.confidence_threshold,
        auto_classify: mlSettings.auto_classify,
        alert_threshold: mlSettings.alert_threshold,
        scheduler_enabled: mlSettings.scheduler_enabled
      };

      await api.updateMLSettings(backendSettings);
      toast.success('Settings saved successfully');
      setHasUnsavedChanges(false);
      
      // Reload status to reflect changes
      await loadMLStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerTraining = async () => {
    setTraining(true);
    try {
      const result = await api.triggerTraining();
      toast.success(result?.result?.message || 'Training started');
      // Reload versions and status after training
      setTimeout(() => {
        loadModelVersions();
        loadMLStatus();
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to trigger training');
    } finally {
      setTraining(false);
    }
  };

  const handleRollback = async (versionId: string) => {
    setRollingBack(versionId);
    try {
      const result = await api.rollbackModelVersion(versionId);
      toast.success(result?.message || 'Model rolled back successfully');
      // Reload versions and status
      await loadModelVersions();
      await loadMLStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to rollback model');
    } finally {
      setRollingBack(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const productionVersion = modelVersions.find(v => v.is_production);
  const accuracy = mlStatus?.production_version?.metrics?.accuracy || 0;
  const logsProcessed = mlStatus?.predictions?.predicted || 0;
  const trainingData = mlStatus?.training_data?.total || 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-gray-600 mt-1">Configure ML model parameters and user permissions</p>
          </div>
          {hasUnsavedChanges && (
            <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <span className="text-orange-700 font-medium">Unsaved changes</span>
              <Button onClick={handleSaveSettings} disabled={saving} className="h-9 px-4">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          )}
        </div>

        <Tabs defaultValue="ml-model" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="ml-model" className="flex items-center gap-2 h-10 px-6">
              <Brain className="w-4 h-4" />
              ML Model
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2 h-10 px-6">
              <Users className="w-4 h-4" />
              User Permissions
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2 h-10 px-6">
              <SettingsIcon className="w-4 h-4" />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ml-model" className="space-y-6">
            <Card>
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <Brain className="w-6 h-6" />
                  Machine Learning Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="retraining-interval" className="text-base">Retraining Interval</Label>
                    <div className="flex gap-2">
                      <Input
                        id="retraining-interval"
                        type="number"
                        min="1"
                        className="h-11 flex-1"
                        value={mlSettings.retrain_interval_value}
                        onChange={(e) => handleMLSettingChange('retrain_interval_value', parseInt(e.target.value) || 1)}
                      />
                      <Select 
                        value={mlSettings.retrain_interval_unit} 
                        onValueChange={(value: 'minutes' | 'hours') => handleMLSettingChange('retrain_interval_unit', value)}
                      >
                        <SelectTrigger className="h-11 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                      value={mlSettings.confidence_threshold}
                      onChange={(e) => handleMLSettingChange('confidence_threshold', parseFloat(e.target.value))}
                    />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Minimum confidence level for automatic classification (0.0 - 1.0)
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="alert-threshold" className="text-base">Alert Threshold</Label>
                    <Select 
                      value={mlSettings.alert_threshold} 
                      onValueChange={(value) => handleMLSettingChange('alert_threshold', value)}
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
                      checked={mlSettings.auto_classify}
                      onCheckedChange={(checked) => handleMLSettingChange('auto_classify', checked)}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="auto-classification" className="text-base">Auto-classification</Label>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Automatically classify logs above confidence threshold
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 border rounded-lg">
                    <Switch
                      id="scheduler-enabled"
                      checked={mlSettings.scheduler_enabled}
                      onCheckedChange={(checked) => handleMLSettingChange('scheduler_enabled', checked)}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="scheduler-enabled" className="text-base">Enable Scheduler</Label>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Enable automatic periodic retraining
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base">Manual Training</Label>
                    <Button
                      onClick={handleTriggerTraining}
                      disabled={training}
                      variant="outline"
                      className="w-full h-11"
                    >
                      {training ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Training...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Trigger Training Now
                        </>
                      )}
                    </Button>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Manually trigger model retraining with current labeled data
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Model Performance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-green-500">
                          {loading ? '...' : `${(accuracy * 100).toFixed(1)}%`}
                        </div>
                        <p className="text-sm text-muted-foreground">Overall Accuracy</p>
                        {productionVersion && (
                          <p className="text-xs text-gray-500 mt-1">
                            Version: {productionVersion.version_id}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-blue-500">
                          {loading ? '...' : logsProcessed.toLocaleString()}
                        </div>
                        <p className="text-sm text-muted-foreground">Logs Processed</p>
                        <p className="text-xs text-gray-500 mt-1">Total predictions</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-orange-500">
                          {loading ? '...' : trainingData.toLocaleString()}
                        </div>
                        <p className="text-sm text-muted-foreground">Training Samples</p>
                        <p className="text-xs text-gray-500 mt-1">Labeled data available</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Model Versions
                    </h3>
                    <Button
                      onClick={loadModelVersions}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  
                  {modelVersions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No model versions found</p>
                      <p className="text-sm mt-2">Train a model to see versions here</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Version ID</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Metrics</TableHead>
                            <TableHead>Training Samples</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {modelVersions.map((version) => (
                            <TableRow key={version.version_id}>
                              <TableCell className="font-mono text-xs">
                                {version.version_id}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDate(version.created_at)}
                              </TableCell>
                              <TableCell>
                                <div className="text-xs space-y-1">
                                  <div>F1: {(version.metrics?.f1_score * 100).toFixed(1)}%</div>
                                  <div>Acc: {(version.metrics?.accuracy * 100).toFixed(1)}%</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {version.training_samples.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {version.is_production ? (
                                  <Badge className="bg-green-500">Production</Badge>
                                ) : (
                                  <Badge variant="outline">Archive</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {!version.is_production && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRollback(version.version_id)}
                                    disabled={rollingBack === version.version_id}
                                  >
                                    {rollingBack === version.version_id ? (
                                      <>
                                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                        Rolling back...
                                      </>
                                    ) : (
                                      <>
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        Rollback
                                      </>
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Permissions Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  User permissions management will be available in a future update.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5" />
                  System Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">System Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">ML Model</p>
                        <p className={`text-sm ${mlStatus?.model?.loaded ? 'text-green-600' : 'text-red-600'}`}>
                          {mlStatus?.model?.loaded ? 'Running' : 'Not Loaded'}
                        </p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${mlStatus?.model?.loaded ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">Scheduler</p>
                        <p className={`text-sm ${mlStatus?.scheduler?.running ? 'text-green-600' : 'text-red-600'}`}>
                          {mlStatus?.scheduler?.running ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${mlStatus?.scheduler?.running ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
