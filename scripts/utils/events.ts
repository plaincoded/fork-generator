type EventParam = {
  name: string;
  type: string;
  internalTye: string;
  indexed: boolean;
};
export function formatEventWithInputs(
  event: string,
  inputs: Array<EventParam>
): string {
  return `${event}(${inputs
    .map((x) => `${x.indexed ? "indexed " : ""}${x.type} ${x.name}`)
    .join(", ")})`;
}

export function isProxy(events: string[]): boolean {
  return events.includes("Upgraded(indexed address implementation)");
}
