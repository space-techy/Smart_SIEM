import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Eye, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { LogEntry } from '../types';
import { api } from '../services/api';

const getThreatLevelColor = (level: string) => {
  switch (level) {
    case 'High': return 'bg-red-500 text-white';
    case 'Moderate': return 'bg-orange-500 text-white';
    case 'Low': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

const getMLScoreColor = (score: number) => {
  // Score is 0.00-10.00, color code from green (0) to red (10)
  if (score >= 8.0) return 'bg-red-500 text-white';
  if (score >= 6.0) return 'bg-orange-500 text-white';
  if (score >= 4.0) return 'bg-yellow-500 text-white';
  if (score >= 2.0) return 'bg-blue-500 text-white';
  return 'bg-green-500 text-white';
};

const getThreatLevelIcon = (level: string) => {
  switch (level) {
    case 'High': return <AlertTriangle className="w-4 h-4" />;
    case 'Moderate': return <AlertTriangle className="w-4 h-4" />;
    case 'Low': return <CheckCircle className="w-4 h-4" />;
    default: return null;
  }
};

export function Dashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [threatFilter, setThreatFilter] = useState<string>('all');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Fetch alerts from backend
  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const alerts = await api.getAlerts(100);
      // Transform Wazuh alerts to frontend format
      const transformed = alerts.map((alert: any) => ({
        id: alert._id || alert.id,
        timestamp: alert.timestamp || alert.timestamp_raw || new Date().toISOString(),
        sourceIp: alert.agent?.ip || alert.data?.srcip || '-',
        hostname: alert.agent?.name || alert.predecoder?.hostname || '-',
        logType: alert.decoder?.name || alert.location || 'Unknown',
        threatLevel: alert.rule?.level >= 7 ? 'High' : alert.rule?.level >= 4 ? 'Moderate' : 'Low',
        description: alert.rule?.description || alert.full_log?.substring(0, 100) || 'No description',
        rawLog: alert.full_log || JSON.stringify(alert, null, 2),
        // Map label from backend to classification
        classification: alert.label === 'malicious' ? 'Malicious' : alert.label === 'safe' ? 'Non-Malicious' : undefined,
        isCorrect: undefined,
        // ML Prediction data (scale 0.0-1.0 to 0.00-10.00)
        mlScore: alert.predicted_score != null ? (alert.predicted_score * 10).toFixed(2) : null,
        mlLabel: alert.predicted_label || null,
        // Keep original alert data
        _original: alert
      }));
      setLogs(transformed);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.sourceIp.includes(searchTerm) ||
                           log.hostname.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesThreat = threatFilter === 'all' || log.threatLevel === threatFilter;
      const matchesType = logTypeFilter === 'all' || log.logType === logTypeFilter;
      
      return matchesSearch && matchesThreat && matchesType;
    });
  }, [logs, searchTerm, threatFilter, logTypeFilter]);

  const handleClassification = async (logId: string, classification: 'Malicious' | 'Non-Malicious') => {
    const label = classification === 'Malicious' ? 'malicious' : 'safe';
    
    try {
      // Update UI immediately for better UX
      setLogs(prevLogs =>
        prevLogs.map(log =>
          log.id === logId ? { ...log, classification, classifying: true } : log
        )
      );
      
      // Send to backend
      await api.classifyAlert(logId, label);
      
      // Update with success
      setLogs(prevLogs =>
        prevLogs.map(log =>
          log.id === logId ? { ...log, classification, classifying: false } : log
        )
      );
      
      console.log(`Alert ${logId} classified as ${label}`);
    } catch (error) {
      console.error('Classification failed:', error);
      // Revert on error
    setLogs(prevLogs =>
      prevLogs.map(log =>
          log.id === logId ? { ...log, classification: undefined, classifying: false } : log
      )
    );
      alert('Failed to classify alert. Please try again.');
    }
  };

  const logTypes = [...new Set(logs.map(log => log.logType))];

  const threatCounts = {
    High: logs.filter(log => log.threatLevel === 'High').length,
    Moderate: logs.filter(log => log.threatLevel === 'Moderate').length,
    Low: logs.filter(log => log.threatLevel === 'Low').length
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">Monitor and analyze security logs with ML-powered threat detection</p>
        </div>
        <Button onClick={loadAlerts} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Threat Level Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Threats</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{threatCounts.High}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moderate Threats</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{threatCounts.Moderate}</div>
            <p className="text-xs text-muted-foreground">Monitor closely</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Threats</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{threatCounts.Low}</div>
            <p className="text-xs text-muted-foreground">Routine monitoring</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={threatFilter} onValueChange={setThreatFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Threat Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Threats</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Moderate">Moderate</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Log Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {logTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Security Logs ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-orange-500 opacity-50" />
              <p className="text-sm">No alerts found</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm mb-4">No matching alerts</p>
              <Button 
                onClick={() => {
                  setSearchTerm('');
                  setThreatFilter('all');
                  setLogTypeFilter('all');
                }}
                variant="outline"
                size="sm"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>ML Score</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-xs">{log.timestamp}</TableCell>
                    <TableCell className="py-4">
                      <div className="space-y-1">
                        <div className="font-medium">{log.sourceIp}</div>
                        <div className="text-sm text-muted-foreground">{log.hostname}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{log.logType}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getThreatLevelColor(log.threatLevel)} variant="outline">
                        {log.threatLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.mlScore ? (
                        <div className="flex flex-col gap-1">
                          <Badge className={getMLScoreColor(parseFloat(log.mlScore))}>
                            {log.mlScore}
                          </Badge>
                          {log.mlLabel && (
                            <span className="text-xs text-muted-foreground capitalize">
                              {log.mlLabel}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={log.description}>
                      {log.description}
                    </TableCell>
                    <TableCell className="py-4">
                      {log.classification ? (
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          <Badge 
                            variant={log.classification === 'Malicious' ? 'destructive' : 'secondary'} 
                            className="px-3 py-2 justify-center"
                          >
                            {log.classification === 'Malicious' ? (
                              <><XCircle className="w-3 h-3 mr-1" /> Marked as Malicious</>
                            ) : (
                              <><CheckCircle className="w-3 h-3 mr-1" /> Marked as Safe</>
                            )}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className={
                              log.classification === 'Malicious' 
                                ? "text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300 h-9 font-medium transition-all"
                                : "text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 h-9 font-medium transition-all"
                            }
                            onClick={() => handleClassification(
                              log.id, 
                              log.classification === 'Malicious' ? 'Non-Malicious' : 'Malicious'
                            )}
                            disabled={log.classifying}
                          >
                            {log.classification === 'Malicious' ? (
                              <><CheckCircle className="w-3.5 h-3.5 mr-2" /> Change to Safe</>
                            ) : (
                              <><XCircle className="w-3.5 h-3.5 mr-2" /> Change to Malicious</>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 min-w-[180px]">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 h-9 font-medium transition-all"
                            onClick={() => handleClassification(log.id, 'Malicious')}
                            disabled={log.classifying}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-2" />
                            Mark Malicious
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300 h-9 font-medium transition-all"
                            onClick={() => handleClassification(log.id, 'Non-Malicious')}
                            disabled={log.classifying}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-2" />
                            Mark Safe
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="w-4 h-4 mr-1.5" />
                            View
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>Log Details</DialogTitle>
                        </DialogHeader>
                        {selectedLog && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Timestamp</label>
                                <p className="font-mono text-sm mt-1">{selectedLog.timestamp}</p>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Source IP</label>
                                <p className="text-sm mt-1">{selectedLog.sourceIp}</p>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Hostname</label>
                                <p className="text-sm mt-1">{selectedLog.hostname}</p>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Log Type</label>
                                <p className="text-sm mt-1">{selectedLog.logType}</p>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Threat Level</label>
                                <Badge className={getThreatLevelColor(selectedLog.threatLevel) + " mt-1"}>
                                      {selectedLog.threatLevel}
                                  </Badge>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Classification</label>
                                <p className="text-sm mt-1">{selectedLog.classification || 'Unclassified'}</p>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Description</label>
                              <p className="text-sm mt-1">{selectedLog.description}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Raw Log</label>
                              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto mt-1">
                                {selectedLog.rawLog}
                              </pre>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}