export function isLearnMode(agent?: string) {
  return agent === "learn"
}

export function visibleCommands<T extends { agent?: string }>(commands: readonly T[], agent?: string) {
  return commands.filter((command) => command.agent !== "learn" || isLearnMode(agent))
}

export function visibleSlashCommands<T extends { display: string }>(commands: readonly T[], agent?: string) {
  return commands.filter((command) => command.display !== "/group" || isLearnMode(agent))
}
