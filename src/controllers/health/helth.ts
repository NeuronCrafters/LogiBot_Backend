import { Request, Response } from 'express';
import { getCorsInfo } from '../../config/cors/ccorsConfig';
import os from 'os';

/**
 * Controller para Health Check do sistema
 * 
 * Fornece informações detalhadas sobre o status da aplicação,
 * recursos do sistema e configurações ativas.
 */

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

/**
 * Formata bytes em formato legível
 */
const formatBytes = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
};

/**
 * Verifica status da conexão com o banco de dados
 */
const getDatabaseStatus = (): 'connected' | 'disconnected' | 'unknown' => {
  try {
    // Aqui você pode verificar a conexão real com o MongoDB
    // Por exemplo, usando mongoose.connection.readyState
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting

    // Por enquanto, retornamos 'unknown' - você pode implementar a verificação específica
    return 'unknown';
  } catch (error) {
    return 'disconnected';
  }
};

/**
 * Endpoint principal de health check
 */
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

    // Log do health check (opcional, para monitoramento)
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

/**
 * Endpoint simplificado de health check (apenas status)
 */
export const simpleHealthCheck = (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
};

/**
 * Endpoint para verificação de prontidão (readiness probe)
 * Usado principalmente em ambientes de containers/Kubernetes
 */
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