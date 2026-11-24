/** Recent terminal output, so a client that re-attaches sees the screen it left. */
export class Scrollback {
  private chunks: string[] = [];
  private size = 0;

  constructor(private readonly limit = 256 * 1024) {}

  push(chunk: string): void {
    this.chunks.push(chunk);
    this.size += chunk.length;
    while (this.size > this.limit && this.chunks.length > 1) {
      this.size -= this.chunks.shift()?.length ?? 0;
    }
  }

  text(): string {
    return this.chunks.join("");
  }
}
