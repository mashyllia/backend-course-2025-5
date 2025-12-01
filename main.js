const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { Command } = require("commander");
const superagent = require("superagent");

// -----------------------------
// 1. Аргументи командного рядка
// -----------------------------
const program = new Command();

program
  .requiredOption("-h, --host <host>", "Server host")
  .requiredOption("-p, --port <port>", "Server port")
  .requiredOption("-c, --cache <path>", "Cache directory");

program.parse(process.argv);

const { host, port, cache } = program.opts();

// -----------------------------
// 2. Перевірка / створення кеш-директорії
// -----------------------------
async function ensureCacheDir() {
  try {
    await fs.mkdir(cache, { recursive: true });
  } catch (e) {
    console.error("Не можу створити директорію кешу:", e.message);
    process.exit(1);
  }
}
ensureCacheDir();

// -----------------------------
// 3. Функція отримання шляху до файлу
// -----------------------------
function getFilePath(code) {
  return path.join(cache, `${code}.jpg`);
}

// -----------------------------
// 4. Завантаження картинки з http.cat
// -----------------------------
async function downloadFromHttpCat(code) {
  const url = `https://http.cat/${code}`;

  try {
    const response = await superagent.get(url).responseType("blob");
    return response.body;
  } catch (e) {
    return null;
  }
}

// -----------------------------
// 5. HTTP сервер
// -----------------------------
const server = http.createServer(async (req, res) => {
  const urlParts = req.url.split("/");
  const code = urlParts[1]; // наприклад: /200 → "200"

  // ігнорувати favicon
  if (code === "favicon.ico") {
    res.writeHead(404);
    return res.end();
  }

  // перевірка чи код — число
  if (!code || isNaN(Number(code))) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    return res.end("Bad Request: URL має виглядати так: /200");
  }

  const filePath = getFilePath(code);

  // -------------------------------------
  // GET — повернути картинку
  // -------------------------------------
  if (req.method === "GET") {
    try {
      // Читаємо з кешу
      const data = await fs.readFile(filePath);
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      return res.end(data);
    } catch {
      // Якщо нема → качаємо з http.cat
      const downloaded = await downloadFromHttpCat(code);

      if (!downloaded) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Not Found");
      }

      // зберегти в кеш
      await fs.writeFile(filePath, downloaded);

      res.writeHead(200, { "Content-Type": "image/jpeg" });
      return res.end(downloaded);
    }
  }

  // -------------------------------------
  // PUT — записати картинку вручну
  // -------------------------------------
  if (req.method === "PUT") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));

    req.on("end", async () => {
      const body = Buffer.concat(chunks);

      await fs.writeFile(filePath, body);

      res.writeHead(201, { "Content-Type": "text/plain" });
      res.end("Created");
    });

    return;
  }

  // -------------------------------------
  // DELETE — видалити картинку
  // -------------------------------------
  if (req.method === "DELETE") {
    try {
      await fs.unlink(filePath);

      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("Deleted");
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not Found");
    }
  }

  // -------------------------------------
  // Інші методи → 405
  // -------------------------------------
  res.writeHead(405, { "Content-Type": "text/plain" });
  res.end("Method Not Allowed");
});

// -----------------------------
// 6. Запуск сервера
// -----------------------------
server.listen(port, host, () => {
  console.log(`Proxy server running at http://${host}:${port}`);
});