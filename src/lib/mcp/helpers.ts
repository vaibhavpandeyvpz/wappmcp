export function createJsonResource(uri: URL, value: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function createJsonResult<T extends object>(value: T) {
  return {
    content: createTextContent(JSON.stringify(value, null, 2)),
    structuredContent: value as Record<string, unknown>,
  };
}

function createTextContent(
  text: string,
): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text }];
}
