export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // 1. INSERT / UPDATE
      if (url.pathname === "/insert" && method === "POST") {
        const { id, vector } = await request.json();
        await env.VECTOR_INDEX.upsert([{ id, values: vector }]);
        return new Response(JSON.stringify({ success: true, id }), { status: 200 });
      }

      // 2. SEARCH / MATCH
      if (url.pathname === "/search" && method === "POST") {
        const { vector } = await request.json();
        try {
          const results = await env.VECTOR_INDEX.query(vector, { topK: 1 });
          return new Response(JSON.stringify(results), { status: 200 });
        } catch (queryError) {
          return new Response(JSON.stringify({ matches: [], error: "Index might be empty" }), { status: 200 });
        }
      }

      // 3. LIST ALL IDs
      if (url.pathname === "/list-all") {
        const all = await env.VECTOR_INDEX.list();
        return new Response(JSON.stringify(all), { status: 200 });
      }

      // 4. DELETE (Single ID or All)
      if (url.pathname === "/delete" && method === "POST") {
        const { id } = await request.json();

        if (id) {
          // Delete one specific staff member
          await env.VECTOR_INDEX.deleteByIds([id]);
          return new Response(JSON.stringify({ success: true, message: `Deleted ID: ${id}` }), { status: 200 });
        } else {
          // Delete everything if no ID is passed
          const allVectors = await env.VECTOR_INDEX.list();
          const idsToDelete = allVectors.vectors.map(v => v.id);

          if (idsToDelete.length > 0) {
            await env.VECTOR_INDEX.deleteByIds(idsToDelete);
            return new Response(JSON.stringify({ success: true, count: idsToDelete.length }), { status: 200 });
          }
          return new Response(JSON.stringify({ success: true, message: "Nothing to delete" }), { status: 200 });
        }
      }

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }

    return new Response("Not Found", { status: 404 });
  }
};