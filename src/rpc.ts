import { rpc } from "@stellar/stellar-sdk";
import { config } from "./config.js";

export const rpcServer = new rpc.Server(config.rpcUrl, {
  allowHttp: config.rpcUrl.startsWith("http://"),
});
