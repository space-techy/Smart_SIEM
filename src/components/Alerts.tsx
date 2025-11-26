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
          // Map label from backend
          classification: alert.label === 'malicious' ? 'Malicious' : alert.label === 'safe' ? 'Non-Malicious' : undefined,
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
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Alerts</h1>
          <p className="text-muted-foreground">Monitor and manage security alerts</p>
        </div>
        <Button onClick={loadAlerts} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active</CardTitle>
            <AlertTriangle className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertCounts.Total}</div>
            <p className="text-xs text-muted-foreground">Alerts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Severity</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertCounts.High}</div>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moderate</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertCounts.Moderate}</div>
            <p className="text-xs text-muted-foreground">Warning</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Severity</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertCounts.Low}</div>
            <p className="text-xs text-muted-foreground">Info</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Active Alerts ({activeAlerts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading...</span>
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-sm">No active alerts</p>
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


      {/* Acknowledged Alerts */}
      {acknowledgedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acknowledged Alerts ({acknowledgedAlerts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                        <TableCell className="font-medium">{alert.title}</TableCell>
                    <TableCell className="max-w-md">{alert.description}</TableCell>
                        <TableCell className="font-mono text-xs">{alert.timestamp}</TableCell>
                    <TableCell>
                          <Badge variant="secondary">Acknowledged</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}