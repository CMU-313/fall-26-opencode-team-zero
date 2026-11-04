export function isLearnMode(agent?: string) {
  return agent === "learn"
}

export function visibleCommands<T extends { agent?: string }>(commands: readonly T[], agent?: string) {
  return commands.filter((command) => command.agent !== "learn" || isLearnMode(agent))
}

export function isGroupCommandVisible(sessionID: string | undefined, agent?: string) {
  return !!sessionID && isLearnMode(agent)
}
