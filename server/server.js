import { createApp } from "./src/app.js";
import { connectMongo } from "./src/config/mongo.js";
import { env } from "./src/config/env.js";

await connectMongo();

const app = createApp();

// Render injeta process.env.PORT. Use ele em produção.
const port = Number(process.env.PORT || env.port || 8011);

app.listen(port, "0.0.0.0", () => {
  console.log(`server listening on port ${port}`);
});
