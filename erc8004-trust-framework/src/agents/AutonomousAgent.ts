import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Autonomous Agent implementing ERC-8004 trust framework
 */
export class AutonomousAgent extends EventEmitter {
  private wallet: ethers.Wallet;
  private provider: ethers.providers.Provider;
  private trustFramework: ethers.Contract;
  private identityRegistry: ethers.Contract;
  private reputationRegistry: ethers.Contract;
  private validationRegistry: ethers.Contract;
  
  private agentId: string;
  private sessionId: string;
  private capabilities: string[] = [];
  private loopIteration = 0;
  private isRunning = false;
  
  // Agent state
  private state: AgentState = {
    trustScore: 0,
    reputation: null,
    activeTasks: [],
    recentInteractions: [],
    loopHistory: []
  };

  constructor(
    privateKey: string,
    frameworkAddress: string,
    registryAddresses: {
      identity: string;
      reputation: string;
      validation: string;
    }
  ) {
    super();
    this.wallet = new ethers.Wallet(privateKey);
    this.provider = ethers.getDefaultProvider();
    
    // Initialize contract connections
    const frameworkAbi = require('../contracts/TrustFramework.json');
    const identityAbi = require('../contracts/ERC8004Identity.json');
    const reputationAbi = require('../contracts/ReputationRegistry.json');
    const validationAbi = require('../contracts/ValidationRegistry.json');
    
    this.trustFramework = new ethers.Contract(frameworkAddress, frameworkAbi, this.wallet);
    this.identityRegistry = new ethers.Contract(registryAddresses.identity, identityAbi, this.wallet);
    this.reputationRegistry = new ethers.Contract(registryAddresses.reputation, reputationAbi, this.wallet);
    this.validationRegistry = new ethers.Contract(registryAddresses.validation, validationAbi, this.wallet);
    
    this.sessionId = uuidv4();
    this.agentId = this.getAgentIdFromWallet();
  }

  /**
   * Main autonomous loop - continuously plan, execute, verify, update
   */
  async startAutonomousLoop(intervalMs: number = 30000): Promise<void> {
    this.isRunning = true;
    this.emit('loop_started', { sessionId: this.sessionId });
    
    while (this.isRunning) {
      try {
        await this.executeLoopIteration();
        this.loopIteration++;
      } catch (error) {
        this.emit('loop_error', { error, iteration: this.loopIteration });
        console.error('Loop iteration failed:', error);
      }
      
      // Wait before next iteration
      await this.sleep(intervalMs);
    }
  }

  /**
   * Single iteration of the autonomous loop
   */
  private async executeLoopIteration(): Promise<void> {
    const iterationStart = Date.now();
    
    try {
      // PHASE 1: Planning
      const plan = await this.planningPhase();
      
      // PHASE 2: Execution
      const results = await this.executionPhase(plan);
      
      // PHASE 3: Verification
      const verification = await this.verificationPhase(results);
      
      // PHASE 4: Reputation Update
      await this.reputationUpdatePhase(verification);
      
      this.state.loopHistory.push({
        iteration: this.loopIteration,
        timestamp: new Date().toISOString(),
        plan: plan,
        results: results,
        verification: verification,
        duration_ms: Date.now() - iterationStart
      });
      
      this.emit('loop_complete', {
        iteration: this.loopIteration,
        success: verification.success,
        trustScore: this.state.trustScore
      });
      
    } catch (error) {
      this.emit('iteration_failed', { iteration: this.loopIteration, error });
      throw error;
    }
  }

  /**
   * PHASE 1: Planning
   * Analyze task requirements and formulate execution plan
   */
  private async planningPhase(): Promise<ExecutionPlan> {
    const availableCapabilities = await this.getCapabilities();
    const trustScores = await this.getTrustScoresForNetwork();
    
    // Determine what needs to be done based on state
    const tasks = this.identifyRequiredTasks();
    
    const plan: ExecutionPlan = {
      planId: uuidv4(),
      iteration: this.loopIteration,
      timestamp: new Date().toISOString(),
      tasks: tasks.map(task => ({
        taskId: uuidv4(),
        description: task.description,
        requiredCapabilities: task.requiredCapabilities,
        selectedAgent: this.selectAgentForTask(task, trustScores, availableCapabilities),
        dependencies: task.dependencies,
        expectedOutcome: task.expectedOutcome,
        priority: task.priority
      })),
      requiredAgents: Array.from(new Set(tasks.map(t => t.selectedAgent))),
      estimatedDuration: this.estimateDuration(tasks),
      confidenceScore: this.calculatePlanConfidence(tasks, trustScores)
    };
    
    this.emit('plan_created', plan);
    return plan;
  }

  /**
   * PHASE 2: Execution
   * Execute planned actions and interact with other agents
   */
  private async executionPhase(plan: ExecutionPlan): Promise<ExecutionResults> {
    const results: ExecutionResults = {
      planId: plan.planId,
      timestamp: new Date().toISOString(),
      actions: [],
      interactions: [],
      onchainTransactions: [],
      errors: []
    };
    
    for (const task of plan.tasks) {
      try {
        if (task.selectedAgent === this.agentId) {
          // Self-execution
          const result = await this.executeTaskLocally(task);
          results.actions.push(result);
        } else {
          // Delegate to another agent
          const interaction = await this.delegateTask(task);
          results.interactions.push(interaction);
          results.actions.push({
            actionId: uuidv4(),
            type: 'delegation',
            targetAgent: task.selectedAgent,
            status: interaction.success ? 'success' : 'failed',
            result: interaction
          });
        }
        
        // Record interaction on-chain
        const tx = await this.recordInteraction(task.selectedAgent, task.description);
        results.onchainTransactions.push(tx.hash);
        
      } catch (error) {
        results.errors.push({
          taskId: task.taskId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    this.emit('execution_complete', results);
    return results;
  }

  /**
   * PHASE 3: Verification
   * Verify outcomes and validate interactions using on-chain proofs
   */
  private async verificationPhase(results: ExecutionResults): Promise<VerificationResult> {
    const verification: VerificationResult = {
      iteration: this.loopIteration,
      timestamp: new Date().toISOString(),
      verifiedActions: [],
      failedVerifications: [],
      integrityScoreDelta: 0,
      overallStatus: 'pending'
    };
    
    // Verify on-chain transactions
    for (const txHash of results.onchainTransactions) {
      try {
        const receipt = await this.provider.getTransactionReceipt(txHash);
        if (receipt && receipt.status === 1) {
          verification.verifiedActions.push({
            txHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            logs: receipt.logs.map(log => log.topics[0])
          });
          verification.integrityScoreDelta += 1;
        } else {
          verification.failedVerifications.push(txHash);
          verification.integrityScoreDelta -= 2;
        }
      } catch (error) {
        verification.failedVerifications.push(txHash);
      }
    }
    
    // Verify interaction outcomes via Ethereum events
    for (const interaction of results.interactions) {
      const success = await this.verifyInteractionOnChain(interaction);
      if (!success) {
        verification.failedVerifications.push(interaction.interactionId);
      }
    }
    
    verification.overallStatus = verification.failedVerifications.length === 0 ? 'success' : 'partial';
    this.emit('verification_complete', verification);
    return verification;
  }

  /**
   * PHASE 4: Reputation Update
   * Update reputation scores based on verification results
   */
  private async reputationUpdatePhase(verification: VerificationResult): Promise<void> {
    const performanceDelta = verification.overallStatus === 'success' ? 2 : -5;
    const reliabilityDelta = verification.verifiedActions.length > 0 ? 1 : -2;
    const integrityDelta = verification.integrityScoreDelta;
    
    // Update self reputation
    await this.reputationRegistry.updateReputation(
      this.agentId,
      performanceDelta,
      reliabilityDelta,
      integrityDelta,
      verification.verifiedActions.length,
      verification.verifiedActions.length
    );
    
    // Update peer reputations (based on successful interactions)
    for (const interaction of this.state.recentInteractions) {
      if (interaction.success) {
        await this.reputationRegistry.recordInteraction(
          this.agentId,
          interaction.peerId,
          true,
          ethers.utils.id(interaction.type)
        );
      }
    }
    
    // Refresh trust score
    this.state.trustScore = await this.trustFramework.calculateTrustScore(this.agentId);
    
    this.emit('reputation_updated', {
      trustScore: this.state.trustScore,
      deltas: { performanceDelta, reliabilityDelta, integrityDelta }
    });
  }

  /**
   * Task assignment with trust-based agent selection
   */
  private selectAgentForTask(
    task: Task, 
    trustScores: Map<string, number>,
    availableCapabilities: Set<string>
  ): string {
    // Check if self can handle it
    const selfCanHandle = task.requiredCapabilities.every(
      cap => availableCapabilities.has(cap)
    );
    
    if (selfCanHandle && this.state.trustScore >= 700) {
      return this.agentId;
    }
    
    // Find agents with required capabilities and high trust
    // This would query the trust registry
    return this.findBestAgent(task.requiredCapabilities, trustScores);
  }

  /**
   * Record interaction on-chain
   */
  private async recordInteraction(agentId: string, description: string): Promise<ethers.providers.TransactionResponse> {
    const interactionHash = ethers.utils.id(description);
    const tx = await this.trustFramework.populateTransaction.recordInteraction(
      this.agentId,
      agentId,
      true,
      interactionHash
    );
    return this.wallet.sendTransaction(tx);
  }

  /**
   * Get agent's capabilities from identity registry
   */
  private async getCapabilities(): Promise<string[]> {
    const identity = await this.identityRegistry.getAgentIdentity(this.agentId);
    return identity.capabilities.map(c => c.toString());
  }

  /**
   * Get trust scores for network agents
   */
  private async getTrustScoresForNetwork(): Promise<Map<string, number>> {
    const operatorAgents = await this.identityRegistry.getOperatorAgents(this.wallet.address);
    const scores = new Map<string, number>();
    
    for (const agentId of operatorAgents) {
      const score = await this.trustFramework.calculateTrustScore(agentId);
      scores.set(agentId, score.toNumber());
    }
    
    return scores;
  }

  /**
   * Helper: Derive agent ID from wallet address
   */
  private getAgentIdFromWallet(): string {
    // Generate agent ID from wallet address
    return ethers.utils.id(this.wallet.address).toString();
  }

  /**
   * Identify tasks based on current state and mission
   */
  private identifyRequiredTasks(): Task[] {
    // This would be customized per agent type
    return [
      {
        taskId: uuidv4(),
        description: 'Verify reputation of network agents',
        requiredCapabilities: ['REPUTATION_QUERY', 'VALIDATION'],
        priority: 1,
        dependencies: [],
        expectedOutcome: 'Updated trust scores for all known agents'
      },
      {
        taskId: uuidv4(),
        description: 'Request validation for new capability',
        requiredCapabilities: ['VALIDATION_REQUEST'],
        priority: 2,
        dependencies: [],
        expectedOutcome: 'New credential issued or evidence collected'
      }
    ];
  }

  /**
   * Find best agent for a task based on trust and capabilities
   */
  private async findBestAgent(
    requiredCapabilities: string[], 
    trustScores: Map<string, number>
  ): Promise<string> {
    // Query network for agents with required capabilities
    // Sort by trust score, return highest
    // Simplified: return self for now
    return this.agentId;
  }

  /**
   * Estimate task duration
   */
  private estimateDuration(tasks: Task[]): number {
    return tasks.length * 60; // Simple estimate
  }

  /**
   * Calculate plan confidence
   */
  private calculatePlanConfidence(tasks: Task[], trustScores: Map<string, number>): number {
    if (tasks.length === 0) return 0;
    
    const avgTrust = Array.from(trustScores.values())
      .reduce((a, b) => a + b, 0) / trustScores.size || 500;
    
    return Math.min(1000, avgTrust);
  }

  /**
   * Execute task locally
   */
  private async executeTaskLocally(task: Task): Promise<ActionResult> {
    // Task-specific execution logic
    return {
      actionId: uuidv4(),
      type: 'local',
      status: 'success',
      result: { taskId: task.taskId, completed: true },
      duration_ms: 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Delegate task to another agent
   */
  private async delegateTask(task: Task): Promise<InteractionResult> {
    // Would send message to target agent via XMPT or other protocol
    return {
      interactionId: uuidv4(),
      fromAgent: this.agentId,
      toAgent: task.selectedAgent,
      type: 'delegation',
      success: true,
      timestamp: new Date().toISOString(),
      evidence: ethers.utils.id(JSON.stringify(task))
    };
  }

  /**
   * Verify interaction on-chain
   */
  private async verifyInteractionOnChain(interaction: InteractionResult): Promise<boolean> {
    // Check for event logs
    // For demo, return true
    return true;
  }

  /**
   * Stop the autonomous loop
   */
  stop(): void {
    this.isRunning = false;
    this.emit('loop_stopped', { sessionId: this.sessionId });
  }

  /**
   * Log agent state to DevSpot-compatible format
   */
  generateDevSpotLog(): AgentLog {
    return {
      log_version: '1.0.0',
      agent_id: this.agentId,
      session_id: this.sessionId,
      operator_wallet: this.wallet.address,
      loop_iteration: this.loopIteration,
      timestamp: new Date().toISOString(),
      loop_phases: this.buildLoopPhasesLog(),
      summary: this.buildSummaryLog()
    };
  }

  private buildLoopPhasesLog(): any {
    // Build from last iteration in state.loopHistory
    if (this.state.loopHistory.length === 0) {
      return null;
    }
    const last = this.state.loopHistory[this.state.loopHistory.length - 1];
    return {
      planning: {
        timestamp: last.timestamp,
        input_task: last.plan.tasks.map(t => t.description).join(', '),
        analyzed_capabilities: last.plan.requiredAgents,
        execution_plan: last.plan,
        confidence_score: last.plan.confidenceScore,
        plan_id: last.plan.planId
      },
      execution: {
        timestamp: last.timestamp,
        execution_plan_id: last.plan.planId,
        actions_taken: last.results.actions,
        interactions_logged: last.results.interactions,
        total_gas_used: last.results.onchainTransactions.length * 100000,
        onchain_transactions: last.results.onchainTransactions
      },
      verification: {
        timestamp: last.timestamp,
        verification_method: 'onchain_proof',
        outcome: last.verification.overallStatus,
        evidence_collected: last.verification.verifiedActions.map(a => ({
          type: 'transaction_receipt',
          hash: a.txHash,
          source: 'blockchain',
          valid: true,
          details: { blockNumber: a.blockNumber }
        })),
        integrity_score_delta: last.verification.integrityScoreDelta,
        validation_notes: last.verification.overallStatus
      },
      reputation_update: {
        timestamp: last.timestamp,
        self_update: {
          performance_delta: 2,
          reliability_delta: 1,
          integrity_delta: last.verification.integrityScoreDelta,
          reason: 'autonomous_loop_completion'
        },
        peer_updates: [],
        transaction_hashes: last.results.onchainTransactions,
        updated_scores: {
          overall: this.state.trustScore,
          performance: this.state.reputation?.performanceScore || 0,
          reliability: this.state.reputation?.reliabilityScore || 0,
          integrity: this.state.reputation?.integrityScore || 0
        }
      }
    };
  }

  private buildSummaryLog(): any {
    const lastIteration = this.state.loopHistory[this.state.loopHistory.length - 1];
    if (!lastIteration) return null;
    
    return {
      loop_success: lastIteration.verification.overallStatus === 'success',
      composite_trust_score_after: this.state.trustScore,
      new_capabilities_acquired: [],
      key_events: [`Loop iteration ${this.loopIteration} completed`],
      errors_encountered: lastIteration.results.errors,
      warnings: []
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Getters
  getAgentId(): string {
    return this.agentId;
  }
  
  getTrustScore(): number {
    return this.state.trustScore;
  }
  
  getStatus(): AgentStatus {
    return {
      agentId: this.agentId,
      sessionId: this.sessionId,
      isRunning: this.isRunning,
      loopIteration: this.loopIteration,
      trustScore: this.state.trustScore,
      capabilities: this.capabilities,
      lastUpdate: new Date().toISOString()
    };
  }
}

// Type definitions
interface AgentState {
  trustScore: number;
  reputation: any | null;
  activeTasks: any[];
  recentInteractions: any[];
  loopHistory: LoopIteration[];
}

interface ExecutionPlan {
  planId: string;
  iteration: number;
  timestamp: string;
  tasks: PlannedTask[];
  requiredAgents: string[];
  estimatedDuration: number;
  confidenceScore: number;
}

interface PlannedTask {
  taskId: string;
  description: string;
  requiredCapabilities: string[];
  selectedAgent: string;
  dependencies: string[];
  expectedOutcome: string;
  priority: number;
}

interface ExecutionResults {
  planId: string;
  timestamp: string;
  actions: ActionResult[];
  interactions: InteractionResult[];
  onchainTransactions: string[];
  errors: any[];
}

interface ActionResult {
  actionId: string;
  type: string;
  targetAgent?: string;
  status: string;
  result: any;
  duration_ms: number;
  timestamp: string;
}

interface InteractionResult {
  interactionId: string;
  fromAgent: string;
  toAgent: string;
  type: string;
  success: boolean;
  timestamp: string;
  evidence: string;
}

interface VerificationResult {
  iteration: number;
  timestamp: string;
  verifiedActions: VerifiedAction[];
  failedVerifications: string[];
  integrityScoreDelta: number;
  overallStatus: 'success' | 'partial' | 'failure';
}

interface VerifiedAction {
  txHash: string;
  blockNumber: number;
  gasUsed: number;
  logs: string[];
}

interface AgentLog {
  log_version: string;
  agent_id: string;
  session_id: string;
  operator_wallet: string;
  loop_iteration: number;
  timestamp: string;
  loop_phases: any;
  summary: any;
}

interface AgentStatus {
  agentId: string;
  sessionId: string;
  isRunning: boolean;
  loopIteration: number;
  trustScore: number;
  capabilities: string[];
  lastUpdate: string;
}

interface Task {
  taskId: string;
  description: string;
  requiredCapabilities: string[];
  priority: number;
  dependencies: string[];
  expectedOutcome: string;
}
