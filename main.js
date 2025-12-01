const http = require("http");
const { Command } = require("commander");

const program = new Command();

program
  .requiredOption("-h, --host <host>", "Server host")
  .requiredOption("-p, --port <port>", "Server port")
  .requiredOption("-c, --cache <path>", "Cache directory");

program.parse(process.argv);

const { host, port, cache } = program.opts();

const server = http.createServer((req, res) => {
  res.end("Server working!");
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});