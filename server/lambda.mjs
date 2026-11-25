import * as sdk from "@aws-sdk/client-dynamodb";
import { DynamoStore } from "./store.mjs";
import { api, SECURITY_HEADERS } from "./api.mjs";
const store = new DynamoStore(
  new sdk.DynamoDBClient({ maxAttempts: 3 }),
  sdk,
  process.env.ROOM_TABLE,
);
export async function handler(event) {
  const result = await api(
    {
      path: event.rawPath ?? event.path ?? "/",
      method: event.requestContext?.http?.method ?? event.httpMethod ?? "GET",
      body: event.isBase64Encoded
        ? Buffer.from(event.body ?? "", "base64").toString("utf8")
        : (event.body ?? ""),
      token: (
        event.headers?.authorization ??
        event.headers?.Authorization ??
        ""
      ).replace(/^Bearer /, ""),
      // API Gateway's source IP is trusted; raw user-supplied headers are not used for limiting.
      ip: event.requestContext?.http?.sourceIp ?? "unknown",
    },
    store,
  );
  return {
    statusCode: result.status,
    headers: SECURITY_HEADERS,
    body: JSON.stringify(result.data),
  };
}
