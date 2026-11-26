/** Sets <title> and <meta name="description">. index.html holds the [PH] fallbacks. */
export function setDocumentMeta({ title, description }: { title?: string; description?: string }): void {
  if (title !== undefined) document.title = title;
  if (description === undefined) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.append(meta);
  }
  meta.content = description;
}

export function readDocumentMeta(): { title: string; description: string | undefined } {
  return {
    title: document.title,
    description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
  };
}

/** Guest-facing description that follows the restaurant (falls back to the [PH] copy in index.html). */
export function restaurantDescription(name: string, rewardTitle: string): string {
  const reward = rewardTitle.trim() || "a free appetizer [PH]";
  return `${reward} at ${name}. Leave your details and show your code to the waiter.`;
}
