import * as Comlink from "comlink"

export function exposed(ep: Comlink.Endpoint): Promise<boolean> {
  return new Promise((resolve) => {
    ep.addEventListener("message", function l(ev: MessageEvent) {
      if (!ev.data || !ev.data.status || ev.data.status !== "ready") {
        return;
      }
      ep.removeEventListener("message", l as any);
      resolve(true);
    } as any);
  })
}

export function sendExposed(ep: Comlink.Endpoint = globalThis as any) {
  ep.postMessage({ status: "ready" });
}
