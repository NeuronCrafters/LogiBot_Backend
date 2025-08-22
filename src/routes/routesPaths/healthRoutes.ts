import { Router } from 'express';
import { healthCheck, simpleHealthCheck, readinessCheck } from '../../controllers/health/helth';

/**
 * Rotas para monitoramento da saúde da aplicação
 * 
 * - /health - Health check completo com informações detalhadas
 * - /health/simple - Health check simplificado (apenas status)
 * - /health/ready - Readiness probe (para Kubernetes/containers)
 */

const router = Router();

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