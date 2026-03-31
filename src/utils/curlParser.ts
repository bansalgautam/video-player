export interface ParsedCurl {
  url: string;
  headers: Record<string, string>;
}

export function parseCurl(input: string): ParsedCurl {
  const headers: Record<string, string> = {};
  let url = "";

  // Normalize line continuations and collapse whitespace
  const normalized = input.replace(/\\\r?\n\s*/g, " ").trim();

  // Remove leading 'curl' keyword
  const withoutCurl = normalized.replace(/^curl\s+/, "");

  const tokens = tokenize(withoutCurl);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === "-H" || token === "--header") {
      const value = tokens[++i];
      if (value) {
        const colonIdx = value.indexOf(":");
        if (colonIdx > 0) {
          headers[value.substring(0, colonIdx).trim()] = value
            .substring(colonIdx + 1)
            .trim();
        }
      }
    } else if (token === "-b" || token === "--cookie") {
      const value = tokens[++i];
      if (value) {
        headers["Cookie"] = value;
      }
    } else if (
      !token.startsWith("-") &&
      !url &&
      (token.startsWith("http://") || token.startsWith("https://"))
    ) {
      url = token;
    }
  }

  return { url, headers };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;

    let token = "";
    const ch = input[i];

    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && quote === '"') {
          i++;
          if (i < input.length) token += input[i];
        } else {
          token += input[i];
        }
        i++;
      }
      if (i < input.length) i++;
    } else {
      while (i < input.length && !/\s/.test(input[i])) {
        token += input[i];
        i++;
      }
    }

    tokens.push(token);
  }

  return tokens;
}
