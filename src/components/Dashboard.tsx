import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Eye, AlertTriangle, CheckCircle, XCircle, RefreshCw, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [mlScoreSort, setMlScoreSort] = useState<string>('none'); // 'none', 'high-to-low', 'low-to-high'
  const [timestampSort, setTimestampSort] = useState<string>('newest'); // 'none', 'newest', 'oldest'
  const [levelSort, setLevelSort] = useState<string>('none'); // 'none', 'high-to-low', 'low-to-high'
  const [showFilters, setShowFilters] = useState<boolean>(false);
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

  const filteredAndSortedLogs = useMemo(() => {
    // First, filter the logs
    let filtered = logs.filter(log => {
      const matchesSearch = searchTerm === '' || 
                           log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.sourceIp.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.hostname.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesThreat = threatFilter === 'all' || log.threatLevel === threatFilter;
      const matchesType = logTypeFilter === 'all' || log.logType === logTypeFilter;
      const matchesSource = sourceFilter === 'all' || 
                           log.sourceIp === sourceFilter || 
                           log.hostname === sourceFilter ||
                           `${log.sourceIp} (${log.hostname})` === sourceFilter;
      
      return matchesSearch && matchesThreat && matchesType && matchesSource;
    });

    // Then, sort the filtered logs - apply all sorts in priority order
    let sorted = [...filtered];

    // Multi-level sorting: apply all sorts together
    sorted.sort((a, b) => {
      // Priority 1: Sort by Level (if enabled)
      if (levelSort !== 'none') {
        const levelOrder = { 'High': 3, 'Moderate': 2, 'Low': 1 };
        const aLevel = levelOrder[a.threatLevel as keyof typeof levelOrder] || 0;
        const bLevel = levelOrder[b.threatLevel as keyof typeof levelOrder] || 0;
        const levelDiff = levelSort === 'high-to-low' ? bLevel - aLevel : aLevel - bLevel;
        if (levelDiff !== 0) return levelDiff;
      }

      // Priority 2: Sort by ML Score (if enabled)
      if (mlScoreSort !== 'none') {
        const scoreA = a.mlScore ? parseFloat(a.mlScore) : (mlScoreSort === 'high-to-low' ? -1 : 999);
        const scoreB = b.mlScore ? parseFloat(b.mlScore) : (mlScoreSort === 'high-to-low' ? -1 : 999);
        const scoreDiff = mlScoreSort === 'high-to-low' ? scoreB - scoreA : scoreA - scoreB;
        if (scoreDiff !== 0) return scoreDiff;
      }

      // Priority 3: Sort by Timestamp (always applied as tiebreaker)
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timestampSort === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return sorted;
  }, [logs, searchTerm, threatFilter, logTypeFilter, sourceFilter, mlScoreSort, timestampSort, levelSort]);

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

  const logTypes = useMemo(() => [...new Set(logs.map(log => log.logType))].sort(), [logs]);
  const allSources = useMemo(() => {
    const sources = new Set<string>();
    logs.forEach(log => {
      if (log.sourceIp && log.sourceIp !== '-') {
        sources.add(log.sourceIp);
      }
      if (log.hostname && log.hostname !== '-') {
        sources.add(log.hostname);
      }
      // Also add combined format
      if (log.sourceIp && log.sourceIp !== '-' && log.hostname && log.hostname !== '-') {
        sources.add(`${log.sourceIp} (${log.hostname})`);
      }
    });
    return Array.from(sources).sort();
  }, [logs]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setThreatFilter('all');
    setLogTypeFilter('all');
    setSourceFilter('all');
    setMlScoreSort('none');
    setTimestampSort('newest');
    setLevelSort('none');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm !== '') count++;
    if (threatFilter !== 'all') count++;
    if (logTypeFilter !== 'all') count++;
    if (sourceFilter !== 'all') count++;
    if (mlScoreSort !== 'none') count++;
    if (timestampSort !== 'newest') count++;
    if (levelSort !== 'none') count++;
    return count;
  }, [searchTerm, threatFilter, logTypeFilter, sourceFilter, mlScoreSort, timestampSort, levelSort]);

  const hasActiveFilters = activeFilterCount > 0;

  const threatCounts = {
    High: logs.filter(log => log.threatLevel === 'High').length,
    Moderate: logs.filter(log => log.threatLevel === 'Moderate').length,
    Low: logs.filter(log => log.threatLevel === 'Low').length
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="border-b pb-4">
      <div className="flex items-center justify-between">
        <div>
              <h1 className="text-2xl font-semibold">Security Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Real-time threat monitoring and analysis
              </p>
            </div>
            <Button 
              onClick={loadAlerts} 
              disabled={loading} 
              variant="outline"
              size="default"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Threat Level Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-6">
          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">High Threats</h3>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-2xl font-semibold">{threatCounts.High}</div>
            <p className="text-xs text-gray-600 mt-1">Requires immediate attention</p>
      </div>

          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Moderate Threats</h3>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-2xl font-semibold">{threatCounts.Moderate}</div>
            <p className="text-xs text-gray-600 mt-1">Monitor closely</p>
          </div>
          
          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Low Threats</h3>
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="text-2xl font-semibold">{threatCounts.Low}</div>
            <p className="text-xs text-gray-600 mt-1">Routine monitoring</p>
          </div>
      </div>

      {/* Filters Toggle Button and Quick Search */}
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Quick search by description, IP, or hostname..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

      {/* Collapsible Filters Panel */}
        {showFilters && (
          <div className="border p-4 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Threat Level</label>
                <Select value={threatFilter} onValueChange={setThreatFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Moderate">Moderate</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Log Type</label>
                <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {logTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Source IP / Hostname</label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {allSources.slice(0, 100).map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Sort by Level</label>
                <Select value={levelSort} onValueChange={setLevelSort}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Sort</SelectItem>
                    <SelectItem value="high-to-low">High → Low</SelectItem>
                    <SelectItem value="low-to-high">Low → High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Sort by ML Score</label>
                <Select value={mlScoreSort} onValueChange={setMlScoreSort}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Sort</SelectItem>
                    <SelectItem value="high-to-low">High to Low (10 → 0)</SelectItem>
                    <SelectItem value="low-to-high">Low to High (0 → 10)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Sort by Timestamp</label>
                <Select value={timestampSort} onValueChange={setTimestampSort}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Newest First" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

      {/* Logs Table */}
        <div className="border">
          <div className="border-b p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Security Logs</h3>
              <span className="text-sm text-gray-600">
                {filteredAndSortedLogs.length} {filteredAndSortedLogs.length === 1 ? 'log' : 'logs'}
                {hasActiveFilters && ` (filtered from ${logs.length} total)`}
              </span>
            </div>
          </div>
          <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin mb-2" />
              <span className="text-sm text-gray-600">Loading security logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium mb-1">No alerts found</p>
              <p className="text-xs text-gray-600">Send alerts to the backend to see them here</p>
            </div>
          ) : filteredAndSortedLogs.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium mb-1">No matching alerts</p>
              <p className="text-xs text-gray-600 mb-4">Try adjusting your filters</p>
              <Button 
                onClick={clearAllFilters}
                variant="outline"
                size="sm"
              >
                <X className="w-3 h-3 mr-1" />
                Clear All Filters
              </Button>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="font-medium">
                    <div className="flex items-center gap-1">
                      Timestamp
                      {timestampSort === 'newest' && <ArrowDown className="w-3 h-3" />}
                      {timestampSort === 'oldest' && <ArrowUp className="w-3 h-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="font-medium">Source</TableHead>
                  <TableHead className="font-medium">Type</TableHead>
                  <TableHead className="font-medium">
                    <div className="flex items-center gap-1">
                      Level
                      {levelSort === 'high-to-low' && <ArrowDown className="w-3 h-3" />}
                      {levelSort === 'low-to-high' && <ArrowUp className="w-3 h-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="font-medium">
                    <div className="flex items-center gap-1">
                      ML Score
                      {mlScoreSort === 'high-to-low' && <ArrowDown className="w-3 h-3" />}
                      {mlScoreSort === 'low-to-high' && <ArrowUp className="w-3 h-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="font-medium">Description</TableHead>
                  <TableHead className="font-medium">Classification</TableHead>
                  <TableHead className="font-medium text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedLogs.map((log) => (
                  <TableRow 
                    key={log.id} 
                    className="border-b"
                  >
                    <TableCell className="font-mono text-xs text-gray-600">
                      {new Date(log.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="text-sm">{log.sourceIp}</div>
                        <div className="text-xs text-gray-600">{log.hostname}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono">{log.logType}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getThreatLevelColor(log.threatLevel)}>
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
                            <span className="text-xs text-gray-600 capitalize">
                              {log.mlLabel}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Pending</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate text-sm" title={log.description}>
                        {log.description}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.classification ? (
                        <div className="flex flex-col gap-2 min-w-[140px]">
                          <Badge 
                            variant={log.classification === 'Malicious' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {log.classification === 'Malicious' ? (
                              <><XCircle className="w-3 h-3 mr-1" /> Malicious</>
                            ) : (
                              <><CheckCircle className="w-3 h-3 mr-1" /> Safe</>
                            )}
                        </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => handleClassification(
                              log.id, 
                              log.classification === 'Malicious' ? 'Non-Malicious' : 'Malicious'
                            )}
                            disabled={log.classifying}
                          >
                            {log.classification === 'Malicious' ? 'Change to Safe' : 'Change to Malicious'}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 min-w-[140px]">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => handleClassification(log.id, 'Malicious')}
                            disabled={log.classifying}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Mark Malicious
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => handleClassification(log.id, 'Non-Malicious')}
                            disabled={log.classifying}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Mark Safe
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
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
          </div>
        </div>
      </div>
    </div>
  );
}