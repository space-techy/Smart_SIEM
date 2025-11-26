import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RotateCcw, Save, RefreshCw, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { LogEntry, MLFeedback } from '../types';
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

export function MLFeedback() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<MLFeedback[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [mlMetrics, setMlMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Fetch alerts and ML metrics from backend
  useEffect(() => {
    loadAlerts();
    loadMLMetrics();
  }, []);

  const loadMLMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const metrics = await api.evaluateModel();
      if (metrics && metrics.ok) {
        setMlMetrics(metrics);
        console.log('[ML METRICS]', metrics);
      }
    } catch (error) {
      console.error('Failed to load ML metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const alerts = await api.getAlerts(100);
      // Transform to log entry format
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
        isCorrect: alert.label ? true : undefined,
        // ML Prediction data
        mlScore: alert.predicted_score != null ? (alert.predicted_score * 10).toFixed(2) : null,
        mlLabel: alert.predicted_label || null,
        _original: alert
      }));
      setLogs(transformed);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get logs that need correction (misclassified or unclassified)
  const logsNeedingCorrection = logs.filter(log => 
    !log.classification || log.isCorrect === false
  );

  const handleCorrection = async (logId: string, correction: 'Malicious' | 'Non-Malicious') => {
    const log = logs.find(l => l.id === logId);
    if (!log) return;

    const label = correction === 'Malicious' ? 'malicious' : 'safe';

    try {
      // Update UI immediately
    setLogs(prevLogs =>
      prevLogs.map(l =>
          l.id === logId ? { ...l, classification: correction, isCorrect: true, classifying: true } : l
      )
    );

      // Send to backend
      await api.classifyAlert(logId, label);

      // Update feedback
    setFeedback(prevFeedback => {
      const existingIndex = prevFeedback.findIndex(f => f.logId === logId);
      const newFeedback: MLFeedback = {
        logId,
        originalClassification: log.threatLevel,
        correctedClassification: correction,
        analystId: 'analyst-1',
        timestamp: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        const updated = [...prevFeedback];
        updated[existingIndex] = newFeedback;
        return updated;
      } else {
        return [...prevFeedback, newFeedback];
      }
    });

    setHasUnsavedChanges(true);
      
      // Update with success
      setLogs(prevLogs =>
        prevLogs.map(l =>
          l.id === logId ? { ...l, classifying: false } : l
        )
      );
      
      console.log(`Alert ${logId} classified as ${label}`);
    } catch (error) {
      console.error('Classification failed:', error);
      // Revert on error
      setLogs(prevLogs =>
        prevLogs.map(l =>
          l.id === logId ? { ...l, classification: undefined, isCorrect: undefined, classifying: false } : l
        )
      );
      alert('Failed to classify alert. Please try again.');
    }
  };

  const handleSaveFeedback = () => {
    // In a real application, this would send the feedback to the backend
    console.log('Saving ML feedback:', feedback);
    toast.success(`Saved ${feedback.length} feedback entries for model retraining`);
    setFeedback([]);
    setHasUnsavedChanges(false);
  };

  const handleResetFeedback = () => {
    setFeedback([]);
    setHasUnsavedChanges(false);
    toast.info('Feedback reset');
  };

  // Use real ML metrics if available, otherwise fallback to UI state
  const correctClassifications = mlMetrics?.metrics?.correct || logs.filter(log => log.isCorrect === true).length;
  const incorrectClassifications = mlMetrics?.metrics?.incorrect || logs.filter(log => log.isCorrect === false).length;
  const unclassifiedLogs = logs.filter(log => !log.classification).length;
  const totalEvaluated = mlMetrics?.evaluated || logs.length;
  const accuracy = mlMetrics?.metrics?.accuracy || (correctClassifications / (correctClassifications + incorrectClassifications || 1));

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="border-b pb-4">
          <div className="flex items-center justify-between">
        <div>
              <h1 className="text-2xl font-semibold">ML Model Feedback</h1>
              <p className="text-sm text-gray-600 mt-1">
                Review and improve ML classifications with human feedback
              </p>
        </div>
            <div className="flex gap-2">
              <Button 
                onClick={loadAlerts} 
                disabled={loading}
                variant="outline"
                size="default"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
          {hasUnsavedChanges && (
            <>
                  <Button 
                    variant="outline" 
                    onClick={handleResetFeedback}
                  >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
                  <Button 
                    onClick={handleSaveFeedback}
                    variant="outline"
                  >
                <Save className="w-4 h-4 mr-2" />
                    Save ({feedback.length})
              </Button>
            </>
          )}
            </div>
        </div>
      </div>

      {/* Model Performance Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-b pb-6">
          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Accuracy</h3>
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="text-2xl font-semibold">
              {loadingMetrics ? '...' : `${(accuracy * 100).toFixed(1)}%`}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {mlMetrics ? '✓ Real ML performance' : 'UI state only'}
            </p>
          </div>
          
          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Correct</h3>
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="text-2xl font-semibold">{correctClassifications}</div>
            <p className="text-xs text-gray-600 mt-1">Predictions</p>
          </div>
          
          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Incorrect</h3>
              <XCircle className="w-5 h-5" />
            </div>
            <div className="text-2xl font-semibold">{incorrectClassifications}</div>
            <p className="text-xs text-gray-600 mt-1">
              {mlMetrics?.metrics?.f1_score ? `F1: ${(mlMetrics.metrics.f1_score * 100).toFixed(0)}%` : 'Errors'}
            </p>
          </div>
          
          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Unclassified</h3>
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="text-2xl font-semibold">{unclassifiedLogs}</div>
            <p className="text-xs text-gray-600 mt-1">Pending review</p>
          </div>
        </div>

        {/* Detailed ML Metrics */}
        {mlMetrics && mlMetrics.metrics && (
          <div className="border">
            <div className="border-b p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Real ML Model Performance</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Evaluated on {mlMetrics.evaluated} alerts with human labels
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={loadMLMetrics}
                  disabled={loadingMetrics}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingMetrics ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border p-4">
                  <div className="text-xs font-medium text-gray-600 uppercase mb-2">Accuracy</div>
                  <div className="text-2xl font-semibold">
                    {(mlMetrics.metrics.accuracy * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {mlMetrics.metrics.correct}/{mlMetrics.metrics.total_evaluated} correct
                  </div>
                </div>
                
                <div className="border p-4">
                  <div className="text-xs font-medium text-gray-600 uppercase mb-2">Precision</div>
                  <div className="text-2xl font-semibold">
                    {(mlMetrics.metrics.precision * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600 mt-1">True positives</div>
                </div>
                
                <div className="border p-4">
                  <div className="text-xs font-medium text-gray-600 uppercase mb-2">Recall</div>
                  <div className="text-2xl font-semibold">
                    {(mlMetrics.metrics.recall * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Detection rate</div>
      </div>
                
                <div className="border p-4">
                  <div className="text-xs font-medium text-gray-600 uppercase mb-2">F1 Score</div>
                  <div className="text-2xl font-semibold">
                    {(mlMetrics.metrics.f1_score * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Harmonic mean</div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Feedback Queue */}
      {hasUnsavedChanges && (
          <div className="border">
            <div className="border-b p-4 bg-gray-50">
              <div className="flex items-center gap-3">
                <Save className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-semibold">Pending Feedback</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {feedback.length} {feedback.length === 1 ? 'correction' : 'corrections'} ready to save
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
              {feedback.map((f, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full border flex items-center justify-center font-medium text-xs">
                        {index + 1}
                      </div>
                      <div>
                        <span className="text-sm">Alert {f.logId.substring(0, 12)}...</span>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {f.originalClassification} → {f.correctedClassification}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
            </div>
          </div>
      )}

      {/* Logs Needing Correction */}
        <div className="border">
          <div className="border-b p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Logs Requiring Review</h3>
              <span className="text-sm text-gray-600">
                {logsNeedingCorrection.length} pending
              </span>
            </div>
          </div>
          <div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="ml-3 text-sm text-gray-600">Loading...</span>
            </div>
          ) : logsNeedingCorrection.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">All logs classified</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="font-medium">Timestamp</TableHead>
                    <TableHead className="font-medium">Source</TableHead>
                    <TableHead className="font-medium">ML Score</TableHead>
                    <TableHead className="font-medium">ML Prediction</TableHead>
                    <TableHead className="font-medium">Description</TableHead>
                    {/* <TableHead className="font-medium">Current Status</TableHead> */}
                    <TableHead className="font-medium">Correct Classification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsNeedingCorrection.map((log) => (
                    <TableRow key={log.id} className="border-b">
                      <TableCell className="font-mono text-xs">{log.timestamp}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{log.sourceIp}</div>
                          <div className="text-xs text-gray-600">{log.hostname}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.mlScore ? (
                          <Badge className={getMLScoreColor(parseFloat(log.mlScore))}>
                            {log.mlScore}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getThreatLevelColor(log.threatLevel)}>
                          {log.threatLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-sm">
                        <div className="truncate text-sm" title={log.description}>
                          {log.description}
                        </div>
                      </TableCell>
                      {/* <TableCell>
                        {log.classification ? (
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
                        ) : (
                          <Badge variant="outline" className="text-xs">Unclassified</Badge>
                        )}
                      </TableCell> */}
                      <TableCell>
                        {log.classification ? (
                          <div className="flex flex-col gap-2 min-w-[140px]">
                            <Badge variant="secondary" className="text-xs">
                              {log.classification === 'Malicious' ? 'Marked as Malicious' : 'Marked as Safe'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => handleCorrection(
                                log.id, 
                                log.classification === 'Malicious' ? 'Non-Malicious' : 'Malicious'
                              )}
                              disabled={log.classifying}
                            >
                              {log.classification === 'Malicious' ? 'Change to Safe' : 'Change to Malicious'}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                              className="h-8 text-xs"
                            onClick={() => handleCorrection(log.id, 'Malicious')}
                              disabled={log.classifying}
                          >
                            Malicious
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                              className="h-8 text-xs"
                            onClick={() => handleCorrection(log.id, 'Non-Malicious')}
                              disabled={log.classifying}
                          >
                            Safe
                          </Button>
                        </div>
                        )}
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