import pkg from "../package.json" with { type: "json" };

export const cliVersion: string = pkg.version;
