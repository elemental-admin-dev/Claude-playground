import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/three.module.js", express.static(path.join(__dirname, "node_modules/three/build/three.module.js")));

app.listen(PORT, () => {
  console.log(`kalekraft listening on http://localhost:${PORT}`);
});
