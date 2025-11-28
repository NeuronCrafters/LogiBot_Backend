import { Request, Response } from "express";
import { getApiConfigs } from "../../utils/agentUtils"
import axios from "axios";

class HealthCheckController {
  async handle(req: Request, res: Response) {
    const configs = getApiConfigs();
    const healthStatus: any[] = [];

    const checkPromises = configs.map(async (config) => {
      const startTime = Date.now();
      try {
        const response = await axios.post(
          config.url,
          { model: "llama3", messages: [{ role: "user", content: "ping" }], stream: false },
          {
            headers: { 'Authorization': `Bearer ${config.key}`, 'Content-Type': 'application/json' },
            timeout: 10000
          }
        );

        const latency = Date.now() - startTime;
        if (response.status === 200) {
          return { agent: config.url.substring(0, 35) + '...', status: ' OK', latency: `${latency}ms`, details: 'Success' };
        } else {
          return { agent: config.url.substring(0, 35) + '...', status: ' FAIL', latency: `${latency}ms`, details: `HTTP ${response.status}` };
        }
      } catch (error: any) {
        const latency = Date.now() - startTime;
        return { agent: config.url.substring(0, 35) + '...', status: ' FAIL', latency: `${latency}ms`, details: error.message };
      }
    });

    const results = await Promise.all(checkPromises);

    return res.status(200).json({
      totalAgents: configs.length,
      checkedAt: new Date().toISOString(),
      status: results
    });
  }
}

export { HealthCheckController };