/**
 * Yields the `data:` payloads of a server-sent event stream. Comment lines
 * (OpenRouter sends ": OPENROUTER PROCESSING" keep-alives) are skipped and
 * multi-line data fields are joined, per the SSE spec.
 */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  const reader = body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (line === "") {
          if (data.length > 0) yield data.join("\n");
          data = [];
        } else if (line.startsWith("data:")) {
          data.push(line.slice(5).replace(/^ /, ""));
        }
        newline = buffer.indexOf("\n");
      }
      if (done) break;
    }
    if (data.length > 0) yield data.join("\n");
  } finally {
    reader.releaseLock();
  }
}
