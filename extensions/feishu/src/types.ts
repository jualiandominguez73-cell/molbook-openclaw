export type FeishuEventHeader = {
  event_type?: string;
  token?: string;
  app_id?: string;
  tenant_key?: string;
  create_time?: string;
};

export type FeishuSenderId = {
  user_id?: string;
  open_id?: string;
  union_id?: string;
};

export type FeishuSender = {
  sender_id?: FeishuSenderId;
  sender_type?: string;
};

export type FeishuMention = {
  key?: string;
  name?: string;
  id?: FeishuSenderId & { user_id?: string; open_id?: string };
};

export type FeishuMessage = {
  message_id?: string;
  chat_id?: string;
  chat_type?: string;
  message_type?: string;
  content?: string;
  mentions?: FeishuMention[];
};

export type FeishuEvent = {
  sender?: FeishuSender;
  message?: FeishuMessage;
};

export type FeishuWebhookPayload = {
  schema?: string;
  header?: FeishuEventHeader;
  event?: FeishuEvent;
  type?: string;
  challenge?: string;
  token?: string;
  encrypt?: string;
  app_id?: string;
};
