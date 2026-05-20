import React, { useState } from 'react';
import type { Origin } from '@plannotator/shared/agents';
import {
  getPermissionModeSettings,
  savePermissionModeSettings,
  PERMISSION_MODE_OPTIONS,
  type PermissionMode,
} from '../../utils/permissionMode';
import {
  getAgentSwitchSettings,
  saveAgentSwitchSettings,
  AGENT_OPTIONS,
} from '../../utils/agentSwitch';
import { useAgents } from '../../hooks/useAgents';

interface PlanGeneralTabProps {
  origin?: Origin | null;
}

export const PlanGeneralTab: React.FC<PlanGeneralTabProps> = ({ origin }) => {
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    () => getPermissionModeSettings().mode,
  );
  const [agent, setAgent] = useState(() => getAgentSwitchSettings());
  const [agentWarning, setAgentWarning] = useState<string | null>(null);
  const { agents: availableAgents } = useAgents(origin);

  const handlePermissionModeChange = (mode: PermissionMode) => {
    setPermissionMode(mode);
    savePermissionModeSettings(mode);
  };

  const handleAgentChange = (switchTo: string, customName?: string) => {
    const next = { switchTo, customName: customName ?? agent.customName };
    setAgent(next);
    saveAgentSwitchSettings(next);
  };

  const validateAgent = (name: string) =>
    availableAgents.some((a) => a.id.toLowerCase() === name.toLowerCase());

  const showPermission = origin === 'claude-code';
  const showAgent = origin === 'opencode';

  if (!showPermission && !showAgent) {
    return (
      <div className="text-sm text-muted-foreground">
        No plan-specific settings available for this agent.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showPermission && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Permission Mode</div>
          <div className="text-xs text-muted-foreground">
            Automation level after plan approval
          </div>
          <select
            value={permissionMode}
            onChange={(e) => handlePermissionModeChange(e.target.value as PermissionMode)}
            className="w-full px-3 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
          >
            {PERMISSION_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="text-[10px] text-muted-foreground">
            {PERMISSION_MODE_OPTIONS.find((o) => o.value === permissionMode)?.description}
          </div>
        </div>
      )}

      {showAgent && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Agent Switching</div>
          <div className="text-xs text-muted-foreground">
            Which agent to switch to after plan approval
          </div>
          {agentWarning && (
            <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-600 dark:text-amber-400">
              <span>{agentWarning}</span>
            </div>
          )}
          <select
            value={agent.switchTo}
            onChange={(e) => {
              handleAgentChange(e.target.value);
              setAgentWarning(null);
            }}
            className="w-full px-3 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
          >
            {availableAgents.length > 0 ? (
              <>
                {availableAgents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
                <option value="custom">Custom</option>
                <option value="disabled">Disabled</option>
              </>
            ) : (
              AGENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))
            )}
          </select>
          {agent.switchTo === 'custom' && (
            <input
              type="text"
              value={agent.customName || ''}
              onChange={(e) => {
                const customName = e.target.value;
                handleAgentChange('custom', customName);
                if (customName && availableAgents.length > 0) {
                  setAgentWarning(
                    validateAgent(customName) ? null : `Agent "${customName}" not found in OpenCode.`,
                  );
                } else {
                  setAgentWarning(null);
                }
              }}
              placeholder="Enter agent name…"
              className="w-full px-3 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          )}
          <div className="text-[10px] text-muted-foreground">
            {agent.switchTo === 'custom' && agent.customName
              ? `Switch to "${agent.customName}" agent after approval`
              : agent.switchTo === 'disabled'
                ? 'Stay on current agent after approval'
                : `Switch to ${agent.switchTo} agent after approval`}
          </div>
        </div>
      )}
    </div>
  );
};
