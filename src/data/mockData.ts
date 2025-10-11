import { LogEntry, Alert } from '../types';

export const mockLogs: LogEntry[] = [
  {
    id: '1',
    timestamp: '2024-01-15 14:32:45',
    sourceIp: '192.168.1.105',
    hostname: 'WORKSTATION-01',
    logType: 'File Integrity Monitoring',
    threatLevel: 'High',
    description: 'Unauthorized modification of system file /etc/passwd',
    rawLog: 'Jan 15 14:32:45 WORKSTATION-01 ossec: Alert Level: 12; Rule: 550 - Integrity checksum changed; Location: WORKSTATION-01->/etc/passwd',
    classification: undefined,
    isCorrect: undefined
  },
  {
    id: '2',
    timestamp: '2024-01-15 14:28:12',
    sourceIp: '10.0.0.45',
    hostname: 'WEB-SERVER-02',
    logType: 'Web Attack Detection',
    threatLevel: 'Moderate',
    description: 'SQL injection attempt detected',
    rawLog: 'Jan 15 14:28:12 WEB-SERVER-02 modsecurity: Access denied with code 403 (phase 2). Pattern match "(?i:union.*select)" at ARGS:id',
    classification: 'Malicious',
    isCorrect: true
  },
  {
    id: '3',
    timestamp: '2024-01-15 14:25:33',
    sourceIp: '192.168.1.203',
    hostname: 'CLIENT-LAPTOP',
    logType: 'Login Activity',
    threatLevel: 'Low',
    description: 'Successful user login',
    rawLog: 'Jan 15 14:25:33 CLIENT-LAPTOP sshd[1234]: Accepted password for john from 192.168.1.203 port 22 ssh2',
    classification: 'Non-Malicious',
    isCorrect: true
  },
  {
    id: '4',
    timestamp: '2024-01-15 14:20:15',
    sourceIp: '203.0.113.45',
    hostname: 'EXTERNAL',
    logType: 'Privilege Escalation',
    threatLevel: 'High',
    description: 'Suspicious sudo command execution',
    rawLog: 'Jan 15 14:20:15 WORKSTATION-01 sudo: unknown : TTY=pts/0 ; PWD=/home/unknown ; USER=root ; COMMAND=/bin/bash',
    classification: undefined,
    isCorrect: undefined
  },
  {
    id: '5',
    timestamp: '2024-01-15 14:15:22',
    sourceIp: '172.16.0.88',
    hostname: 'DATABASE-01',
    logType: 'Database Activity',
    threatLevel: 'Moderate',
    description: 'Multiple failed authentication attempts',
    rawLog: 'Jan 15 14:15:22 DATABASE-01 mysql: Access denied for user "admin"@"172.16.0.88" (using password: YES)',
    classification: 'Malicious',
    isCorrect: false
  },
  {
    id: '6',
    timestamp: '2024-01-15 14:10:45',
    sourceIp: '192.168.1.15',
    hostname: 'PRINT-SERVER',
    logType: 'Network Traffic',
    threatLevel: 'Low',
    description: 'Normal print job processing',
    rawLog: 'Jan 15 14:10:45 PRINT-SERVER cups: Job 123 completed successfully',
    classification: 'Non-Malicious',
    isCorrect: true
  }
];

export const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    severity: 'High',
    title: 'Critical System File Modified',
    description: 'Unauthorized changes detected in /etc/passwd on WORKSTATION-01',
    timestamp: '2024-01-15 14:32:45',
    logId: '1',
    acknowledged: false
  },
  {
    id: 'alert-2',
    severity: 'High',
    title: 'Privilege Escalation Detected',
    description: 'Suspicious sudo activity from external IP 203.0.113.45',
    timestamp: '2024-01-15 14:20:15',
    logId: '4',
    acknowledged: false
  },
  {
    id: 'alert-3',
    severity: 'Moderate',
    title: 'Web Attack Attempt',
    description: 'SQL injection pattern detected on WEB-SERVER-02',
    timestamp: '2024-01-15 14:28:12',
    logId: '2',
    acknowledged: true
  },
  {
    id: 'alert-4',
    severity: 'Moderate',
    title: 'Authentication Failures',
    description: 'Multiple failed login attempts to DATABASE-01',
    timestamp: '2024-01-15 14:15:22',
    logId: '5',
    acknowledged: false
  }
];