import type { InterceptorRegistry } from "./registry.js";
import type { InterceptorInputMap, InterceptorName, InterceptorOutputMap } from "./types.js";

export async function trigger<N extends InterceptorName>(
  registry: InterceptorRegistry,
  name: N,
  input: InterceptorInputMap[N],
  output: InterceptorOutputMap[N],
): Promise<InterceptorOutputMap[N]> {
  const interceptors = registry.get(name, input.toolName);
  for (const interceptor of interceptors) {
    await interceptor.handler(input, output);
  }
  return output;
}
