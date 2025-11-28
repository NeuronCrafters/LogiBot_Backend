import { Request, Response } from 'express';
import { getCorsInfo } from '../../config/cors/ccorsConfig';
import os from 'os';

interface HealthCheckResponse {
  status: 'OK' | 'WARNING' | 'ERROR';
  timestamp: string;
  uptime: number;
  environment: string;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    memory: {
      used: string;
      total: string;
      percentage: string;
    };
    cpu: {
      cores: number;
      loadAverage: number[];
    };
  };
  cors: {
    status: string;
    allowedOrigins: number;
  };
  database: {
    status: 'connected' | 'disconnected' | 'unknown';
  };
}

const formatBytes = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
};

const getDatabaseStatus = (): 'connected' | 'disconnected' | 'unknown' => {
  try {
    return 'unknown';
  } catch (error) {
    return 'disconnected';
  }
};

export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const corsInfo = getCorsInfo();
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const healthData: HealthCheckResponse = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: {
          used: formatBytes(usedMemory),
          total: formatBytes(totalMemory),
          percentage: `${Math.round((usedMemory / totalMemory) * 100)}%`
        },
        cpu: {
          cores: os.cpus().length,
          loadAverage: os.loadavg()
        }
      },
      cors: {
        status: corsInfo.status,
        allowedOrigins: corsInfo.totalOrigins
      },
      database: {
        status: getDatabaseStatus()
      }
    };

    if (req.query.verbose === 'true') {
      console.log('🏥 Health check solicitado:', {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: healthData.timestamp
      });
    }

    res.status(200).json(healthData);

  } catch (error) {
    console.error('❌ Erro no health check:', error);

    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Falha na verificação de saúde do sistema',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
};

export const simpleHealthCheck = (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
};

export const readinessCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const dbStatus = getDatabaseStatus();

    if (dbStatus === 'connected') {
      res.status(200).json({
        status: 'READY',
        timestamp: new Date().toISOString(),
        services: {
          database: 'healthy'
        }
      });
    } else {
      res.status(503).json({
        status: 'NOT_READY',
        timestamp: new Date().toISOString(),
        services: {
          database: dbStatus
        }
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'NOT_READY',
      timestamp: new Date().toISOString(),
      error: 'Erro na verificação de prontidão'
    });
  }
};