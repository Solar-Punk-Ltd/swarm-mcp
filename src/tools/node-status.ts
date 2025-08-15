/**
 * MCP Tool: node_status
 * Check the health and readiness status of the Bee node
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { Bee } from '@ethersphere/bee-js';
import { ToolResponse } from '../utils';

export interface NodeStatusArgs {
}

interface HealthStatus {
  status: string;
  version: string;
  apiVersion?: string;
}

export async function nodeStatus(
  _args: NodeStatusArgs,
  bee: Bee
): Promise<ToolResponse> {
  try {
    // Check node health status
    const healthStatus = await bee.getHealth() as unknown as HealthStatus;
    
    // Check node readiness status
    const readinessStatus = await bee.getReadiness() as unknown as HealthStatus;
    
    const response = {
      status: 'success',
      health: {
        status: healthStatus.status,
        version: healthStatus.version,
        apiVersion: healthStatus.apiVersion || 'unknown'
      },
      readiness: {
        status: readinessStatus.status,
        version: readinessStatus.version,
        apiVersion: readinessStatus.apiVersion || 'unknown'
      },
      message: 'Node status checked successfully',
      timestamp: new Date().toISOString()
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error('Error checking node status:', error);
    throw new McpError(
      ErrorCode.InternalError,
      'Failed to check node status: ' + (error instanceof Error ? error.message : String(error))
    );
  }
}
