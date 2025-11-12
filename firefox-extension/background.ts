import { WebsocketClient } from "./client";
import { MessageHandler } from "./message-handler";
import { getConfig } from "./extension-config";

function initClient(port: number) {
  const wsClient = new WebsocketClient(port);
  const messageHandler = new MessageHandler(wsClient);

  wsClient.connect();

  wsClient.addMessageListener(async (message) => {
    console.log("Message from server:", message);

    try {
      await messageHandler.handleDecodedMessage(message);
    } catch (error) {
      console.error("Error handling message:", error);
      if (error instanceof Error) {
        await wsClient.sendErrorToServer(message.correlationId, error.message);
      }
    }
  });
}

async function initExtension() {
  const config = await getConfig();
  return config;
}

initExtension()
  .then((config) => {
    const portList = config.ports;
    if (portList.length === 0) {
      console.error("No ports configured in extension config");
      return;
    }
    for (const port of portList) {
      initClient(port);
    }
    console.log("Browser extension initialized");
  })
  .catch((error) => {
    console.error("Error initializing extension:", error);
  });
