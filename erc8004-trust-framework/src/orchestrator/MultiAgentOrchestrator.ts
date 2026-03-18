import { EventEmitter } from 'events';
import { AutonomousAgent } from './AutonomousAgent';

/**
 * Orchestrator for coordinating multiple autonomous agents
 * Implements trust-based selection, capability matching, and task delegation
 */
export class MultiAgentOrchestrator extends EventEmitter {
  private agents: Map<string, AutonomousAgent> = new Map();
  private taskQueue: Task[] = [];
  private inProgressTasks: Map<string, Task> = new Map();
  private trustFrameworkAddress: string;
  private isRunning = false;

  constructor(trustFrameworkAddress: string) {
    super();
    this.trustFrameworkAddress = trustFrameworkAddress;
  }

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: AutonomousAgent): void {
    const agentId = agent.getAgentId();
    this.agents.set(agentId, agent);
    
    agent.on('loop_complete', (data: any) => {
      this.handleAgentLoopComplete(agentId, data);
    });
    
    agent.on('loop_error', (error: any) => {
      this.handleAgentLoopError(agentId, error);
    });
    
    this.emit('agent_registered', { agentId, status: agent.getStatus() });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.stop();
      this.agents.delete(agentId);
      this.emit('agent_unregistered', { agentId });
    }
  }

  /**
   * Submit a task for coordination
   */
  async submitTask(task: Task): Promise<string> {
    const taskId = this.generateTaskId();
    task.taskId = taskId;
    task.status = 'queued';
    task.submittedAt = new Date().toISOString();
    
    this.taskQueue.push(task);
    this.emit('task_submitted', task);
    
    // Try to schedule if orchestrator is running
    if (this.isRunning) {
      this.scheduleTasks();
    }
    
    return taskId;
  }

  /**
   * Start the orchestrator - begins task scheduling and coordination
   */
  start(): void {
    this.isRunning = true;
    this.emit('orchestrator_started');
    
    // Start scheduling loop
    this.schedulingLoop();
  }

  /**
   * Stop the orchestrator
   */
  stop(): void {
    this.isRunning = false;
    
    // Stop all agents
    for (const [agentId, agent] of this.agents) {
      agent.stop();
    }
    
    this.emit('orchestrator_stopped');
  }

  /**
   * Main scheduling loop - runs periodically
   */
  private schedulingLoop(): void {
    if (!this.isRunning) return;
    
    try {
      this.scheduleTasks();
      this.monitorTaskProgress();
      this.rebalanceIfNeeded();
    } catch (error) {
      this.emit('scheduling_error', { error });
    }
    
    // Run again in 10 seconds
    setTimeout(() => this.schedulingLoop(), 10000);
  }

  /**
   * Schedule queued tasks to appropriate agents
   */
  private scheduleTasks(): void {
    if (this.taskQueue.length === 0) return;
    
    for (const task of this.taskQueue) {
      const bestAgent = this.selectAgentForTask(task);
      
      if (bestAgent) {
        // Delegate task to agent
        this.delegateTaskToAgent(task, bestAgent);
        this.taskQueue = this.taskQueue.filter(t => t.taskId !== task.taskId);
      } else {
        // No suitable agent - could create new agent or mark as waiting
        this.emit('task_waiting', { taskId: task.taskId, reason: 'no_suitable_agent' });
      }
    }
  }

  /**
   * Select best agent for a task based on trust, capabilities, and workload
   */
  private selectAgentForTask(task: Task): AutonomousAgent | null {
    let bestAgent: AutonomousAgent | null = null;
    let bestScore = -1;
    
    for (const [agentId, agent] of this.agents) {
      const status = agent.getStatus();
      const score = this.calculateAgentSuitability(agent, task);
      
      if (score > bestScore && score > 500) { // Minimum threshold
        bestScore = score;
        bestAgent = agent;
      }
    }
    
    if (bestAgent) {
      this.emit('agent_selected', {
        taskId: task.taskId,
        agentId: bestAgent.getAgentId(),
        trustScore: bestAgent.getTrustScore(),
        suitabilityScore: bestScore
      });
    }
    
    return bestAgent;
  }

  /**
   * Calculate agent's suitability for a task
   */
  private calculateAgentSuitability(agent: AutonomousAgent, task: Task): number {
    const status = agent.getStatus();
    let score = 0;
    
    // Trust score component (40%)
    score += (status.trustScore / 1000) * 400;
    
    // Capability match component (30%)
    const capabilityMatch = this.calculateCapabilityMatch(
      status.capabilities, 
      task.requiredCapabilities
    );
    score += capabilityMatch * 300;
    
    // Workload balance component (20%)
    const activeTasks = this.inProgressTasks.size;
    const workloadPenalty = activeTasks * 20;
    score += Math.max(0, 200 - workloadPenalty);
    
    // Past performance with this task type (10%)
    score += this.getTaskTypePerformance(agent, task) * 100;
    
    return score;
  }

  /**
   * Calculate capability match percentage (0-1)
   */
  private calculateCapabilityMatch(
    agentCaps: string[], 
    requiredCaps: string[]
  ): number {
    if (requiredCaps.length === 0) return 1;
    
    let matches = 0;
    for (const req of requiredCaps) {
      if (agentCaps.includes(req)) matches++;
    }
    
    return matches / requiredCaps.length;
  }

  /**
   * Get historical performance for task type
   */
  private getTaskTypePerformance(agent: AutonomousAgent, task: Task): number {
    // Would query agent's history for similar tasks
    // Return 0.5 as default
    return 0.5;
  }

  /**
   * Delegate task to an agent
   */
  private async delegateTaskToAgent(task: Task, agent: AutonomousAgent): Promise<void> {
    task.assignedAgent = agent.getAgentId();
    task.status = 'assigned';
    task.assignedAt = new Date().toISOString();
    
    this.inProgressTasks.set(task.taskId, task);
    
    // In a real system, would signal agent to prioritize this task
    // For now, agents autonomously pick up tasks through their loop
    
    this.emit('task_assigned', task);
  }

  /**
   * Monitor progress of in-progress tasks
   */
  private monitorTaskProgress(): void {
    for (const [taskId, task] of this.inProgressTasks) {
      const agent = this.agents.get(task.assignedAgent);
      if (!agent) {
        // Agent disappeared - reassign
        this.handleAgentFailure(task, 'agent_unavailable');
        continue;
      }
      
      const status = agent.getStatus();
      
      // Check if task is complete (simplified - would have more complex logic)
      if (this.isTaskComplete(agent, task)) {
        this.completeTask(taskId, true);
      }
    }
  }

  /**
   * Check if task is complete
   */
  private isTaskComplete(agent: AutonomousAgent, task: Task): boolean {
    // Would check agent's task completion status
    // For demo, return false - would never auto-complete
    return false;
  }

  /**
   * Rebalance load if some agents are overloaded
   */
  private rebalanceIfNeeded(): void {
    const avgLoad = this.inProgressTasks.size / Math.max(1, this.agents.size);
    
    for (const [agentId, agent] of this.agents) {
      const agentTasks = Array.from(this.inProgressTasks.values())
        .filter(t => t.assignedAgent === agentId);
      
      if (agentTasks.length > avgLoad * 1.5) {
        // This agent is overloaded - try to reassign some tasks
        this.rebalanceAgent(agent, agentTasks);
      }
    }
  }

  /**
   * Rebalance tasks from an overloaded agent
   */
  private rebalanceAgent(agent: AutonomousAgent, agentTasks: Task[]): void {
    // Find agents with lower load
    for (const task of agentTasks) {
      const newAgent = this.selectAgentForTask(task);
      if (newAgent && newAgent.getAgentId() !== agent.getAgentId()) {
        task.assignedAgent = newAgent.getAgentId();
        this.emit('task_reassigned', {
          taskId: task.taskId,
          fromAgent: agent.getAgentId(),
          toAgent: newAgent.getAgentId(),
          reason: 'load_balancing'
        });
      }
    }
  }

  /**
   * Handle agent loop completion
   */
  private handleAgentLoopComplete(agentId: string, data: any): void {
    // Check if any tasks were completed in this iteration
    // Would parse the agent's log to extract task completions
    
    this.emit('agent_loop_complete', {
      agentId,
      iteration: data.iteration,
      trustScore: data.trustScore
    });
  }

  /**
   * Handle agent loop error
   */
  private handleAgentLoopError(agentId: string, error: any): void {
    this.emit('agent_error', { agentId, error });
    
    // Attempt to reassign tasks from this agent
    const affectedTasks = Array.from(this.inProgressTasks.values())
      .filter(t => t.assignedAgent === agentId);
    
    for (const task of affectedTasks) {
      this.handleAgentFailure(task, 'loop_error');
    }
  }

  /**
   * Handle task failure - requeue or fail
   */
  private handleAgentFailure(task: Task, reason: string): void {
    task.status = 'failed';
    task.failureReason = reason;
    task.failedAt = new Date().toISOString();
    
    this.inProgressTasks.delete(task.taskId);
    
    // Retry logic - could requeue with different agent
    this.emit('task_failed', task);
  }

  /**
   * Complete a task
   */
  private completeTask(taskId: string, success: boolean): void {
    const task = this.inProgressTasks.get(taskId);
    if (!task) return;
    
    task.status = success ? 'completed' : 'failed';
    task.completedAt = new Date().toISOString();
    
    this.inProgressTasks.delete(taskId);
    this.emit('task_complete', task);
    
    // If successful, trigger reputation updates already handled by agent loop
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get orchestrator status
   */
  getStatus(): OrchestratorStatus {
    return {
      isRunning: this.isRunning,
      agentsRegistered: this.agents.size,
      agentsActive: Array.from(this.agents.values())
        .filter(a => a.getStatus().isRunning).length,
      taskQueueSize: this.taskQueue.length,
      tasksInProgress: this.inProgressTasks.size,
      totalAgents: this.agents.size,
      uptime: process.uptime()
    };
  }

  /**
   * Get all registered agents
   */
  getAgents(): AutonomousAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get all tasks (queued and in progress)
   */
  getAllTasks(): { queued: Task[]; inProgress: Task[] } {
    return {
      queued: [...this.taskQueue],
      inProgress: Array.from(this.inProgressTasks.values())
    };
  }
}

// Type definitions
export interface Task {
  taskId: string;
  description: string;
  requiredCapabilities: string[];
  priority: number;
  dependencies: string[];
  expectedOutcome: string;
  status?: 'queued' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  assignedAgent?: string;
  submittedAt?: string;
  assignedAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
}

export interface OrchestratorStatus {
  isRunning: boolean;
  agentsRegistered: number;
  agentsActive: number;
  taskQueueSize: number;
  tasksInProgress: number;
  totalAgents: number;
  uptime: number;
}
