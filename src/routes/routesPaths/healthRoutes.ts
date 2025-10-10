import { Router } from 'express';
import { healthCheck, simpleHealthCheck, readinessCheck } from '../../controllers/health/helth';
import { HealthCheckController } from '../../controllers/health/healthCheckController';

/**
 * Rotas para monitoramento da saúde da aplicação
 * 
 * - /health - Health check completo com informações detalhadas
 * - /health/simple - Health check simplificado (apenas status)
 * - /health/ready - Readiness probe (para Kubernetes/containers)
 */

const router = Router();
const agentsHealthController = new HealthCheckController();

/**
 * GET /health/agents
 * Verifica a conectividade e o status de todos os 20 agentes de IA externos
 * Retorna um relatório detalhado para cada agente.
 */
router.get('/health/agents', agentsHealthController.handle);

/**
 * GET /health
 * Health check completo com informações do sistema
 * 
 * Query params opcionais:
 * - verbose=true: Inclui logs detalhados
 */
router.get('/health', healthCheck);

/**
 * GET /health/simple
 * Health check simplificado - apenas status OK
 * Útil para load balancers simples
 */
router.get('/health/simple', simpleHealthCheck);

/**
 * GET /health/ready
 * Readiness probe - verifica se a aplicação está pronta para receber tráfego
 * Útil para orquestradores como Kubernetes
 */
router.get('/health/ready', readinessCheck);

/**
 * GET /ping
 * Endpoint simples para verificação de conectividade
 */
router.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

export { router as healthRoutes };