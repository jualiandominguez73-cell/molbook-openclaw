/**
 * Type declarations for dingtalk-stream SDK
 */

declare module "dingtalk-stream" {
  export interface DWClientOptions {
    clientId: string;
    clientSecret: string;
  }

  export interface StreamResponse {
    headers: {
      messageId: string;
      [key: string]: string;
    };
    data: string;
  }

  export class DWClient {
    constructor(options: DWClientOptions);
    registerCallbackListener(
      path: string,
      callback: (res: StreamResponse) => Promise<void>,
    ): DWClient;
    connect(): Promise<void>;
    disconnect?(): void;
    socketCallBackResponse(messageId: string, response: string): void;
  }

  export const EventAck: {
    SUCCESS: string;
    LATER: string;
  };

  export const GATEWAY_URL: string;
  export const GET_TOKEN_URL: string;
  export const TOPIC_AI_GRAPH_API: string;
  export const TOPIC_CARD: string;
  export const TOPIC_ROBOT: string;
}
