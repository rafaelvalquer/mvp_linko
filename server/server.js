import { createApp } from "./src/app.js";
import { connectMongo } from "./src/config/mongo.js";
import { env } from "./src/config/env.js";

await connectMongo();

const app = createApp();
app.listen(env.port, () =>
  console.log(`server on http://localhost:${env.port}`),
);
