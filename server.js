const BASE_PATH = import.meta.dir;

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    if (path === '/') path = '/index.html';
    
    const file = Bun.file(BASE_PATH + path);
    const exists = await file.exists();
    
    if (exists) {
      return new Response(file);
    } else {
      return new Response("Not found", { status: 404 });
    }
  },
});

console.log("Minuet dev server running at http://localhost:3000/");
