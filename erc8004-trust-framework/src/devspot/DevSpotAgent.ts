/**
 * DevSpot Agent Compatibility Layer
 * Provides agent.json and agent_log.json manifest generation
 * and runtime logging in DevSpot format
 */
export class DevSpotAgent {
  private manifest: any;
  private logHistory: any[] = [];
  private agent: AutonomousAgent;

  constructor(agent: AutonomousAgent, manifestPath?: string) {
    this.agent = agent;
    
    if (manifestPath) {
      this.manifest = this.loadManifest(manifestPath);
    } else {
      this.manifest = this.generateDefaultManifest();
    }
    
    // Hook into agent's events to generate logs
    agent.on('loop_complete', (data: any) => {
      this.logLoopIteration(data);
    });
    
    agent.on('task_assigned', (task: any) => {
      this.logEvent('task_assigned', task);
    });
    
    agent.on('task_complete', (task: any) => {
      this.logEvent('task_complete', task);
    });
  }

  /**
   * Generate current agent.json manifest
   */
  generateAgentManifest(): any {
    return {
      ...this.manifest,
      agent_id: this.agent.getAgentId(),
      operator_wallet: this.agent['wallet'].address,
      trust_score: this.agent.getTrustScore(),
      capabilities: this.agent['capabilities'],
      status: this.agent.getStatus(),
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Write agent.json to disk
   */
  async writeAgentManifest(outputDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    
    const manifest = this.generateAgentManifest();
    const filepath = path.join(outputDir, 'agent.json');
    
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Generate current agent_log.json
   */
  generateAgentLog(): any {
    const agentLog = this.agent.generateDevSpotLog();
    
    // Add recent history
    agentLog.log_history = this.logHistory.slice(-100); // Keep last 100 entries
    
    return agentLog;
  }

  /**
   * Write agent_log.json to disk
   */
  async writeAgentLog(outputDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    
    const log = this.generateAgentLog();
    const filepath = path.join(outputDir, 'agent_log.json');
    
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(log, null, 2));
  }

  /**
   * Log a custom event
   */
  private logEvent(event: string, data: any): void {
    this.logHistory.push({
      timestamp: new Date().toISOString(),
      event,
      data,
      source: this.agent.getAgentId()
    });
  }

  /**
   * Log loop iteration for DevSpot format
   */
  private logLoopIteration(loopData: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'loop_iteration',
      iteration: loopData.iteration,
      trust_score: loopData.trustScore,
      success: loopData.success
    };
    
    this.logHistory.push(logEntry);
  }

  /**
   * Load manifest from file
   */
  private loadManifest(path: string): any {
    const fs = require('fs');
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  }

  /**
   * Generate default manifest if none exists
   */
  private generateDefaultManifest(): any {
    return {
      manifest_version: '1.0.0',
      name: 'ERC8004TrustAgent',
      version: '1.0.0',
      description: 'Autonomous agent implementing ERC-8004 decentralized trust framework',
      capabilities: [],
      architecture: {
        type: 'modular_autonomous',
        components: ['Planner', 'Executor', 'Validator', 'Communicator', 'TrustScorer']
      },
      operator_model: {
        requires_operator_wallet: true,
        identity_linked_to_operator: true,
        reputation_builds_over_time: true,
        onchain_transactions_enabled: true
      }
    };
  }

  /**
   * Get log history
   */
  getLogHistory(): any[] {
    return [...this.logHistory];
  }

  /**
   * Clear log history
   */
  clearLogHistory(): void {
    this.logHistory = [];
  }
}
