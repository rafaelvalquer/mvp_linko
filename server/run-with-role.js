const [, , requestedRole = "", entryPath = "./server.js"] = process.argv;

if (!process.env.APP_ROLE && requestedRole) {
  process.env.APP_ROLE = requestedRole;
}

await import(entryPath);
