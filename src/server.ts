import { createApp } from "./app/app.js";
import { config } from "./config/env.js";

const app = createApp();
const port = app.get("port") || config.PORT;

app.listen(port, () => {
  console.log(`SnackBar server ready on http://localhost:${port}`);
});
