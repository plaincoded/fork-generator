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
    .map((x) => `${x.type} ${x.indexed ? "indexed " : ""}${x.name}`)
    .join(", ")})`;
}

export function isProxy(events: string[]): boolean {
  return events.includes("Upgraded(indexed address implementation)");
}
