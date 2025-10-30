import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner@2.0.3';
import { Alert } from '../types';
import { api } from '../services/api';

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'High': return 'bg-red-500 text-white';
    case 'Moderate': return 'bg-orange-500 text-white';
    case 'Low': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'High': return <AlertTriangle className="w-4 h-4" />;
    case 'Moderate': return <AlertTriangle className="w-4 h-4" />;
    case 'Low': return <CheckCircle className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
};

export function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch alerts from backend
  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts(100);
      // Transform Wazuh alerts to Alert format
      const transformed = data
        .filter((alert: any) => alert.rule?.level >= 5) // Only show level 5+ as alerts
        .map((alert: any) => ({
          id: alert._id || alert.id,
          severity: alert.rule?.level >= 7 ? 'High' : alert.rule?.level >= 5 ? 'Moderate' : 'Low',
          title: alert.rule?.description || 'Security Alert',
          description: `${alert.agent?.name || 'Unknown'}: ${alert.full_log?.substring(0, 100) || 'No details'}`,
          timestamp: alert.timestamp || alert.timestamp_raw || new Date().toISOString(),
          logId: alert._id,
          acknowledged: false,
          _original: alert
        }));
      setAlerts(transformed);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = (alertId: string) => {
    setAlerts(prevAlerts =>
      prevAlerts.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
    toast.success('Alert acknowledged');
  };

  const handleIgnore = (alertId: string) => {
    setAlerts(prevAlerts =>
      prevAlerts.filter(alert => alert.id !== alertId)
    );
    toast.info('Alert ignored and removed');
  };

  const activeAlerts = alerts.filter(alert => !alert.acknowledged);
  const acknowledgedAlerts = alerts.filter(alert => alert.acknowledged);

  const alertCounts = {
    High: alerts.filter(alert => alert.severity === 'High' && !alert.acknowledged).length,
    Moderate: alerts.filter(alert => alert.severity === 'Moderate' && !alert.acknowledged).length,
    Low: alerts.filter(alert => alert.severity === 'Low' && !alert.acknowledged).length,
    Total: activeAlerts.length
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Security Alerts</h1>
          <p className="text-muted-foreground mt-2 text-base">Monitor and manage security alerts from ML threat detection</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="text-base px-4 py-2 font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-lg">
            {alertCounts.Total} Active Alerts
          </Badge>
          <Button onClick={loadAlerts} disabled={loading} variant="outline" className="shadow-sm hover:shadow-md transition-shadow">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-blue-500 bg-gradient-to-br from-card to-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Total Active</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-4xl font-bold text-blue-600 mb-1">{alertCounts.Total}</div>
            <p className="text-sm text-muted-foreground">Requiring attention</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-red-500 bg-gradient-to-br from-card to-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">High Severity</CardTitle>
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-4xl font-bold text-red-600 mb-1">{alertCounts.High}</div>
            <p className="text-sm text-muted-foreground">Critical threats</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-orange-500 bg-gradient-to-br from-card to-orange-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Moderate Severity</CardTitle>
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-4xl font-bold text-orange-600 mb-1">{alertCounts.Moderate}</div>
            <p className="text-sm text-muted-foreground">Monitor closely</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-green-500 bg-gradient-to-br from-card to-green-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Low Severity</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-4xl font-bold text-green-600 mb-1">{alertCounts.Low}</div>
            <p className="text-sm text-muted-foreground">Routine review</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-4 bg-gradient-to-r from-card to-red-50/20">
          <CardTitle className="flex items-center gap-3 text-lg font-semibold">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            Active Alerts ({activeAlerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading alerts from database...</span>
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-16 h-16 mx-auto mb-6 text-green-500" />
              <h3 className="text-lg font-medium mb-2">No active alerts!</h3>
              <p>Your system is secure.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2">
                    <TableHead className="py-4 font-medium">Severity</TableHead>
                    <TableHead className="py-4 font-medium">Alert</TableHead>
                    <TableHead className="py-4 font-medium">Description</TableHead>
                    <TableHead className="py-4 font-medium">Timestamp</TableHead>
                    <TableHead className="py-4 font-medium">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeAlerts
                    .sort((a, b) => {
                      const severityOrder = { High: 3, Moderate: 2, Low: 1 };
                      return severityOrder[b.severity as keyof typeof severityOrder] - 
                             severityOrder[a.severity as keyof typeof severityOrder];
                    })
                    .map((alert) => (
                    <TableRow key={alert.id} className={`
                      hover:bg-muted/30 transition-colors
                      ${alert.severity === 'High' ? 'border-l-4 border-l-red-500' :
                        alert.severity === 'Moderate' ? 'border-l-4 border-l-orange-500' :
                        'border-l-4 border-l-green-500'}
                    `}>
                      <TableCell className="py-5">
                        <Badge className={getSeverityColor(alert.severity) + " px-3 py-1.5"}>
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(alert.severity)}
                            {alert.severity}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium py-5">{alert.title}</TableCell>
                      <TableCell className="max-w-md py-5">
                        <div className="break-words">{alert.description}</div>
                      </TableCell>
                      <TableCell className="font-mono py-5">{alert.timestamp}</TableCell>
                      <TableCell className="py-5">
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3"
                              onClick={() => handleAcknowledge(alert.id)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Acknowledge
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-3"
                              onClick={() => handleIgnore(alert.id)}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Ignore
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 w-full justify-start"
                            onClick={() => window.open(`#/dashboard?log=${alert.logId}`, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View Log
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="bg-gradient-to-r from-card to-accent/10">
          <CardTitle className="text-lg font-semibold">Recent Alert Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:shadow-md hover:border-red-200 transition-all bg-gradient-to-r from-card to-red-50/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold">New high-severity alert detected</p>
                  <p className="text-sm text-muted-foreground">System file modification on WORKSTATION-01</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground font-medium">2 mins ago</div>
            </div>
            <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:shadow-md hover:border-green-200 transition-all bg-gradient-to-r from-card to-green-50/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold">Alert acknowledged</p>
                  <p className="text-sm text-muted-foreground">SQL injection attempt resolved</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground font-medium">15 mins ago</div>
            </div>
            <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:shadow-md hover:border-orange-200 transition-all bg-gradient-to-r from-card to-orange-50/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold">Multiple failed login attempts</p>
                  <p className="text-sm text-muted-foreground">Brute force attack detected on DATABASE-01</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground font-medium">1 hour ago</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acknowledged Alerts */}
      {acknowledgedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Acknowledged Alerts ({acknowledgedAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acknowledgedAlerts.map((alert) => (
                  <TableRow key={alert.id} className="opacity-60">
                    <TableCell>
                      <Badge className={getSeverityColor(alert.severity)} variant="outline">
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{alert.title}</TableCell>
                    <TableCell className="max-w-md">{alert.description}</TableCell>
                    <TableCell className="font-mono text-sm">{alert.timestamp}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Acknowledged
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}