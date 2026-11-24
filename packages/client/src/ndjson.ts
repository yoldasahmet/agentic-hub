/** Splits a streamed response body into lines (NDJSON), decoding UTF-8 across chunks. */
export async function* ndjsonLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) yield line;
      if (done) break;
    }
    if (buffer.trim()) yield buffer;
  } finally {
    reader.releaseLock();
  }
}
